"""
/analyze route – runs the three-brain pipeline and returns structured QA output.
"""

from fastapi import APIRouter, HTTPException
import structlog

from api.models.request_models import AnalyzeRequest
from orchestrator.qa_pipeline import qa_pipeline

router = APIRouter()
log = structlog.get_logger()


@router.post("/", summary="Full QA analysis of a user story")
async def analyze(request: AnalyzeRequest):
    """
    Run the complete QA Intelligence pipeline on a user story.

    Returns the 12-section structured QA output:
    1. Feature Understanding
    2. Impacted Modules
    3. Event Flow
    4. Risk Areas
    5. HEADS-UP Warnings
    6. Test Scenarios
    7. Gherkin Test Cases
    8. Regression Suite
    9. Test Cases to Update
    10. Missing Coverage
    11. API + Event Validation
    12. Sign-off Checklist
    """
    try:
        result = qa_pipeline.run(
            user_story=request.user_story,
            module_name=request.module_name or "",
            priority=request.priority or "medium",
        )
        return result
    except Exception as e:
        log.error("analysis_failed", error=str(e), user_story=request.user_story[:100])
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/graph-stats", summary="Knowledge graph statistics")
async def graph_stats():
    from graph_builder.neo4j_client import get_graph
    from graph_builder.graph_queries import GraphQueryEngine
    gq = GraphQueryEngine(get_graph())
    return gq.get_graph_stats()
