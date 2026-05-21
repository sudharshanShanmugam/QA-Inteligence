"""
FastAPI server — exposes QA Intelligence backend as a REST API.
Run: uvicorn backend.api:app --reload --port 8000
"""

from __future__ import annotations

import os
import sys
import tempfile
import threading
import concurrent.futures
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from ingestion.document_loader import document_loader
from ingestion.chunker import chunker
from rag_engine.vector_store import vector_store
from graph_builder.entity_extractor import entity_extractor
from graph_builder.relationship_builder import relationship_builder
from graph_builder.neo4j_client import get_graph
from graph_builder.graph_queries import GraphQueryEngine
from orchestrator.qa_pipeline import qa_pipeline
from test_generator.llm_client import llm_client

app = FastAPI(title="QA Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph_lock = threading.Lock()

# ── Pricing table ────────────────────────────────────────────────────────────
_PRICING: Dict[str, tuple] = {
    "openai/gpt-oss-120b-Turbo":               (0.80, 2.40),
    "meta-llama/Meta-Llama-3.1-8B-Instruct":   (0.06, 0.06),
    "meta-llama/Meta-Llama-3.1-70B-Instruct":  (0.52, 0.75),
    "meta-llama/Meta-Llama-3.1-405B-Instruct": (2.70, 2.70),
    "mistralai/Mixtral-8x7B-Instruct-v0.1":    (0.27, 0.27),
    "deepseek-ai/DeepSeek-R1":                 (0.55, 2.19),
    "Qwen/Qwen2.5-72B-Instruct":               (0.35, 0.40),
}


# ── Models ───────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_story: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ingest_file(file_bytes: bytes, filename: str, doc_type: str) -> dict:
    result = {"file": filename, "type": doc_type, "status": "PENDING",
              "chunks": 0, "entities": 0, "rels": 0, "steps": []}
    try:
        suffix = "." + filename.split(".")[-1] if "." in filename else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        source_id = filename.rsplit(".", 1)[0]
        document = document_loader.load_file(tmp_path, doc_type)
        document["source_id"] = source_id
        os.unlink(tmp_path)

        relevance = llm_client.check_document_relevance(
            content=document.get("content", ""), filename=filename, doc_type=doc_type
        )
        if not relevance["is_relevant"]:
            result["status"] = "REJECTED"
            result["reason"] = relevance["reason"]
            return result

        result["detected_type"] = relevance.get("detected_type", doc_type)

        chunks = chunker.chunk(document)
        chunks_stored = vector_store.add_chunks(chunks)
        result["chunks"] = chunks_stored

        try:
            extraction = entity_extractor.extract(document)
            with _graph_lock:
                gr = relationship_builder.ingest(extraction, source_id)
            result["entities"] = gr["entities"]
            result["rels"] = gr["relationships"]
        except Exception:
            pass

        result["status"] = "OK"
    except Exception as e:
        result["status"] = "FAIL"
        result["error"] = str(e)
    return result


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/settings")
def get_settings():
    model = settings.LLM_MODEL
    price = _PRICING.get(model)
    usage = llm_client.get_usage()
    inp_tok = usage["input_tokens"]
    out_tok = usage["output_tokens"]
    cost = None
    if price and (inp_tok or out_tok):
        cost = {
            "input_cost": round(inp_tok / 1_000_000 * price[0], 6),
            "output_cost": round(out_tok / 1_000_000 * price[1], 6),
            "total_cost": round(inp_tok / 1_000_000 * price[0] + out_tok / 1_000_000 * price[1], 6),
            "input_rate": price[0],
            "output_rate": price[1],
        }
    return {
        "model": model,
        "embed_model": settings.EMBED_MODEL,
        "entity_model": settings.ENTITY_MODEL,
        "usage": {"input_tokens": inp_tok, "output_tokens": out_tok},
        "cost": cost,
    }


@app.post("/api/settings/reset-usage")
def reset_usage():
    llm_client.reset_usage()
    return {"status": "ok"}


@app.get("/api/kb/status")
def kb_status():
    try:
        gq = GraphQueryEngine(get_graph())
        graph_stats = gq.get_graph_stats()
    except Exception as e:
        graph_stats = {"error": str(e)}
    return {
        "chunks": vector_store.count(),
        "sources": vector_store.get_all_sources(),
        "graph": graph_stats,
    }


@app.delete("/api/kb")
def clear_kb():
    try:
        vector_store.clear()
        get_graph().clear()
        return {"status": "cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ingest")
async def ingest(
    files: List[UploadFile] = File(...),
    doc_type: str = Form("auto"),
):
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_ingest_file, await f.read() if False else f.file.read(), f.filename, doc_type): f.filename
            for f in files
        }
        # Run sequentially to avoid async issues with sync file reads
        for f in files:
            data = f.file.read()
            res = executor.submit(_ingest_file, data, f.filename, doc_type)
            results.append(res)
        results = [r.result() for r in results]
    return {"results": results}


@app.post("/api/analyze")
def analyze(body: AnalyzeRequest):
    if not body.user_story.strip():
        raise HTTPException(status_code=400, detail="user_story is required")
    try:
        result = qa_pipeline.run(user_story=body.user_story)
        # Snapshot token usage into the response
        result["token_usage"] = llm_client.get_usage()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
