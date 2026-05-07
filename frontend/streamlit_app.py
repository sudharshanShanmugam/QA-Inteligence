"""
QA Intelligence System – Streamlit Frontend (standalone, no API server needed)
"""

import json
import os
import sys
import tempfile
import threading
import concurrent.futures
import streamlit as st
from pathlib import Path

# Make backend modules importable directly
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from config import settings
from ingestion.document_loader import document_loader
from ingestion.chunker import chunker
from rag_engine.vector_store import vector_store
from graph_builder.entity_extractor import entity_extractor
from graph_builder.relationship_builder import relationship_builder
from graph_builder.neo4j_client import get_graph
from graph_builder.graph_queries import GraphQueryEngine
from orchestrator.qa_pipeline import qa_pipeline
from test_generator.llm_client import llm_client

st.set_page_config(
    page_title="QA Intelligence System",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── CSS ─────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .risk-p1 { background: #ff4444; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; }
    .risk-p2 { background: #ff8800; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; }
    .risk-p3 { background: #ffcc00; color: black; padding: 4px 10px; border-radius: 4px; font-weight: bold; }
    .risk-p4 { background: #44cc44; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; }
    .section-header { font-size: 1.1rem; font-weight: bold; margin-top: 1rem; border-left: 4px solid #4a90e2; padding-left: 8px; }
    .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin: 4px 0; }
    .gherkin-box { background: #1a1a2e; color: #e0e0e0; padding: 16px; border-radius: 6px; font-family: monospace; font-size: 0.85rem; }
    .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; padding: 12px; border-radius: 6px; text-align: center; }
</style>
""", unsafe_allow_html=True)


# ─── Core ingestion helpers ───────────────────────────────────────────────────

# Lock ensures concurrent threads never write to the graph simultaneously
_graph_lock = threading.Lock()


def _build_graph(document: dict) -> tuple[int, int]:
    """Extract entities and build knowledge graph. Returns (entities, relationships)."""
    try:
        extraction = entity_extractor.extract(document)
        with _graph_lock:
            result = relationship_builder.ingest(extraction, document["source_id"])
        return result["entities"], result["relationships"]
    except Exception:
        return 0, 0


def _build_graph_timed(document: dict, timeout: int = 20) -> tuple[int, int, bool]:
    """Run graph build with a hard timeout. Returns (entities, rels, timed_out)."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_build_graph, document)
        try:
            entities, rels = future.result(timeout=timeout)
            return entities, rels, False
        except concurrent.futures.TimeoutError:
            return 0, 0, True
        except Exception:
            return 0, 0, False


def _ingest_document(document: dict) -> dict:
    """Chunk, embed, and build graph for a document. Returns summary counts."""
    chunks = chunker.chunk(document)
    chunks_stored = vector_store.add_chunks(chunks)
    entities, rels = _build_graph(document)
    return {"chunks_stored": chunks_stored, "entities_extracted": entities, "relationships_created": rels}


def _process_file_parallel(f_bytes: bytes, filename: str, doc_type: str) -> dict:
    """Full ingestion pipeline for one file — safe to run in a thread.
    Never calls st.* — returns a result dict that the main thread renders."""
    result = {
        "file": filename, "type": doc_type, "status": "PENDING",
        "chunks": 0, "entities": 0, "rels": 0, "steps": [],
    }
    try:
        suffix = "." + filename.split(".")[-1] if "." in filename else ".txt"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(f_bytes)
            tmp_path = tmp.name

        source_id = filename.rsplit(".", 1)[0]
        document = document_loader.load_file(tmp_path, doc_type)
        document["source_id"] = source_id
        os.unlink(tmp_path)
        result["steps"].append("File read")

        # Relevance check
        relevance = llm_client.check_document_relevance(
            content=document.get("content", ""), filename=filename, doc_type=doc_type,
        )
        if not relevance["is_relevant"]:
            result["status"] = "REJECTED"
            result["reason"] = relevance["reason"]
            result["detected_type"] = relevance.get("detected_type", "unknown")
            return result

        result["detected_type"] = relevance.get("detected_type", doc_type)
        result["steps"].append(f"Relevant ({result['detected_type']})")

        # Chunk
        chunks = chunker.chunk(document)
        result["steps"].append(f"Chunked → {len(chunks)} pieces")

        # Embed + store (ChromaDB handles concurrent adds safely)
        chunks_stored = vector_store.add_chunks(chunks)
        result["chunks"] = chunks_stored
        result["steps"].append(f"Stored {chunks_stored} chunks")

        # Entity extraction with 20s cap (graph write is serialised via _graph_lock)
        entities, rels, timed_out = _build_graph_timed(document, timeout=20)
        result["entities"] = entities
        result["rels"] = rels
        result["steps"].append("Graph skipped (slow LLM)" if timed_out else f"Graph: {entities} entities · {rels} rels")

        result["status"] = "OK"

    except Exception as e:
        result["status"] = "FAIL"
        result["error"] = str(e)

    return result




def _kb_status() -> dict:
    try:
        gq = GraphQueryEngine(get_graph())
        graph_stats = gq.get_graph_stats()
    except Exception as e:
        graph_stats = {"error": str(e)}
    return {
        "vector_store": {"total_chunks": vector_store.count(), "sources": vector_store.get_all_sources()},
        "knowledge_graph": graph_stats,
    }


# ─── Helper functions ─────────────────────────────────────────────────────────


def _render_results(result: dict):
    st.divider()

    complexity = result.get("complexity_level", "moderate")
    complexity_colors = {"simple": "#d4edda", "moderate": "#fff3cd", "complex": "#f8d7da"}
    complexity_bg = complexity_colors.get(complexity, "#fff3cd")
    st.markdown(
        f'<div style="background:{complexity_bg}; padding:8px 14px; border-radius:6px; '
        f'margin-bottom:10px; color:#000; font-weight:bold;">'
        f'Feature Complexity: {complexity.upper()}</div>',
        unsafe_allow_html=True,
    )

    with st.expander("SECTION 1: Feature Understanding", expanded=True):
        st.markdown(result.get("feature_understanding", "N/A"))

    with st.expander("SECTION 2: Impacted Modules", expanded=True):
        modules = result.get("impacted_modules", [])
        if modules:
            for m in modules:
                impact = m.get("impact_type", "DIRECT")
                crit = m.get("criticality", 3)
                tag = "[DIRECT]" if impact == "DIRECT" else "[INDIRECT]"
                st.markdown(f"{tag} **{m.get('name', 'Unknown')}** | Impact: `{impact}` | Criticality: `{crit}/5`")
        else:
            st.info("No specific module data in knowledge graph – ingest module documentation first.")

    with st.expander("SECTION 3: End-to-End Event Flow", expanded=False):
        flow = result.get("event_flow", [])
        if flow:
            for step in flow:
                layer = step.get("layer", "")
                st.markdown(f"**[{layer}]** `{step.get('component', '')}` — {step.get('action', '')}")
                st.caption(f"Validate: {step.get('validation_point', '')}")
                st.divider()

    with st.expander("SECTION 4: Risk Areas", expanded=True):
        risks = result.get("risk_areas", [])
        if risks:
            for r in risks:
                prio = r.get("priority", "P4")
                score = r.get("risk_score", 0)
                st.markdown(f"**{prio}** — {r.get('feature', r.get('module', ''))} | Score: `{score:.2f}`")
                for reason in r.get("reasons", []):
                    st.caption(f"  • {reason}")
                st.caption(f"  Past bugs: {r.get('past_bug_count', 0)}")

    with st.expander(f"SECTION 5: HEADS-UP Warnings ({len(result.get('heads_up_warnings', []))})", expanded=True):
        warnings = result.get("heads_up_warnings", [])
        if warnings:
            for w in warnings:
                sev = w.get("severity", "").lower()
                bg = {"critical": "#ffcccc", "blocker": "#ffcccc", "high": "#ffe4cc"}.get(sev, "#fff9cc")
                st.markdown(f"""
                <div style="background:{bg}; padding:10px; border-radius:6px; margin-bottom:8px; color:#000000;">
                    <strong>{w.get('warning', '')}</strong><br/>
                    <em>Bug: {w.get('bug_title', 'N/A')} ({w.get('severity', '?')})</em><br/>
                    {w.get('recommendation', '')}
                </div>""", unsafe_allow_html=True)
        else:
            st.success("No pattern-matched warnings.")

    with st.expander(f"SECTION 6: Test Scenarios ({len(result.get('test_scenarios', []))})", expanded=False):
        scenarios = result.get("test_scenarios", [])
        type_filter = st.multiselect(
            "Filter by type",
            ["boundary_value", "equivalence_partition", "pairwise", "decision_table",
             "state_transition", "event_flow", "edge_case"],
            default=[], key="scenario_filter",
        )
        filtered = [s for s in scenarios if not type_filter or s.get("type") in type_filter]
        for s in filtered[:30]:
            stype = s.get("type", "").replace("_", " ").upper()
            risk_level = s.get("risk_level", "low").upper()
            with st.expander(f"[{risk_level}] [{stype}] {s.get('id', '')} – {s.get('title', '')[:80]}", expanded=False):
                st.caption(f"Traceability: {s.get('traceability', 'N/A')}")
                if s.get("preconditions"):
                    st.markdown("**Preconditions:**")
                    for p in s["preconditions"]:
                        st.markdown(f"  - {p}")
                st.markdown("**Steps:**")
                for i, step in enumerate(s.get("steps", []), 1):
                    st.markdown(f"  {i}. {step}")
                st.markdown(f"**Expected:** {s.get('expected_result', '')}")

    with st.expander(f"SECTION 7: Gherkin Test Cases ({len(result.get('gherkin_test_cases', []))})", expanded=False):
        for g in result.get("gherkin_test_cases", []):
            tags = " ".join(g.get("tags", []))
            given = "\n".join(f"  {line}" for line in g.get("given", []))
            when  = "\n".join(f"  {line}" for line in g.get("when", []))
            then  = "\n".join(f"  {line}" for line in g.get("then", []))
            st.code(f"{tags}\nScenario: {g.get('scenario_title', '')}\n{given}\n{when}\n{then}", language="gherkin")

    with st.expander(f"SECTION 8: Regression Suite ({len(result.get('regression_suite', []))})", expanded=False):
        regression = result.get("regression_suite", [])
        if regression:
            must = [r for r in regression if r.get("priority") == "MUST-RUN"]
            should = [r for r in regression if r.get("priority") == "SHOULD-RUN"]
            st.markdown(f"**MUST-RUN:** {len(must)} | **SHOULD-RUN:** {len(should)}")
            for r in regression:
                prio_tag = "[MUST-RUN]" if r.get("priority") == "MUST-RUN" else "[SHOULD-RUN]"
                st.markdown(f"{prio_tag} `{r.get('test_case_id', '')}` — {r.get('test_case_name', '')}")
                st.caption(f"Reason: {r.get('reason', '')}")
        else:
            st.info("No existing test cases in graph. Ingest test cases to see regression recommendations.")

    with st.expander(f"SECTION 9: Test Cases to UPDATE ({len(result.get('test_cases_to_update', []))})", expanded=False):
        for u in result.get("test_cases_to_update", []):
            st.markdown(f"`{u.get('test_case_id', '')}` — {u.get('test_case_name', '')}")
            st.caption(f"Update reason: {u.get('update_reason', '')}")

    with st.expander(f"SECTION 10: Missing Coverage ({len(result.get('missing_coverage', []))})", expanded=True):
        for gap in result.get("missing_coverage", []):
            gap_type = gap.get("gap_type", "").replace("_", " ").upper()
            st.markdown(f"[{gap_type}] **{gap.get('area', '')}** — {gap.get('description', '')}")
            st.caption(f"{gap.get('recommendation', '')}")

    with st.expander(f"SECTION 11: API + Event Validation ({len(result.get('api_event_validation', []))})", expanded=False):
        for api in result.get("api_event_validation", []):
            st.markdown(f"**`{api.get('method', '')} {api.get('endpoint', '')}`**")
            for v in api.get("validations", []):
                st.markdown(f"  - {v}")
            if api.get("event_triggers"):
                st.caption(f"Events published: {', '.join(api['event_triggers'])}")
            st.divider()

    st.divider()
    col_exp1, col_exp2 = st.columns(2)
    with col_exp1:
        st.download_button(
            "Export Full Report (JSON)",
            data=json.dumps(result, indent=2, default=str),
            file_name=f"qa_report_{result.get('generated_at', 'report')[:10]}.json",
            mime="application/json",
        )
    with col_exp2:
        md_lines = [
            f"# QA Intelligence Report\n\n**Feature:** {result.get('feature_name', 'Unknown')}\n\n",
            f"**Risk:** {result.get('overall_risk')} | **Generated:** {result.get('generated_at', '')}\n\n",
            f"## Feature Understanding\n{result.get('feature_understanding', '')}\n\n## Risk Areas\n",
        ]
        for r in result.get("risk_areas", []):
            md_lines.append(f"- **{r.get('priority')}** {r.get('feature', r.get('module', ''))} (score: {r.get('risk_score', 0):.2f})\n")
        st.download_button(
            "Export Report (Markdown)",
            data="".join(md_lines),
            file_name="qa_report.md",
            mime="text/markdown",
        )


# ─── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("QA Intelligence")
    st.caption("Three-Brain QA Architecture")
    st.divider()

    st.success(f"Model: {settings.LLM_MODEL}")

    st.divider()

    # Knowledge base status
    st.subheader("Knowledge Base")
    try:
        status = _kb_status()
        vs = status.get("vector_store", {})
        kg = status.get("knowledge_graph", {})
        col1, col2 = st.columns(2)
        col1.metric("Chunks", vs.get("total_chunks", 0))
        col2.metric("Nodes", kg.get("total_nodes", 0))
        sources = vs.get("sources", [])
        if sources:
            st.caption(f"Sources: {', '.join(sources[:5])}")
    except Exception:
        st.warning("Cannot fetch KB status")

    st.divider()
    st.caption("QA Intelligence System v1.0")


# ─── Main Tabs ────────────────────────────────────────────────────────────────
tab_ingest, tab_analyze, tab_graph = st.tabs(["Ingest", "Analyze & Generate", "Knowledge Graph"])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 1: INGEST
# ═══════════════════════════════════════════════════════════════════════════════

def _infer_doc_type(filename: str) -> str:
    name = filename.lower()
    if any(k in name for k in ["brd", "business_req", "business-req"]):
        return "brd"
    if any(k in name for k in ["srs", "spec", "requirement"]):
        return "srs"
    if any(k in name for k in ["story", "user_story", "userstory"]):
        return "user_story"
    if any(k in name for k in ["bug", "defect", "issue"]):
        return "bug_report"
    if any(k in name for k in ["api", "contract", "swagger", "openapi"]):
        return "api_contract"
    if any(k in name for k in ["schema", "db", "database", "table", "sql"]):
        return "db_schema"
    if any(k in name for k in ["event", "kafka", "topic"]):
        return "event_definition"
    if any(k in name for k in ["test", "testcase", "test_case"]):
        return "test_case"
    if any(k in name for k in ["rule", "business_rule"]):
        return "business_rule"
    return "srs"


with tab_ingest:
    st.header("Document Ingestion")
    st.caption("Upload your BRD, SRS, User Stories, Bug Reports, API Contracts, DB Schemas — doc type is auto-detected from the filename.")

    uploaded_files = st.file_uploader(
        "Drop files here or click to browse (PDF, DOCX, XLSX, TXT, JSON, MD, YAML)",
        type=["pdf", "docx", "xlsx", "xls", "txt", "json", "md", "yaml"],
        accept_multiple_files=True,
    )

    if uploaded_files:
        if st.button("Ingest All Files", type="primary", use_container_width=True):
            total = len(uploaded_files)
            max_workers = min(total, 8)  # process up to 8 files simultaneously

            st.info(f"Processing **{total}** file(s) in parallel (up to {max_workers} at a time)...")
            progress = st.progress(0, f"Starting {total} parallel jobs...")

            # Submit all files to the thread pool at once
            futures = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                for f in uploaded_files:
                    doc_type = _infer_doc_type(f.name)
                    future = executor.submit(
                        _process_file_parallel, f.getvalue(), f.name, doc_type
                    )
                    futures[future] = f.name

                # Collect results as each file finishes
                results = []
                completed = 0
                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    results.append(result)
                    completed += 1
                    progress.progress(completed / total, f"Completed {completed} / {total}: {result['file']}")

            progress.progress(1.0, "All files processed!")

            # ── Render results ────────────────────────────────────────────────
            st.divider()
            ok_results  = [r for r in results if r["status"] == "OK"]
            rejected    = [r for r in results if r["status"] == "REJECTED"]
            failed      = [r for r in results if r["status"] == "FAIL"]

            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Files Uploaded", total)
            c2.metric("Ingested", len(ok_results))
            c3.metric("Total Entities", sum(r["entities"] for r in ok_results))
            c4.metric("Total Chunks in KB", vector_store.count())

            for r in ok_results:
                steps_str = " → ".join(r.get("steps", []))
                st.success(
                    f"[INGESTED] **{r['file']}** (`{r.get('detected_type', r['type'])}`) "
                    f"— {r['chunks']} chunks · {r['entities']} entities · {r['rels']} relationships  \n"
                    f"`{steps_str}`"
                )
            for r in rejected:
                st.warning(
                    f"[REJECTED — NOT PROJECT DATA] **{r['file']}** "
                    f"detected as: `{r.get('detected_type', 'unknown')}` "
                    f"— {r.get('reason', 'Not relevant to a QA knowledge base')}"
                )
            for r in failed:
                st.error(f"[ERROR] **{r['file']}** — {r.get('error', 'unknown error')}")
    else:
        st.info("No files selected yet. Upload one or more files above to populate the knowledge base.")


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 2: ANALYZE & GENERATE
# ═══════════════════════════════════════════════════════════════════════════════
with tab_analyze:
    st.header("QA Analysis & Test Generation")

    user_story = st.text_area(
        "User Story",
        height=140,
        placeholder="As a [role], I want to [goal], so that [benefit]...\n\nOr paste a detailed feature description.",
        value=""
    )

    # Show KB status inline before analysis
    _inline_status = _kb_status()
    _chunks = _inline_status.get("vector_store", {}).get("total_chunks", 0)
    _nodes = _inline_status.get("knowledge_graph", {}).get("total_nodes", 0)
    if _chunks == 0 and _nodes == 0:
        st.info(
            "Knowledge Base is empty — analysis will run using LLM inference only. "
            "For richer results (bug history, API contracts, regression coverage), "
            "upload your documents in the **Ingest** tab first."
        )
    else:
        st.success(f"Knowledge Base loaded: **{_chunks} chunks** · **{_nodes} graph nodes**. Analysis will use full KB context.")

    if st.button("Run QA Analysis", type="primary", use_container_width=True):
        if not user_story.strip():
            st.warning("Please enter a user story")
        else:
            with st.spinner("Running Three-Brain QA Pipeline..."):
                progress_bar = st.progress(0, "Detecting module, priority and risk from story...")
                try:
                    result = qa_pipeline.run(user_story=user_story)
                    progress_bar.progress(100, "Complete!")

                    st.session_state["qa_result"] = result
                    complexity = result.get("complexity_level", "moderate").upper()
                    st.success(
                        f"Analysis complete! "
                        f"Module: **{result.get('detected_module', '?')}** | "
                        f"Priority: **{result.get('detected_priority', '?')}** | "
                        f"Complexity: **{complexity}** | "
                        f"Risk: **{result.get('overall_risk', '?')}** | "
                        f"Scenarios: **{result.get('total_scenarios', 0)}** | "
                        f"Warnings: **{len(result.get('heads_up_warnings', []))}**"
                    )
                except Exception as e:
                    st.error(str(e))

    if "qa_result" in st.session_state:
        _render_results(st.session_state["qa_result"])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 3: KNOWLEDGE GRAPH
# ═══════════════════════════════════════════════════════════════════════════════
with tab_graph:
    st.header("Knowledge Graph Explorer")

    try:
        gq = GraphQueryEngine(get_graph())
        stats = gq.get_graph_stats()
        cols = st.columns(6)
        labels = ["module", "feature", "api", "bug", "testcase", "event"]
        for i, label in enumerate(labels):
            count = stats.get(f"{label}_count", 0)
            cols[i].metric(f"{label.title()}s", count)

        st.metric("Total Nodes", stats.get("total_nodes", 0))
        st.metric("Total Relationships", stats.get("total_relationships", 0))
    except Exception as e:
        st.warning(f"Graph stats unavailable: {e}")

    st.divider()
    st.subheader("Graph Visualisation")
    st.info(
        "Full graph visualisation requires Neo4j Browser or a graph viz library. "
        "Run Neo4j Browser at http://localhost:7474 to explore the full graph.\n\n"
        "**Quick query examples:**\n"
        "- `MATCH (n) RETURN n LIMIT 50`\n"
        "- `MATCH (b:Bug)-[:FOUND_IN]->(m:Module) RETURN b, m`\n"
        "- `MATCH p=shortestPath((a:Feature)-[*]-(b:Module)) RETURN p`"
    )
