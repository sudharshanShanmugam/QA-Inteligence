# QA Intelligence — Three-Brain Architecture

An AI-powered QA test plan generator that **thinks** before generating tests.
It combines a Knowledge Graph, a RAG Engine, and an LLM pipeline to produce
structured, traceable, risk-driven QA outputs — all running **fully local**.

---

## Live URLs

| Service | URL |
|---|---|
| **Frontend (Next.js)** | http://localhost:3030 |
| **Backend (FastAPI)** | http://localhost:8000 |
| **API Docs (Swagger)** | http://localhost:8000/docs |

---

## Architecture

```
User Story Input
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 1 — RAG Engine (ChromaDB)                        │
│  • Ingested docs: BRD, SRS, API contracts, DB schemas,  │
│    bug reports, test cases, user stories                 │
│  • Semantic search → retrieves relevant context chunks  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 2 — Graph Brain (Neo4j / NetworkX)               │
│  • Entities: Module, Feature, API, Bug, TestCase,       │
│    Event, DBTable, State, UserJourney, BusinessRule      │
│  • Impact analysis, bug patterns, dependency mapping    │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  BRAIN 3 — LLM Brain (Ollama local)                     │
│  • Formats intelligence into human-readable output      │
│  • Generates Gherkin, risk scoring, test scenarios      │
│  • Anti-hallucination: LLM formats, never invents       │
└─────────────────────────────────────────────────────────┘
      │
      ▼
10-Section Structured QA Output + Export to Excel
```

---

## Features

- 📁 **Multi-project workspace** — create isolated projects, each with their own KB
- 📄 **Document ingestion** — PDF, DOCX, TXT, MD, JSON, YAML, SQL, XLSX
- 🧠 **Three-Brain pipeline** — RAG + Graph + LLM working together
- 🎯 **Clarifying questions** — AI asks before generating to sharpen coverage
- 📊 **Rich results** — 10 sections with sticky TOC navigation
- 📜 **Analysis history** — every run persisted to disk, delete when you want
- 📤 **Export to Excel** — 7-sheet workbook (scenarios, Gherkin, risks, regression, API, gaps)
- 🤖 **QA Chat assistant** — session-scoped chatbot, QA & document questions only
- 🌙 **Dark mode** — full light/dark theme toggle
- 🔄 **Baseline compare** — diff two analysis runs side-by-side

---

## Output Sections

| # | Section | Description |
|---|---|---|
| 1 | Feature Understanding | What the feature does, business rules, key flows |
| 2 | Impacted Modules | Direct and transitive dependency impact |
| 3 | Event Flow | End-to-end: UI → API → DB → Event → Notification |
| 4 | Risk Areas | Scored P1–P4 with reasons |
| 5 | Heads-Up Warnings | Pattern-matched warnings from historical bugs |
| 6 | Test Scenarios | BVA, EP, State, Edge cases |
| 7 | Gherkin Test Cases | BDD Given/When/Then with tags |
| 8 | Regression Suite | Must-run existing tests with reasons |
| 9 | Coverage Gaps | Missing areas and recommendations |
| 10 | API & Event Validation | Per-endpoint validation checklist |

---

## Tech Stack

### Frontend
| | |
|---|---|
| Framework | **Next.js 16** (App Router, TypeScript) |
| UI library | **MUI v9** (Material UI) |
| Styling | **Tailwind CSS** |
| Port | **3030** |

### Backend
| | |
|---|---|
| API framework | **FastAPI** (Python) |
| Server | **Uvicorn** |
| LLM | **Ollama** (local) via LangChain |
| Vector DB | **ChromaDB** (file-based) |
| Graph DB | **Neo4j** (optional) |
| Storage | JSON files (projects + analysis history) |
| Excel export | **openpyxl** |
| Port | **8000** |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Ollama** running locally

```bash
# Pull required models
ollama pull llama3
ollama pull nomic-embed-text
```

- **Neo4j** *(optional — falls back to NetworkX if unavailable)*

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd QA-Inteligence

# Backend dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend dependencies
cd frontend/web
npm install
cd ../..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set your LLM model, Neo4j credentials if using Neo4j
```

### 3. Start Ollama

```bash
ollama serve   # in a separate terminal
```

### 4. Start the backend

```bash
# From project root
.venv/bin/uvicorn backend.api:app --port 8000 --reload
```

### 5. Start the frontend

```bash
cd frontend/web
npm run dev      # runs on http://localhost:3030
```

### 6. Open the app

→ **http://localhost:3030**

---

## Using the App

### Step 1 — Create a Project
- Click **New Project** on the dashboard
- Give it a name (e.g. "Checkout Feature", "User Auth")

### Step 2 — Ingest Documents *(optional but recommended)*
- Go to the **Ingest** tab inside the project
- Upload: BRD, SRS, API contracts, DB schemas, bug reports, existing test cases
- Accepted formats: PDF, DOCX, TXT, MD, JSON, YAML, SQL, XLSX
- More documents = more grounded, specific test output

### Step 3 — Analyze & Generate
- Go to the **Analyze & Generate** tab
- Paste a user story or feature description
- Click **Run QA Analysis** (or `⌘ + Enter`)
- Answer the clarifying questions (or skip)
- Get a full 10-section test plan

### Step 4 — Export & Edit
- Click **Export to Excel** in the results panel
- Edit the exported workbook — add missing scenarios, fix steps, update expected results
- Re-ingest the edited file as **Test Cases** doc type
- Re-run analysis for improved, KB-grounded output

### Step 5 — Chat Assistant
- Click the 🤖 floating button (bottom-right)
- Ask about your documents, test coverage, or QA strategy
- Chat history persists for the session

---

## API Endpoints

### Projects
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| DELETE | `/api/projects/{id}` | Delete project |
| GET | `/api/projects/{id}/kb/status` | KB status (chunks, nodes, sources) |
| DELETE | `/api/projects/{id}/kb` | Clear knowledge base |

### Ingest
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/{id}/ingest` | Upload documents |

### Analyze
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/{id}/clarify` | Get clarifying questions |
| POST | `/api/projects/{id}/analyze` | Run full analysis |
| GET | `/api/projects/{id}/analyses` | List analysis history |
| DELETE | `/api/projects/{id}/analyses` | Clear all history |
| DELETE | `/api/projects/{id}/analyses/{aid}` | Delete one analysis |

### Export
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/{id}/export/excel` | Export analysis as Excel |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects/{id}/chat` | Streaming QA chat |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | LLM model + token usage |
| POST | `/api/settings/reset-usage` | Reset global token counters |
| GET | `/api/projects/{id}/usage` | Per-project token usage + cost |
| POST | `/api/projects/{id}/usage/reset` | Reset project usage |

---

## Project Structure

```
QA-Inteligence/
├── backend/
│   ├── api.py                     # FastAPI routes (all endpoints)
│   ├── config.py                  # Settings (env-driven)
│   ├── project_manager.py         # Project CRUD
│   ├── data/
│   │   ├── projects.json          # Project metadata
│   │   └── analyses/              # Per-project analysis history
│   ├── ingestion/
│   │   ├── document_loader.py     # Multi-format document parsing
│   │   └── chunker.py             # Semantic text chunking
│   ├── rag_engine/
│   │   ├── vector_store.py        # ChromaDB vector store
│   │   └── retriever.py           # Semantic search + context building
│   ├── graph_builder/
│   │   ├── neo4j_client.py        # Neo4j / NetworkX dual adapter
│   │   ├── entity_extractor.py    # LLM entity extraction
│   │   ├── relationship_builder.py
│   │   └── graph_queries.py       # Impact analysis queries
│   ├── orchestrator/
│   │   └── qa_pipeline.py         # Three-brain orchestration
│   └── test_generator/
│       ├── llm_client.py          # Ollama LLM client + chat filter
│       └── prompt_templates.py    # Structured prompts
│
├── frontend/
│   └── web/                       # Next.js 16 app
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx           # Dashboard (project list)
│       │   │   └── projects/[id]/     # Project workspace
│       │   ├── components/
│       │   │   ├── AnalyzeTab.tsx     # Analyze & Generate tab
│       │   │   ├── IngestTab.tsx      # Document upload tab
│       │   │   ├── ChatTab.tsx        # QA chat assistant
│       │   │   ├── Sidebar.tsx        # KB stats + token usage
│       │   │   └── results/
│       │   │       ├── ResultsPanel.tsx   # 10-section results + export
│       │   │       └── ComparePanel.tsx   # Baseline diff view
│       │   ├── lib/
│       │   │   ├── api.ts             # All API calls
│       │   │   └── theme.ts           # MUI light/dark theme
│       │   └── contexts/
│       │       └── ThemeMode.tsx      # Dark mode context
│       └── package.json
│
├── .env                           # Environment config
├── requirements.txt               # Python dependencies
└── README.md
```

---

## Environment Variables

```env
# LLM
LLM_MODEL=openai/gpt-oss-120b-Turbo
EMBED_MODEL=BAAI/bge-large-en-v1.5
ENTITY_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
OLLAMA_BASE_URL=http://localhost:11434

# Neo4j (optional)
USE_NEO4J=false
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

---

## Design Principles

1. **LLM formats, it does not invent** — all test scenarios are derived from your documents and analytical engine. The LLM only converts structured data into readable output.

2. **Every test is traceable** — each scenario carries `Feature → Risk → Test` traceability.

3. **Past bugs are primary intelligence** — bug history drives risk scores, warnings, and regression selection.

4. **Graceful degradation** — works without Neo4j (uses NetworkX fallback) and produces useful output even with an empty knowledge base.

5. **Fully local** — no data leaves your machine. All AI runs via Ollama locally.
