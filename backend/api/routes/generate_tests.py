"""
/generate-tests route – full pipeline with streaming support.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import structlog

from api.models.request_models import GenerateTestsRequest
from orchestrator.qa_pipeline import qa_pipeline
from test_generator.llm_client import llm_client

router = APIRouter()
log = structlog.get_logger()


@router.post("/", summary="Generate complete test suite for a user story")
async def generate_tests(request: GenerateTestsRequest):
    """
    Generate a full, structured QA test suite.
    Combines graph intelligence, analytical engine, and LLM formatting.
    """
    try:
        result = qa_pipeline.run(
            user_story=request.user_story,
            module_name=request.module_name or "",
            priority="high",
        )
        # Apply user filters
        if not request.include_gherkin:
            result["gherkin_test_cases"] = []
        if not request.include_regression:
            result["regression_suite"] = []
        if not request.include_edge_cases:
            result["test_scenarios"] = [
                s for s in result.get("test_scenarios", [])
                if s.get("scenario_type") != "edge"
            ]
        if not request.include_api_validation:
            result["api_event_validation"] = []

        # Filter by risk threshold
        result["risk_areas"] = [
            r for r in result.get("risk_areas", [])
            if r.get("risk_score", 0) >= request.risk_threshold
        ]

        # Cap total scenarios
        if len(result.get("test_scenarios", [])) > request.max_scenarios:
            result["test_scenarios"] = result["test_scenarios"][:request.max_scenarios]

        return result
    except Exception as e:
        log.error("generate_tests_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream", summary="Stream test generation (SSE)")
async def generate_tests_stream(request: GenerateTestsRequest):
    """Stream test generation using Server-Sent Events."""

    async def event_generator():
        yield f"data: {json.dumps({'status': 'starting', 'message': 'Initialising QA pipeline...'})}\n\n"

        try:
            yield f"data: {json.dumps({'status': 'brain1', 'message': 'Brain 1: Querying knowledge graph...'})}\n\n"

            result = qa_pipeline.run(
                user_story=request.user_story,
                module_name=request.module_name or "",
                priority="high",
            )

            yield f"data: {json.dumps({'status': 'brain2', 'message': 'Brain 2: Analytical engine complete'})}\n\n"
            yield f"data: {json.dumps({'status': 'brain3', 'message': 'Brain 3: LLM formatting complete'})}\n\n"
            yield f"data: {json.dumps({'status': 'complete', 'result': result})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/gherkin-only", summary="Generate only Gherkin test cases")
async def generate_gherkin_only(request: GenerateTestsRequest):
    """Lightweight endpoint: generates only Gherkin test cases."""
    try:
        result = qa_pipeline.run(user_story=request.user_story)
        return {
            "user_story": request.user_story,
            "gherkin_test_cases": result.get("gherkin_test_cases", []),
            "total": len(result.get("gherkin_test_cases", [])),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
