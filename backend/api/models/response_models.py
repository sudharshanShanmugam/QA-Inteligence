from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class IngestResponse(BaseModel):
    status: str
    source_id: str
    chunks_stored: int
    entities_extracted: int
    relationships_created: int
    message: str


class RiskArea(BaseModel):
    module: str
    feature: str
    risk_score: float
    priority: str  # P1/P2/P3/P4
    reasons: List[str]
    past_bug_count: int


class HeadsUpWarning(BaseModel):
    warning: str
    similar_bug_id: str
    bug_title: str
    severity: str
    module: str
    recommendation: str


class TestScenario(BaseModel):
    id: str
    type: str  # functional/negative/edge/boundary
    title: str
    description: str
    preconditions: List[str]
    steps: List[str]
    expected_result: str
    risk_level: str
    traceability: str  # Feature → Risk → Test


class GherkinTestCase(BaseModel):
    feature: str
    scenario_title: str
    given: List[str]
    when: List[str]
    then: List[str]
    tags: List[str]


class RegressionItem(BaseModel):
    test_case_id: str
    test_case_name: str
    module: str
    reason: str  # why it must run
    priority: str  # MUST-RUN / SHOULD-RUN
    needs_update: bool
    update_reason: Optional[str] = None


class EventFlowStep(BaseModel):
    layer: str  # UI / API / DB / Event / Notification
    component: str
    action: str
    data: Optional[str] = None
    validation_point: str


class CoverageGap(BaseModel):
    area: str
    gap_type: str  # missing_test / untested_flow / edge_case / boundary
    description: str
    recommendation: str


class APIValidationItem(BaseModel):
    endpoint: str
    method: str
    validations: List[str]
    event_triggers: List[str]
    db_impacts: List[str]


class SignoffItem(BaseModel):
    category: str
    item: str
    status: str  # PENDING / MUST_VERIFY / AUTOMATED
    owner: Optional[str] = None


class QAAnalysisResponse(BaseModel):
    # Section 1
    feature_understanding: str
    # Section 2
    impacted_modules: List[Dict[str, Any]]
    # Section 3
    event_flow: List[EventFlowStep]
    # Section 4
    risk_areas: List[RiskArea]
    # Section 5
    heads_up_warnings: List[HeadsUpWarning]
    # Section 6
    test_scenarios: List[TestScenario]
    # Section 7
    gherkin_test_cases: List[GherkinTestCase]
    # Section 8
    regression_suite: List[RegressionItem]
    # Section 9
    test_cases_to_update: List[RegressionItem]
    # Section 10
    missing_coverage: List[CoverageGap]
    # Section 11
    api_event_validation: List[APIValidationItem]
    # Section 12
    signoff_checklist: List[SignoffItem]
    # Metadata
    user_story: str
    total_scenarios: int
    overall_risk: str
    generated_at: str
