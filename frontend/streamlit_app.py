"""
QA Intelligence System – Streamlit Frontend

Three-panel layout:
  Left  → Ingest documents
  Center → Analysis input + results
  Right  → Graph stats + knowledge base status
"""

import json
import time
import requests
import streamlit as st
from pathlib import Path

API_BASE = "http://localhost:8000"

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


# ─── Helper functions (must be defined before use in Streamlit) ──────────────

def _load_sample_data(sample_dir: Path):
    """Ingest all sample data files into the knowledge base."""
    files = {
        "brd_sample.json": "brd",
        "api_contract_sample.json": "api_contract",
        "db_schema_sample.json": "db_schema",
        "user_story_sample.json": "user_story",
    }
    progress = st.progress(0)
    results = []

    for i, (fname, doc_type) in enumerate(files.items()):
        fpath = sample_dir / fname
        if fpath.exists():
            with open(fpath) as f:
                data = json.load(f)
            try:
                resp = requests.post(
                    f"{API_BASE}/ingest/json",
                    json={"data": data, "doc_type": doc_type, "source_id": fname.replace(".json", "")},
                    timeout=60,
                )
                if resp.status_code == 200:
                    results.append(f"[OK] {fname}")
                else:
                    results.append(f"[FAIL] {fname}: {resp.text[:80]}")
            except Exception as e:
                results.append(f"[FAIL] {fname}: {str(e)}")
        else:
            results.append(f"[WARN] {fname} not found")
        progress.progress((i + 1) / len(files))

    bug_file = sample_dir / "bug_history_sample.json"
    if bug_file.exists():
        with open(bug_file) as f:
            bugs = json.load(f)
        for bug in bugs:
            try:
                requests.post(
                    f"{API_BASE}/ingest/json",
                    json={"data": bug, "doc_type": "bug_report", "source_id": bug.get("id", "bug")},
                    timeout=30,
                )
            except Exception:
                pass
        results.append(f"[OK] bug_history_sample.json ({len(bugs)} bugs)")

    st.success("\n".join(results))


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

    with st.expander("SECTION 12: QA Sign-off Checklist", expanded=True):
        checklist = result.get("signoff_checklist", [])
        categories: dict = {}
        for item in checklist:
            cat = item.get("category", "Other")
            categories.setdefault(cat, []).append(item)
        for cat, items in categories.items():
            st.markdown(f"**{cat}**")
            for item in items:
                status = item.get("status", "PENDING")
                tag = {"MUST_VERIFY": "[MUST]", "AUTOMATED": "[AUTO]", "PENDING": "[PENDING]"}.get(status, "[PENDING]")
                owner = item.get("owner", "QA")
                st.markdown(f"  {tag} {item.get('item', '')} _(Owner: {owner})_")

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

    # API health check
    try:
        health = requests.get(f"{API_BASE}/health", timeout=3).json()
        st.success(f"API Online | Model: {health.get('model', '?')}")
    except Exception:
        st.error("API Offline – start backend first")

    st.divider()

    # Knowledge base status
    st.subheader("Knowledge Base")
    try:
        status = requests.get(f"{API_BASE}/ingest/status", timeout=3).json()
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

    # Sample data loader
    st.subheader("Load Sample Data")
    sample_dir = Path(__file__).parent.parent / "backend" / "sample_data"

    if st.button("Load All Sample Data", type="primary"):
        _load_sample_data(sample_dir)

    st.divider()
    st.caption("QA Intelligence System v1.0")


# ─── Main Tabs ────────────────────────────────────────────────────────────────
tab_ingest, tab_analyze, tab_graph = st.tabs(["Ingest", "Analyze & Generate", "Knowledge Graph"])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 1: INGEST
# ═══════════════════════════════════════════════════════════════════════════════

# Map file extension / name keywords → doc_type (auto-detected)
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
    return "srs"  # safe default

with tab_ingest:
    st.header("Document Ingestion")
    st.caption("Upload your BRD, SRS, User Stories, Bug Reports, API Contracts, DB Schemas — doc type is auto-detected from the filename.")

    uploaded_files = st.file_uploader(
        "Drop files here or click to browse (PDF, DOCX, XLSX, TXT, JSON, MD, YAML)",
        type=["pdf", "docx", "xlsx", "xls", "txt", "json", "md", "yaml"],
        accept_multiple_files=True,
    )

    if uploaded_files:
        # Preview detected types
        st.markdown("**Detected document types:**")
        cols = st.columns(min(len(uploaded_files), 4))
        for i, f in enumerate(uploaded_files):
            detected = _infer_doc_type(f.name)
            cols[i % 4].info(f"`{f.name}`\n\n→ `{detected}`")

        st.caption("Rename files to include keywords (brd, srs, bug, api, schema, story, event, test, rule) for accurate auto-detection.")

        if st.button("Ingest All Files", type="primary", use_container_width=True):
            total = len(uploaded_files)
            progress = st.progress(0, f"Ingesting 0 / {total}...")
            results = []

            for i, f in enumerate(uploaded_files):
                doc_type = _infer_doc_type(f.name)
                with st.spinner(f"Processing `{f.name}` as `{doc_type}`..."):
                    try:
                        resp = requests.post(
                            f"{API_BASE}/ingest/file",
                            files={"file": (f.name, f.getvalue(), f.type or "application/octet-stream")},
                            data={"doc_type": doc_type},
                            timeout=180,
                        )
                        if resp.status_code == 200:
                            r = resp.json()
                            results.append({"file": f.name, "type": doc_type, "status": "OK",
                                            "chunks": r["chunks_stored"],
                                            "entities": r["entities_extracted"],
                                            "rels": r["relationships_created"]})
                        else:
                            results.append({"file": f.name, "type": doc_type, "status": "FAIL",
                                            "chunks": 0, "entities": 0, "rels": 0,
                                            "error": resp.text[:120]})
                    except Exception as e:
                        results.append({"file": f.name, "type": doc_type, "status": "FAIL",
                                        "chunks": 0, "entities": 0, "rels": 0, "error": str(e)})
                progress.progress((i + 1) / total, f"Ingested {i + 1} / {total}: {f.name}")

            # Summary table
            st.divider()
            c1, c2, c3 = st.columns(3)
            c1.metric("Files Processed", total)
            c2.metric("Total Chunks", sum(r["chunks"] for r in results))
            c3.metric("Total Entities", sum(r["entities"] for r in results))

            for r in results:
                if r["status"] == "OK":
                    st.success(f"[OK] **{r['file']}** (`{r['type']}`) — {r['chunks']} chunks · {r['entities']} entities · {r['rels']} relationships")
                else:
                    st.error(f"[FAIL] **{r['file']}** — {r.get('error', 'unknown error')}")
    else:
        st.info("No files selected yet. Upload one or more files above to populate the knowledge base.")


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 2: ANALYZE & GENERATE
# ═══════════════════════════════════════════════════════════════════════════════
with tab_analyze:
    st.header("QA Analysis & Test Generation")

    col_input, col_opts = st.columns([3, 1])
    with col_input:
        user_story = st.text_area(
            "User Story",
            height=140,
            placeholder="As a [role], I want to [goal], so that [benefit]...\n\nOr paste a detailed feature description.",
            value=""
        )
    with col_opts:
        module_name = st.text_input("Module (optional)", placeholder="e.g. Checkout")
        priority = st.selectbox("Priority", ["low", "medium", "high", "critical"], index=2)
        include_gherkin = st.checkbox("Gherkin Tests", value=True)
        include_regression = st.checkbox("Regression Suite", value=True)
        include_api = st.checkbox("API Validation", value=True)
        risk_threshold = st.slider("Min Risk Score", 0.0, 1.0, 0.1, 0.05)

    if st.button("Run QA Analysis", type="primary", use_container_width=True):
        if not user_story.strip():
            st.warning("Please enter a user story")
        else:
            with st.spinner("Running Three-Brain QA Pipeline..."):
                progress_bar = st.progress(0, "Brain 1: Querying Knowledge Graph...")
                try:
                    resp = requests.post(
                        f"{API_BASE}/generate-tests/",
                        json={
                            "user_story": user_story,
                            "module_name": module_name,
                            "include_gherkin": include_gherkin,
                            "include_regression": include_regression,
                            "include_api_validation": include_api,
                            "risk_threshold": risk_threshold,
                            "max_scenarios": 60,
                        },
                        timeout=300,
                    )
                    progress_bar.progress(100, "Complete!")

                    if resp.status_code == 200:
                        result = resp.json()
                        st.session_state["qa_result"] = result
                        complexity = result.get("complexity_level", "moderate").upper()
                        st.success(
                            f"Analysis complete! Complexity: **{complexity}** | "
                            f"Risk: **{result.get('overall_risk', '?')}** | "
                            f"Scenarios: **{result.get('total_scenarios', 0)}** | "
                            f"Warnings: **{len(result.get('heads_up_warnings', []))}**"
                        )
                    else:
                        st.error(f"API Error: {resp.text}")
                except requests.Timeout:
                    st.error("Request timed out. LLM may be slow – try again.")
                except Exception as e:
                    st.error(str(e))

    # ── Display Results ───────────────────────────────────────────────────────
    if "qa_result" in st.session_state:
        result = st.session_state["qa_result"]
        _render_results(result)


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 3: KNOWLEDGE GRAPH
# ═══════════════════════════════════════════════════════════════════════════════
with tab_graph:
    st.header("Knowledge Graph Explorer")

    try:
        stats_resp = requests.get(f"{API_BASE}/analyze/graph-stats", timeout=5)
        if stats_resp.status_code == 200:
            stats = stats_resp.json()
            cols = st.columns(6)
            labels = ["module", "feature", "api", "bug", "testcase", "event"]
            for i, label in enumerate(labels):
                count = stats.get(f"{label}_count", 0)
                cols[i].metric(f"{label.title()}s", count)

            st.metric("Total Nodes", stats.get("total_nodes", 0))
            st.metric("Total Relationships", stats.get("total_relationships", 0))
        else:
            st.warning("Could not fetch graph statistics")
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
