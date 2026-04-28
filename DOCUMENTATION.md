# QA Intelligence System — Full Documentation

## What Is This?

QA Intelligence is an AI-powered QA test planning system. You give it a user story or feature description, and it automatically generates:

- Risk-scored test areas
- Boundary value and equivalence partition tests
- Gherkin BDD scenarios
- Regression suite recommendations
- Bug-pattern-based warnings (HEADS-UP)
- API and event validation tests
- Coverage gap analysis
- QA sign-off checklist

It does this by reading all your documents (BRDs, SRS, bug history, API contracts, DB schemas) and building intelligence from them — not by hallucinating.

---

## The Three-Brain Architecture

Every analysis runs through three sequential "brains":

```
User Story Input
      │
      ▼
┌─────────────────────────────────┐
│  BRAIN 1: Knowledge Graph       │  "What do we know about this system?"
│  Neo4j / NetworkX               │  Modules, features, APIs, bugs, relations
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  BRAIN 2: Analytical Engine     │  "What tests does the math say we need?"
│  10 specialized QA engines      │  BVA, EP, Pairwise, Risk, State, Bugs...
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  BRAIN 3: RAG + LLM             │  "How do I format this for a human?"
│  ChromaDB + DeepInfra 120B      │  Gherkin, summaries, checklists
└────────────────┬────────────────┘
                 │
                 ▼
         12-Section QA Report
```

The key design principle: **the LLM formats intelligence, it does not invent it.** All test logic comes from Brain 1 and Brain 2. Brain 3 only structures the output.

---

## Project Folder Structure

```
QA-Inteligence/
│
├── backend/                  ← FastAPI server (all intelligence lives here)
│   ├── main.py               ← App entry point, routes, CORS
│   ├── config.py             ← All settings, reads from .env
│   │
│   ├── ingestion/            ← Document loading and chunking
│   ├── graph_builder/        ← Knowledge graph (entities + relations)
│   ├── rag_engine/           ← Vector store + semantic retrieval
│   ├── analytics_engine/     ← 10 QA analysis engines (Brain 2)
│   ├── test_generator/       ← LLM prompts and test formatting
│   ├── orchestrator/         ← The three-brain pipeline wiring
│   └── api/                  ← HTTP routes and request/response models
│
├── frontend/
│   └── streamlit_app.py      ← The web UI
│
├── .env                      ← API keys and configuration
├── requirements.txt          ← Python dependencies
└── chroma_db/                ← ChromaDB vector store (auto-created)
```

---

## Folder-by-Folder Breakdown

---

### `backend/` — The Core Application

---

#### `backend/main.py` — App Entry Point

**What it does:**
Starts the FastAPI server. Registers the three route groups (ingest, analyze, generate-tests). Sets up CORS so the Streamlit frontend can call the API. Provides a `/health` endpoint to check if the server is running.

**Why we need it:**
Every HTTP request from the frontend hits this file first. Without it, nothing starts.

**Key endpoint:**
```
GET /health  →  {"status": "ok", "model": "openai/gpt-oss-120b", "neo4j": false}
```

---

#### `backend/config.py` — Settings

**What it does:**
Reads every environment variable from the `.env` file and makes them available as a Python object throughout the codebase. Uses Pydantic's `BaseSettings` for type validation.

**Why we need it:**
All code does `from config import settings` to get API keys, model names, DB paths, etc. Having one place for config means changing `.env` changes the whole app. The path is computed as an absolute path relative to this file so it works regardless of which directory the server is started from.

**Key settings:**
```
DEEPINFRA_API_KEY    → authenticates LLM and embedding API calls
DEEPINFRA_BASE_URL   → OpenAI-compatible endpoint
LLM_MODEL            → openai/gpt-oss-120b  (main reasoning model)
EMBED_MODEL          → BAAI/bge-large-en-v1.5  (1024-dim embeddings)
ENTITY_MODEL         → meta-llama/Meta-Llama-3.1-8B-Instruct  (fast extraction)
CHROMA_PERSIST_DIR   → where vector DB files are stored on disk
GRAPH_PERSIST_PATH   → where the NetworkX graph .pkl file is saved
CHUNK_SIZE           → 500 chars (soft cap for text chunking)
CHUNK_OVERLAP        → 50 chars
```

---

### `backend/ingestion/` — Document Loading Pipeline

This folder handles Step 1 (Parse) and Steps 2–5 (Chunk) of the pipeline.

---

#### `backend/ingestion/document_loader.py` — File Parser

**What it does:**
Reads any supported file format and normalises it into a single internal dict:
```python
{
  "source_id": "my_doc",
  "doc_type":  "api_contract",
  "content":   "... full text ...",
  "raw":       {...},   # original JSON if applicable
  "metadata":  {},
  "format":    "json"
}
```

Supported formats: `.txt`, `.md`, `.json`, `.pdf`, `.docx`, `.sql`, `.yaml`, `.yml`, `.xlsx`, `.xls`

Format-specific logic:
- **PDF** → PyPDF2 extracts page text
- **DOCX** → python-docx reads paragraphs
- **XLSX** → openpyxl reads all sheets, rows become pipe-separated lines
- **JSON** → converted to readable prose via `_json_to_text()` based on `doc_type`

**Why we need it:**
Without normalisation, every downstream component would need to handle 10+ file formats. This file is the single entry point for all documents.

---

#### `backend/ingestion/chunker.py` — Intelligent Chunker

**What it does:**
Splits a loaded document into smaller pieces (chunks) that can be individually embedded and stored in the vector database. Uses a 5-step pipeline:

```
Step 2: Document-based structural split  (respects doc type boundaries)
Step 3: Semantic refinement             (merge tiny, split giant blocks)
Step 4: Rich metadata attachment         (section, doc_type, source, index)
Step 5: Sentence-level overlap           (last sentence of prev chunk → context prefix)
```

Different splitting rules per document type:

| Document Type    | Splitting Strategy                                      |
|------------------|---------------------------------------------------------|
| `user_story`     | 3 chunks: story body / acceptance criteria / business rules |
| `api_contract`   | 1 chunk per endpoint (never split across endpoints)     |
| `db_schema`      | 1 chunk per table                                       |
| `bug_report`     | 1 self-contained chunk (bug is atomic intelligence)     |
| `event_definition` | 1 chunk per event                                     |
| BRD / SRS / text | Split by `##` headings → paragraphs → sentences        |

**Why we need it:**
Fixed-size chunking (the naive approach) cuts documents at random character positions, splitting sentences mid-thought. This produces poor retrieval — a semantic search for "acceptance criteria for login" might return a chunk that starts halfway through the ACs. Structure-aware chunking ensures each chunk is a complete, meaningful unit.

---

#### `backend/ingestion/schema_parser.py` — Schema Constraint Extractor

**What it does:**
Reads DB schemas and API contracts and extracts field-level constraints (min, max, type, required, enum values). Used by Brain 2 to generate accurate boundary value and equivalence partition tests.

**Why we need it:**
Without field specs, BVA and EP engines would generate generic tests. With them, tests are grounded in actual field constraints from the system's own schema.

---

### `backend/graph_builder/` — Knowledge Graph (Brain 1)

This folder builds and queries the knowledge graph — the system's long-term memory of what is in the codebase.

---

#### `backend/graph_builder/graph_schema.py` — Node and Relationship Definitions

**What it does:**
Defines what types of things can exist in the graph.

**10 node types:**

| Node Label      | What it represents                              |
|-----------------|-------------------------------------------------|
| `Module`        | A system module (e.g., Checkout, Auth)          |
| `Feature`       | A specific feature within a module              |
| `API`           | An API endpoint                                 |
| `DBTable`       | A database table                                |
| `Event`         | A Kafka/messaging event                         |
| `TestCase`      | An existing test case                           |
| `Bug`           | A historical bug/defect                         |
| `UserJourney`   | An end-to-end user flow                         |
| `BusinessRule`  | A business constraint or rule                   |
| `State`         | A state in a state machine                      |

**13 relationship types:**
`DEPENDS_ON`, `BELONGS_TO`, `TRIGGERS`, `UPDATES`, `RELATED_TO`, `FOUND_IN`, `VALIDATES`, `SPANS`, `PRODUCES`, `CONSUMES`, `TRANSITIONS_TO`, `GOVERNED_BY`

**Why we need it:**
The schema enforces consistency. Entity extractor and relationship builder both reference this to ensure they only create valid node/relationship combinations.

---

#### `backend/graph_builder/entity_extractor.py` — LLM Entity Extraction

**What it does:**
Takes a loaded document and uses the fast 8B LLM to extract all entities and relationships in one structured JSON call. For example, from a bug report it extracts: the Bug node, its Module, its Feature, and FOUND_IN / RELATED_TO relationships.

Falls back to rule-based extraction if the LLM call fails — for known doc types (bug_report, api_contract, db_schema), it can extract entities directly from the `raw` JSON without LLM.

**Why we need it:**
Documents are unstructured text. The graph needs structured nodes. This is the bridge. Without entity extraction, the graph would be empty and Brain 1 would have nothing to query.

---

#### `backend/graph_builder/relationship_builder.py` — Graph Ingestion

**What it does:**
Takes the extraction output (list of entities + list of relationships) and writes them into the graph adapter. Also infers implicit relationships that the LLM may have missed — e.g., if a Feature has a `module_id` property, it automatically creates a `BELONGS_TO` edge to that Module.

**Why we need it:**
Separates the "what exists" (entity extractor) from the "put it in the graph" concern. Also adds the post-processing inference layer so graph completeness does not depend entirely on LLM accuracy.

---

#### `backend/graph_builder/neo4j_client.py` — Graph Adapter

**What it does:**
Provides a single `GraphAdapter` interface that works identically whether you're using:
- **NetworkX** (default): in-memory graph, persisted as a `.pkl` file — no server needed
- **Neo4j**: production-grade graph DB — set `USE_NEO4J=true` in `.env`

Both adapters support: `upsert_node`, `upsert_relationship`, `get_node`, `find_nodes`, `get_relationships`, `delete_node`.

The `get_graph()` factory function returns the correct adapter based on config.

**Why we need it:**
Decouples all graph logic from the storage backend. Development works with NetworkX (zero setup). Production can switch to Neo4j by changing one env variable — no code changes needed.

---

#### `backend/graph_builder/graph_queries.py` — Graph Query Engine

**What it does:**
High-level read API for the knowledge graph. Powers Brain 1 of the pipeline.

Key queries:
- `full_impact_analysis(feature_name)` → everything the pipeline needs: modules, bugs, test cases, APIs, events, states, dependent modules
- `get_all_bugs()` → full bug history for pattern matching
- `get_module_dependencies(module_id)` → transitive dependency chain
- `get_graph_stats()` → counts of all node types for the UI dashboard

**Why we need it:**
Raw graph traversal code would be scattered across the pipeline. This provides one clean interface with all the traversal logic in one place.

---

### `backend/rag_engine/` — Vector Store and Retrieval (Brain 3, Part 1)

---

#### `backend/rag_engine/vector_store.py` — ChromaDB Wrapper

**What it does:**
Stores and retrieves document chunks using semantic similarity. Each chunk is converted to a 1024-dimensional embedding vector (via DeepInfra's `BAAI/bge-large-en-v1.5`) and stored in ChromaDB with its metadata.

At query time: the search query is also embedded, and ChromaDB returns the most similar chunks by cosine similarity.

**Why we need it:**
The knowledge graph stores structured facts (entities, relationships). The vector store stores the full text of all documents for open-ended retrieval. When the pipeline asks "what documents are relevant to this user story?", the vector store answers.

---

#### `backend/rag_engine/retriever.py` — RAG Orchestrator

**What it does:**
Orchestrates the retrieval step for the pipeline. Takes a query, retrieves top-k chunks from the vector store, groups them by document type (BRD chunks, bug chunks, API chunks), deduplicates, and builds a formatted context string ready to paste into an LLM prompt.

**Why we need it:**
`vector_store.search()` returns raw results. `retriever.retrieve()` structures them into a context string the LLM can actually use, and organises them by type so the prompt templates can reference specific buckets (e.g., "RETRIEVED BUGS:" separately from "RETRIEVED SRS:").

---

### `backend/analytics_engine/` — The 10 QA Engines (Brain 2)

This is where all the deterministic QA intelligence lives. **No LLM involved here** — pure algorithms, formulas, and patterns. Every output is reproducible.

---

#### `risk_engine.py` — Risk Scoring

**What it does:**
Computes a 0.0–1.0 risk score using a weighted formula:
```
Risk = 0.35 × (bug_count / 10)
     + 0.25 × (criticality / 5)
     + 0.25 × (impacted_modules / 5)
     + 0.15 × severity_weight
```
Maps to: P1 (critical, ≥0.75), P2 (high, ≥0.50), P3 (medium, ≥0.25), P4 (low, <0.25)

**Why we need it:**
Tells the pipeline which areas need the most test coverage. Drives the number of test scenarios generated (via the complexity assessment) and the regression suite prioritisation.

---

#### `bva_engine.py` — Boundary Value Analysis

**What it does:**
For each field spec extracted from the user story, generates test cases at the exact boundaries:
- Numeric: min-1, min, min+1, typical, max-1, max, max+1, zero, negative
- String: empty, 1 char, min-1, min, max, max+1, all spaces, special chars, SQL injection, XSS
- Date: past, today, future, invalid formats
- Enum: each valid value, invalid value, null/empty

**Why we need it:**
The majority of real bugs occur at boundary conditions (off-by-one errors, overflow, empty input). BVA systematically covers these without relying on a human to think of them.

---

#### `ep_engine.py` — Equivalence Partitioning

**What it does:**
Groups inputs into equivalence classes (valid and invalid) and generates one representative test per class. For a numeric field 1–100: valid class is [1,100], invalid classes are [<1] and [>100]. Tests one value from each class.

**Why we need it:**
Reduces the number of tests needed. Instead of testing every possible value, you test one representative from each class. Combined with BVA, you get both coverage and efficiency.

---

#### `state_transition.py` — State Machine Testing

**What it does:**
If the user story describes a state machine (order statuses, user account states, payment states), this engine:
1. Infers the state machine from keywords in the description
2. Generates 0-switch tests (each valid transition)
3. Generates N-switch tests (sequences of transitions up to length 3)
4. Generates invalid transition tests (try to go from a state to an unreachable state)

**Why we need it:**
State-related bugs (wrong state after an action, invalid state transitions allowed) are common and hard to find without systematic coverage of all paths through the state machine.

---

#### `pairwise_engine.py` — Pairwise / AllPairs Testing

**What it does:**
For features with multiple parameters (e.g., payment_method × currency × discount_type), generates the minimum set of test cases that covers every pair of values at least once. Uses a greedy AllPairs algorithm with `seed=42` for deterministic output.

**Why we need it:**
Testing all combinations (full factorial) is exponential. AllPairs reduces this to roughly O(n log n) tests while still catching most interaction bugs, which is where a large percentage of real defects occur.

---

#### `decision_table.py` — Decision Table Builder

**What it does:**
Infers boolean conditions from the user story (e.g., "user is authenticated", "cart is empty", "discount is valid") and generates all 2^n combinations as test cases, each with its expected action.

**Why we need it:**
Business logic often has complex if/else conditions. Decision tables make every combination explicit and ensure no combination is untested.

---

#### `bug_intelligence.py` — Historical Bug Pattern Matching

**What it does:**
Compares the current feature against every bug in the knowledge graph to find similar past bugs. Similarity is measured by:
- Module/feature name overlap
- Keyword matching in description
- Root cause pattern matching (authentication bugs, race conditions, data validation bugs, etc.)

Generates HEADS-UP warnings like: "This feature touches the Payment module, which previously had a critical race condition bug in concurrent processing."

**Why we need it:**
Teams repeat the same bugs. Bug intelligence surfaces historical patterns so the QA team knows exactly where to look for recurring defects before testing even begins.

---

#### `regression_analyzer.py` — Regression Suite Builder

**What it does:**
Identifies which existing test cases (from the knowledge graph) need to run again after this change. Triggers on: same module, same feature, shared API endpoint, shared event, or `critical` flag on the test case. Splits into MUST-RUN and SHOULD-RUN buckets.

**Why we need it:**
Without regression guidance, teams either re-run everything (slow) or nothing (risky). This targets the regression suite to only what is actually impacted by the change.

---

#### `event_flow_tracer.py` — End-to-End Flow Tracing

**What it does:**
Traces the complete request lifecycle through 6 layers:
```
UI → API → DB → Event → Consumer → Notification
```
At each layer it identifies: the component, the action, and what to validate. Generates a test case per layer step.

**Why we need it:**
Integration bugs live at layer boundaries. Having an explicit end-to-end trace means the QA plan covers the full flow, not just the feature in isolation.

---

#### `coverage_analyzer.py` — Coverage Gap Finder

**What it does:**
Compares what tests exist in the graph against what the system has (features, APIs, events, states, bug-prone areas) and reports gaps:
- Features with no tests
- APIs with no tests
- Events with no consumer tests
- Missing test types (no negative tests, no security tests, no performance tests)
- Areas with recurring bugs but no regression tests
- States with no transition tests

**Why we need it:**
Coverage gaps are invisible until something breaks in production. This makes them visible before testing begins.

---

### `backend/test_generator/` — LLM Formatting Layer (Brain 3, Part 2)

---

#### `test_generator/prompt_templates.py` — Prompt Templates

**What it does:**
Contains the 6 structured prompts sent to the LLM. Each prompt passes analytical data as input and asks the LLM to format it.

| Template                       | Purpose                                              |
|--------------------------------|------------------------------------------------------|
| `SYSTEM_PROMPT`                | Sets the LLM role as Senior QA Architect             |
| `FEATURE_UNDERSTANDING_PROMPT` | Summarise feature from story + RAG context           |
| `GHERKIN_GENERATION_PROMPT`    | Convert analytical scenarios → Gherkin BDD           |
| `EDGE_CASE_PROMPT`             | Generate N edge cases from BVA/EP/bug data           |
| `SIGNOFF_CHECKLIST_PROMPT`     | Generate QA sign-off checklist from risk/coverage    |
| `API_VALIDATION_PROMPT`        | Generate API test scenarios from contract data       |

**Why we need it:**
Prompts are the interface between structured analytical data and human-readable output. Separating them from the LLM client means prompts can be edited, versioned, and tuned without touching the client code.

---

#### `test_generator/llm_client.py` — LLM Client

**What it does:**
Wraps the DeepInfra LLM API via LangChain. Key behaviours:
- `temperature=0` and `seed=42` on all calls → **deterministic output** (same question = same answer every time)
- `generate_json()` → parses LLM output as JSON, strips markdown fences, falls back gracefully
- `generate_gherkin()` → parses freeform Gherkin text into structured `{scenario_title, given, when, then, tags}` objects
- Default fallbacks → if LLM is unavailable, returns sensible structural defaults rather than crashing

**Why we need it:**
All LLM calls go through here. Having one client means one place to change the model, the temperature, the retry logic, and the JSON parsing. No raw LLM calls anywhere else in the codebase.

---

### `backend/orchestrator/` — The Pipeline

---

#### `orchestrator/qa_pipeline.py` — Three-Brain Pipeline

**What it does:**
This is the main brain of the system. `qa_pipeline.run(user_story)` executes the complete pipeline and returns the 12-section result. Steps:

1. Extract feature name and infer module from story
2. **Brain 1**: Query graph for modules, bugs, APIs, events, states, test cases
3. **Brain 2**: Run all 10 analytical engines in sequence
4. **Complexity assessment**: Score the feature → simple / moderate / complex → scale test budgets
5. **Brain 3**: RAG retrieval, then LLM calls for understanding, Gherkin, edge cases, checklist
6. Assemble 12-section result

**Complexity assessment** — scales everything automatically:

| Complexity | Score | BVA | EP | Gherkin | Edge Cases |
|------------|-------|-----|----|---------|------------|
| Simple     | 0–5   | 4   | 3  | 5       | 4          |
| Moderate   | 6–10  | 10  | 8  | 12      | 8          |
| Complex    | 11+   | 15  | 12 | 20      | 15         |

**Why we need it:**
Without an orchestrator, the three brains would need to be wired together in the route handler. The pipeline encapsulates all sequencing, error handling, and data passing between the three brains in one place.

---

### `backend/api/` — HTTP Layer

---

#### `api/routes/ingest.py` — Document Ingestion Endpoints

| Endpoint          | Method | Purpose                                    |
|-------------------|--------|--------------------------------------------|
| `/ingest/text`    | POST   | Ingest raw text                            |
| `/ingest/json`    | POST   | Ingest structured JSON (user story, bug)   |
| `/ingest/file`    | POST   | Upload file (PDF, DOCX, XLSX, etc.)        |
| `/ingest/status`  | GET    | Show vector store chunk count + graph stats|

**Key design:** Embedding (slow) runs in a thread. Graph build (very slow — LLM call) runs as a FastAPI `BackgroundTask`. The HTTP response returns immediately after chunks are stored, so uploads never time out.

---

#### `api/routes/generate_tests.py` — Test Generation Endpoints

| Endpoint                   | Method | Purpose                            |
|----------------------------|--------|------------------------------------|
| `/generate-tests/`         | POST   | Full 12-section QA report          |
| `/generate-tests/stream`   | POST   | Same, but streamed as SSE events   |
| `/generate-tests/gherkin-only` | POST | Lightweight — Gherkin only     |

---

#### `api/routes/analyze.py` — Analysis Endpoints

| Endpoint              | Method | Purpose                           |
|-----------------------|--------|-----------------------------------|
| `/analyze/`           | POST   | Run three-brain pipeline (alias)  |
| `/analyze/graph-stats`| GET    | Node/relationship counts for UI   |

---

#### `api/models/request_models.py` — Request Validation

Pydantic models that validate all incoming API requests. Key model:

```python
class GenerateTestsRequest:
    user_story: str
    module_name: str = ""
    priority: str = "medium"
    include_gherkin: bool = True
    include_regression: bool = True
    include_api_validation: bool = True
    risk_threshold: float = 0.1
    max_scenarios: int = 60
```

---

#### `api/models/response_models.py` — Response Schemas

Pydantic models that define the shape of all API responses. The 12-section QA report is fully typed here, ensuring the frontend always gets a consistent structure even when parts of the analysis fail.

---

### `frontend/streamlit_app.py` — The Web UI

**What it does:**
Three-tab Streamlit web application:

**Sidebar:**
- API health check (polls `/health` every load)
- Knowledge base stats (total chunks, total graph nodes, source list)
- "Load All Sample Data" button

**Tab 1 — Ingest:**
- Multi-file uploader (PDF, DOCX, XLSX, TXT, JSON, YAML)
- Auto-detects document type from filename keywords
- Shows per-file result after ingestion

**Tab 2 — Analyze & Generate:**
- User story text input
- Options: module, priority, include gherkin/regression/API, risk threshold
- "Run QA Analysis" button → calls `/generate-tests/`
- Renders all 12 sections as expandable panels with download buttons

**Tab 3 — Knowledge Graph:**
- Displays node/relationship counts from graph stats endpoint
- Link to Neo4j Browser for visual graph exploration

**Why we need it:**
The backend is a pure API. Without a UI, you would need to call every endpoint via curl or Postman. Streamlit provides a zero-setup web interface that non-technical QA teams can use directly.

---

## The 12 Output Sections

Every analysis produces these 12 sections:

| # | Section                     | Source                          |
|---|-----------------------------|---------------------------------|
| 1 | Feature Understanding       | LLM (Brain 3) + RAG context     |
| 2 | Impacted Modules            | Knowledge Graph (Brain 1)       |
| 3 | End-to-End Event Flow       | Event Flow Tracer (Brain 2)     |
| 4 | Risk Areas                  | Risk Engine (Brain 2)           |
| 5 | HEADS-UP Warnings           | Bug Intelligence (Brain 2)      |
| 6 | Test Scenarios              | BVA + EP + Pairwise + DT + State (Brain 2) |
| 7 | Gherkin Test Cases          | LLM formatting of scenarios (Brain 3) |
| 8 | Regression Suite            | Regression Analyzer (Brain 2)   |
| 9 | Test Cases to Update        | Regression Analyzer (Brain 2)   |
| 10 | Missing Coverage            | Coverage Analyzer (Brain 2)    |
| 11 | API + Event Validation      | LLM + API contracts (Brain 3)  |
| 12 | QA Sign-off Checklist       | LLM (Brain 3)                  |

---

## Data Flow — From Upload to Test Case

```
1. You upload a PDF (e.g., API_Documentation.pdf)
        │
        ▼
2. document_loader._load_pdf()
   → Extracts all page text via PyPDF2
        │
        ▼
3. chunker.chunk()
   → Detects doc_type from filename keyword "api"
   → Splits text by ## headings
   → Applies semantic refinement
   → Adds metadata: source_id, section, chunk_index
   → Adds sentence-level overlap between chunks
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
4. vector_store.add_chunks()        [BackgroundTask]
   → Embeds each chunk with         entity_extractor.extract()
     BAAI/bge-large-en-v1.5         → LLM extracts Module, API,
   → Stores in ChromaDB               Feature nodes
   → HTTP response returned          relationship_builder.ingest()
                                    → Writes to graph
```

```
5. You type a user story and click "Run QA Analysis"
        │
        ▼
6. qa_pipeline.run(user_story)
        │
        ├── Brain 1: graph.full_impact_analysis(feature_name)
        │   → finds related modules, bugs, APIs, events, states
        │
        ├── Brain 2: 10 engines run in sequence
        │   → risk scores, BVA/EP tests, pairwise, decision table,
        │     state tests, bug warnings, event flow, coverage gaps,
        │     regression list
        │
        ├── _assess_complexity() → "complex" (score: 14)
        │   → sets test budgets: BVA=15, EP=12, Gherkin=20, etc.
        │
        └── Brain 3: retriever.retrieve() + 6 LLM calls
            → feature understanding, Gherkin, edge cases,
              API validations, sign-off checklist
        │
        ▼
7. 12-section JSON response → rendered in Streamlit
```

---

## Models Used

| Model | Provider | Used For |
|-------|----------|----------|
| `openai/gpt-oss-120b` | DeepInfra | Main reasoning: feature understanding, Gherkin, edge cases, checklists |
| `BAAI/bge-large-en-v1.5` | DeepInfra | Document embeddings (1024 dimensions) |
| `meta-llama/Meta-Llama-3.1-8B-Instruct` | DeepInfra | Entity extraction from documents (fast, background) |

All three use the DeepInfra OpenAI-compatible endpoint. Configuration in `.env`.

---

## Running the Application

**Backend:**
```bash
source .venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
source .venv/bin/activate
streamlit run frontend/streamlit_app.py --server.port 8502
```

**Health check:**
```bash
curl http://localhost:8000/health
```

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| LLM temperature=0, seed=42 | Same question always produces the same output |
| BackgroundTask for graph build | Entity extraction (LLM) takes 30–60s. HTTP can't wait that long |
| asyncio.to_thread for embedding | Embedding is CPU/IO bound; running it in a thread prevents blocking the event loop |
| NetworkX as default graph | No external server needed for development or small teams |
| Structure-aware chunking | Fixed-size chunking splits semantic units (an endpoint, a requirement) at random positions, degrading retrieval quality |
| LLM formats, does not invent | All test logic comes from deterministic Brain 2. LLM only makes it readable. This prevents hallucinated test cases |
| Complexity-based scenario scaling | Simple feature + 20 test cases = noise. Complex feature + 5 test cases = risk. The system self-calibrates |
