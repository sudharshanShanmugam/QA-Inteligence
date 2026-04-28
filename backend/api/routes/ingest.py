"""
/ingest routes – accept documents and feed them into the graph + vector store.
"""

import json
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
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


async def _ingest_document(document: dict) -> IngestResponse:
    """Shared ingestion logic."""
    # 1. Chunk the document
    chunks = chunker.chunk(document)

    # 2. Store in vector store
    chunks_stored = vector_store.add_chunks(chunks)

    # 3. Extract entities and build graph
    extraction = entity_extractor.extract(document)
    graph_result = relationship_builder.ingest(extraction, document["source_id"])

    return IngestResponse(
        status="success",
        source_id=document["source_id"],
        chunks_stored=chunks_stored,
        entities_extracted=graph_result["entities"],
        relationships_created=graph_result["relationships"],
        message=f"Ingested {chunks_stored} chunks, {graph_result['entities']} entities, {graph_result['relationships']} relationships",
    )


@router.post("/text", response_model=IngestResponse, summary="Ingest raw text document")
async def ingest_text(request: IngestTextRequest):
    """Ingest a plain-text document (BRD, SRS, user story, etc.)."""
    try:
        document = document_loader.load_text(
            content=request.content,
            doc_type=request.doc_type.value,
            source_id=request.source_id,
            metadata=request.metadata,
        )
        return await _ingest_document(document)
    except Exception as e:
        log.error("ingest_text_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json", response_model=IngestResponse, summary="Ingest structured JSON document")
async def ingest_json(request: IngestJSONRequest):
    """Ingest a structured JSON document (API contract, bug report, DB schema, etc.)."""
    try:
        document = document_loader.load_json(
            data=request.data,
            doc_type=request.doc_type.value,
            source_id=request.source_id,
        )
        return await _ingest_document(document)
    except Exception as e:
        log.error("ingest_json_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file", response_model=IngestResponse, summary="Ingest uploaded file")
async def ingest_file(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
):
    """Ingest a file upload (PDF, DOCX, TXT, JSON)."""
    import tempfile, os
    try:
        # Save temp file
        suffix = "." + file.filename.split(".")[-1] if "." in file.filename else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        source_id = file.filename.rsplit(".", 1)[0]
        document = document_loader.load_file(tmp_path, doc_type)
        document["source_id"] = source_id
        result = await _ingest_document(document)
        os.unlink(tmp_path)
        return result
    except Exception as e:
        log.error("ingest_file_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", summary="Vector store and graph status")
async def ingest_status():
    """Return current state of the knowledge base."""
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
