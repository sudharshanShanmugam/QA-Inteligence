"""
/ingest routes – accept documents and feed them into the graph + vector store.

Embedding runs async (non-blocking thread).
Entity extraction runs as a background task — response is returned immediately
after chunks are stored, so no client timeouts on large documents.
"""

import asyncio
import json
import os
import tempfile
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
import structlog

from api.models.request_models import IngestTextRequest, IngestJSONRequest
from api.models.response_models import IngestResponse
from ingestion.document_loader import document_loader
from ingestion.chunker import chunker
from rag_engine.vector_store import vector_store
from graph_builder.entity_extractor import entity_extractor
from graph_builder.relationship_builder import relationship_builder

router = APIRouter()
log = structlog.get_logger()


def _build_graph(document: dict) -> None:
    """Runs in background: extract entities and build knowledge graph."""
    try:
        extraction = entity_extractor.extract(document)
        result = relationship_builder.ingest(extraction, document["source_id"])
        log.info("graph_built_background",
                 source_id=document["source_id"],
                 entities=result["entities"],
                 relationships=result["relationships"])
    except Exception as e:
        log.error("graph_build_failed", source_id=document.get("source_id"), error=str(e))


async def _ingest_document(document: dict, background_tasks: BackgroundTasks) -> IngestResponse:
    """Chunk + embed synchronously, schedule graph build in background."""
    chunks = chunker.chunk(document)

    # Run embedding in a thread so it doesn't block the event loop
    chunks_stored = await asyncio.to_thread(vector_store.add_chunks, chunks)

    # Schedule entity extraction + graph build — returns immediately
    background_tasks.add_task(_build_graph, document)

    return IngestResponse(
        status="success",
        source_id=document["source_id"],
        chunks_stored=chunks_stored,
        entities_extracted=0,
        relationships_created=0,
        message=f"Ingested {chunks_stored} chunks. Graph building in background.",
    )


@router.post("/text", response_model=IngestResponse, summary="Ingest raw text document")
async def ingest_text(request: IngestTextRequest, background_tasks: BackgroundTasks):
    try:
        document = document_loader.load_text(
            content=request.content,
            doc_type=request.doc_type.value,
            source_id=request.source_id,
            metadata=request.metadata,
        )
        return await _ingest_document(document, background_tasks)
    except Exception as e:
        log.error("ingest_text_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json", response_model=IngestResponse, summary="Ingest structured JSON document")
async def ingest_json(request: IngestJSONRequest, background_tasks: BackgroundTasks):
    try:
        document = document_loader.load_json(
            data=request.data,
            doc_type=request.doc_type.value,
            source_id=request.source_id,
        )
        return await _ingest_document(document, background_tasks)
    except Exception as e:
        log.error("ingest_json_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file", response_model=IngestResponse, summary="Ingest uploaded file")
async def ingest_file(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    try:
        suffix = "." + file.filename.split(".")[-1] if "." in file.filename else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        source_id = file.filename.rsplit(".", 1)[0]
        document = document_loader.load_file(tmp_path, doc_type)
        document["source_id"] = source_id
        os.unlink(tmp_path)

        return await _ingest_document(document, background_tasks)
    except Exception as e:
        log.error("ingest_file_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", summary="Vector store and graph status")
async def ingest_status():
    from graph_builder.neo4j_client import get_graph
    from graph_builder.graph_queries import GraphQueryEngine

    try:
        gq = GraphQueryEngine(get_graph())
        graph_stats = gq.get_graph_stats()
    except Exception as e:
        graph_stats = {"error": str(e)}

    return {
        "vector_store": {
            "total_chunks": vector_store.count(),
            "sources": vector_store.get_all_sources(),
        },
        "knowledge_graph": graph_stats,
    }
