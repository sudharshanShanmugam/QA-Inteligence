"""
Structured prompt templates for the QA LLM.

These are NOT open-ended "generate test cases" prompts.
They pass structured analytical data and ask LLM to format it into human output.
"""

SYSTEM_PROMPT = """You are a Senior QA Architect with 25+ years of experience.
You have been given structured analytical data from three sources:
1. Knowledge Graph (entity dependencies, bugs, test cases)
2. Analytical Engine (BVA, EP, State Transition, Risk scores)
3. RAG (retrieved SRS, BRD, bug history, API contracts)

Your job is to synthesise this data into a structured QA output.
DO NOT guess or hallucinate. Use ONLY the data provided.
Every test must be traceable: Feature → Risk → Test.
"""

FEATURE_UNDERSTANDING_PROMPT = """Based on the following retrieved context, write a concise Feature Understanding section (3-5 sentences).
Explain: what the feature does, who uses it, key business rules, and integration points.

USER STORY:
{user_story}

RETRIEVED CONTEXT:
{rag_context}

GRAPH DATA:
- Module: {module_name}
- Related APIs: {apis}
- Related Events: {events}
- Business Rules: {business_rules}

Write Feature Understanding (3-5 sentences, factual, no hallucination):"""

GHERKIN_GENERATION_PROMPT = """Convert the following structured test scenarios into Gherkin BDD format.

USER STORY:
{user_story}

ANALYTICAL SCENARIOS:
{scenarios}

RISK CONTEXT:
{risk_context}

PAST BUG WARNINGS:
{warnings}

Rules:
- Generate UP TO {gherkin_limit} Gherkin scenarios (scale depth to match the number)
- Use Given/When/Then structure
- Each scenario must have a clear title
- Use @tags for: @smoke, @regression, @negative, @edge, @security, @high-risk
- DO NOT duplicate scenarios
- Focus on BEHAVIOUR not implementation

Return valid Gherkin format for each scenario:"""

EDGE_CASE_PROMPT = """Based on the analytical data below, identify additional edge cases and negative scenarios
that are NOT already covered by the existing test scenarios.

FEATURE: {feature_name}
RETRIEVED BUGS: {bug_context}
BVA OUTPUT: {bva_results}
EQUIVALENCE CLASSES: {ep_results}
STATE MACHINE: {state_machine}

Identify exactly {edge_count} edge cases (no more, no less). For each:
- Title
- Condition that triggers it
- Expected behaviour
- Why it's risky (link to past bug if applicable)

Format as JSON array: [{{"title": "...", "condition": "...", "expected": "...", "risk_reason": "..."}}]"""

SIGNOFF_CHECKLIST_PROMPT = """Generate a QA Sign-off Checklist based on the complete analysis below.

FEATURE: {feature_name}
RISK LEVEL: {risk_level}
IMPACTED MODULES: {modules}
TOTAL TESTS: {total_tests}
REGRESSION SUITE: {regression_count} tests
COVERAGE GAPS: {gaps}
OPEN WARNINGS: {warnings_count}

Create a checklist with categories: Functional, Regression, Performance, Security, Data, Documentation.
For each item specify: MUST_VERIFY, AUTOMATED, or PENDING.

Return as JSON array: [{{"category": "...", "item": "...", "status": "MUST_VERIFY|AUTOMATED|PENDING", "owner": "QA|Dev|DevOps"}}]"""

API_VALIDATION_PROMPT = """Generate API + Event validation test scenarios for each endpoint/event.

APIs:
{apis}

EVENTS:
{events}

For each API endpoint generate:
- Happy path validation (200)
- Auth failure (401/403)
- Invalid input (400)
- Not found (404)
- Server error handling (500)
- Rate limit / throttling
- Any event it publishes

Return as JSON array: [{{
  "endpoint": "...",
  "method": "...",
  "validations": ["..."],
  "event_triggers": ["..."],
  "db_impacts": ["..."]
}}]"""
