# QA Intelligence System – Three-Brain Architecture

A production-grade AI-powered QA system that **thinks** before generating tests.
It combines a Knowledge Graph, an Analytical Engine, and an LLM/RAG pipeline
to produce structured, traceable, risk-driven QA outputs.

---

## Architecture

```
User Story Input
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 1: Knowledge Graph (Neo4j / NetworkX)            │
│  • Entities: Module, Feature, API, Bug, TestCase,       │
│    Event, DBTable, State, UserJourney, BusinessRule      │
│  • Relationships: DEPENDS_ON, TRIGGERS, VALIDATES,      │
│    FOUND_IN, UPDATES, SPANS, TRANSITIONS_TO ...         │
│  • Queries: Impact analysis, bug patterns, test traces   │
└─────────────────────────────────────────────────────────┘
     │  graph_data (bugs, APIs, events, impacted modules)
     ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 2: Analytical Engine                             │
│  • Boundary Value Analysis (BVA)                        │
│  • Equivalence Partitioning (EP)                        │
│  • State Transition Testing                             │
│  • Pairwise / AllPairs Testing                          │
│  • Decision Table Analysis                              │
│  • Risk Engine (bug density × criticality × impact)     │
│  • Regression Analyzer (impact-based test selection)    │
│  • Event Flow Tracer (UI→API→DB→Event→Notification)     │
│  • Bug Intelligence (pattern matching + HEADS-UP)       │
│  • Coverage Analyzer (gap detection)                    │
└─────────────────────────────────────────────────────────┘
     │  analytical_data (scenarios, risks, warnings, gaps)
     ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 3: LLM + RAG (Ollama + ChromaDB)                │
│  • RAG: retrieve relevant SRS/BRD/bug/API chunks        │
│  • LLM: format analytical data into human output        │
│  • Generates: Gherkin, Edge cases, Sign-off checklist   │
└─────────────────────────────────────────────────────────┘
     │
     ▼
12-Section Structured QA Output
```

---

## Output Format (12 Sections)

1. **Feature Understanding** – What the feature does, who uses it, key rules
2. **Impacted Modules** – Direct and transitive dependency impact
3. **Event Flow** – End-to-end trace: UI → API → DB → Event → Consumer → Notification
4. **Risk Areas** – Scored P1-P4 with reasons (past bugs × criticality × impact)
5. **HEADS-UP Warnings** – Pattern-matched warnings from historical bug data
6. **Test Scenarios** – BVA + EP + Pairwise + State + Decision Table + Flow tests
7. **Gherkin Test Cases** – BDD format with Given/When/Then and @tags
8. **Regression Suite** – MUST-RUN and SHOULD-RUN existing tests with reasons
9. **Test Cases to UPDATE** – Tests that need assertion/step changes
10. **Missing Coverage** – Feature gaps, API gaps, state gaps, missing negatives
11. **API + Event Validation** – Per-endpoint validation checklist
12. **QA Sign-off Checklist** – Category-grouped checklist (Functional/Regression/Security/Data)

---

## Prerequisites

### Required
- **Python 3.11+**
- **Ollama** running locally with models pulled:
  ```bash
  ollama pull llama3
  ollama pull nomic-embed-text
  ```

### Optional
- **Neo4j** (defaults to built-in NetworkX graph if unavailable)
- **Docker** (for containerised deployment)

---

## Quick Start (Local)

### 1. Clone and install

```bash
cd QA-intelligence
pip install -r requirements.txt
```

### 2. Configure environment

```bash
copy .env.example .env
# Edit .env if needed (default: USE_NEO4J=false, Ollama on localhost:11434)
```

### 3. Start Ollama

```bash
# In a separate terminal
ollama serve
```

### 4. Start the backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Start the frontend

```bash
# In a separate terminal
cd frontend
streamlit run streamlit_app.py
```

### 6. Open the UI

- **Frontend:** http://localhost:8501
- **API Docs:** http://localhost:8000/docs

---

## Load Sample Data

In the Streamlit UI → Sidebar → click **"Load All Sample Data"**

Or via API:

```bash
# Ingest bug history
curl -X POST http://localhost:8000/ingest/json \
  -H "Content-Type: application/json" \
  -d @backend/sample_data/bug_history_sample.json

# Check knowledge base
curl http://localhost:8000/ingest/status
```

---

## Run Analysis

### Via UI
1. Open http://localhost:8501
2. Go to **Analyze & Generate** tab
3. Paste a user story
4. Click **Run QA Analysis**

### Via API

```bash
curl -X POST http://localhost:8000/generate-tests/ \
  -H "Content-Type: application/json" \
  -d '{
    "user_story": "As a customer, I want to apply a discount coupon at checkout so that I save money",
    "module_name": "Checkout",
    "include_gherkin": true,
    "include_regression": true
  }'
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest/text` | Ingest plain text document |
| POST | `/ingest/json` | Ingest structured JSON document |
| POST | `/ingest/file` | Ingest file upload (PDF/DOCX/TXT) |
| GET  | `/ingest/status` | Knowledge base status |
| POST | `/analyze/` | Run QA analysis (graph + analytics only) |
| GET  | `/analyze/graph-stats` | Knowledge graph statistics |
| POST | `/generate-tests/` | Full test generation (all 3 brains) |
| POST | `/generate-tests/stream` | Streaming test generation (SSE) |
| POST | `/generate-tests/gherkin-only` | Gherkin test cases only |
| GET  | `/health` | System health check |
| GET  | `/docs` | Swagger UI |

---

## Docker Deployment

```bash
# Start all services (Neo4j + Backend + Frontend)
cd docker
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

Services:
- Frontend:  http://localhost:8501
- Backend:   http://localhost:8000
- Neo4j:     http://localhost:7474

---

## Project Structure

```
QA-intelligence/
├── backend/
│   ├── main.py                        # FastAPI application
│   ├── config.py                      # Settings (env-driven)
│   ├── ingestion/
│   │   ├── document_loader.py         # Multi-format document loading
│   │   ├── chunker.py                 # Semantic text chunking
│   │   └── schema_parser.py           # DB schema + API contract parsing
│   ├── graph_builder/
│   │   ├── neo4j_client.py            # Dual adapter (Neo4j + NetworkX)
│   │   ├── entity_extractor.py        # LLM-powered entity extraction
│   │   ├── relationship_builder.py    # Graph ingestion
│   │   ├── graph_schema.py            # Node/relationship schema definitions
│   │   └── graph_queries.py           # Impact analysis, bug queries
│   ├── analytics_engine/
│   │   ├── risk_engine.py             # Risk scoring (P1-P4)
│   │   ├── bva_engine.py              # Boundary Value Analysis
│   │   ├── ep_engine.py               # Equivalence Partitioning
│   │   ├── state_transition.py        # State machine test generation
│   │   ├── pairwise_engine.py         # AllPairs algorithm
│   │   ├── decision_table.py          # Decision table builder
│   │   ├── bug_intelligence.py        # Pattern matching + HEADS-UP
│   │   ├── regression_analyzer.py     # Impact-based regression selection
│   │   ├── event_flow_tracer.py       # E2E flow tracing
│   │   └── coverage_analyzer.py       # Coverage gap detection
│   ├── rag_engine/
│   │   ├── vector_store.py            # ChromaDB wrapper
│   │   └── retriever.py               # Semantic search + context building
│   ├── test_generator/
│   │   ├── llm_client.py              # Ollama LLM client
│   │   └── prompt_templates.py        # Structured prompts
│   ├── orchestrator/
│   │   └── qa_pipeline.py             # Three-brain orchestration
│   ├── api/
│   │   ├── models/                    # Pydantic request/response models
│   │   └── routes/                    # FastAPI route handlers
│   └── sample_data/                   # Sample BRD, bugs, APIs, schemas
├── frontend/
│   └── streamlit_app.py              # Streamlit UI (12-section display)
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── requirements.txt
└── .env.example
```

---

## Key Design Principles

1. **LLM formats, it does not invent** – All test scenarios come from the analytical engine and knowledge graph. LLM only converts structured data into human-readable output (Gherkin, prose, checklists).

2. **Every test is traceable** – Each scenario carries `traceability: Feature → Risk → Test`

3. **Past bugs are primary intelligence** – Bug history drives risk scores, HEADS-UP warnings, and regression selection.

4. **Graceful degradation** – System works without Neo4j (uses NetworkX) and without Ollama (uses rule-based fallbacks).

5. **Zero generic tests** – All tests are derived from your actual documents, not generic templates.
