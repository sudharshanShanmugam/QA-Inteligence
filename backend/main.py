"""QA Intelligence System – FastAPI Entry Point."""

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from api.routes import ingest, analyze, generate_tests

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("qa_intelligence_starting", model=settings.LLM_MODEL)
    yield
    log.info("qa_intelligence_stopped")


app = FastAPI(
    title="QA Intelligence System",
    description="Three-Brain QA Architecture: Knowledge Graph + Analytical Engine + LLM/RAG",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(analyze.router, prefix="/analyze", tags=["Analysis"])
app.include_router(generate_tests.router, prefix="/generate-tests", tags=["Test Generation"])


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.LLM_MODEL, "neo4j": settings.USE_NEO4J}
