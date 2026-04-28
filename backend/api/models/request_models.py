from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class DocumentType(str, Enum):
    BRD = "brd"
    SRS = "srs"
    USER_STORY = "user_story"
    TEST_CASE = "test_case"
    BUG_REPORT = "bug_report"
    API_CONTRACT = "api_contract"
    DB_SCHEMA = "db_schema"
    EVENT_DEFINITION = "event_definition"
    BUSINESS_RULE = "business_rule"


class IngestTextRequest(BaseModel):
    content: str = Field(..., description="Raw document text content")
    doc_type: DocumentType
    source_id: str = Field(..., description="Unique identifier for this document")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IngestJSONRequest(BaseModel):
    data: Dict[str, Any] = Field(..., description="Structured JSON document")
    doc_type: DocumentType
    source_id: str


class AnalyzeRequest(BaseModel):
    user_story: str = Field(..., description="The user story or feature description to analyze")
    module_name: Optional[str] = Field(None, description="Target module name if known")
    sprint: Optional[str] = Field(None, description="Sprint identifier")
    priority: Optional[str] = Field("medium", description="Feature priority: low/medium/high/critical")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class GenerateTestsRequest(BaseModel):
    user_story: str = Field(..., description="User story to generate tests for")
    module_name: Optional[str] = None
    include_gherkin: bool = True
    include_regression: bool = True
    include_edge_cases: bool = True
    include_api_validation: bool = True
    risk_threshold: float = Field(0.3, description="Minimum risk score to flag (0-1)")
    max_scenarios: int = Field(50, description="Maximum test scenarios to generate")
