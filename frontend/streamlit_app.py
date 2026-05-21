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

# Persist token usage across reruns (sidebar renders before pipeline runs)
if "token_usage" not in st.session_state:
    st.session_state["token_usage"] = {"input_tokens": 0, "output_tokens": 0}

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

    # ── Feature status badge (existing / partial / new) ───────────────────
    feature_status = result.get("feature_status", "new")
    status_cfg = {
        "existing": ("#1a5276", "#d6eaf8", "EXISTING FEATURE",
                     "Prior knowledge found in KB — regression and change-impact focus applied."),
        "partial":  ("#7d6608", "#fef9e7", "PARTIALLY KNOWN FEATURE",
                     "Some KB context found — analysis blends existing knowledge with new coverage."),
        "new":      ("#1e8449", "#d5f5e3", "NEW FEATURE",
                     "No matching KB content — comprehensive test generation from scratch."),
    }
    fg, bg, label, hint = status_cfg.get(feature_status, status_cfg["new"])
    st.markdown(
        f'<div style="background:{bg}; border-left:5px solid {fg}; padding:10px 14px; '
        f'border-radius:6px; margin-bottom:8px; color:#000;">'
        f'<strong style="color:{fg};">{label}</strong><br/>'
        f'<span style="font-size:0.85rem;">{result.get("feature_status_reason", hint)}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )

    complexity = result.get("complexity_level", "moderate")
    complexity_colors = {"simple": "#d4edda", "moderate": "#fff3cd", "complex": "#f8d7da"}
    complexity_bg = complexity_colors.get(complexity, "#fff3cd")
    st.markdown(
        f'<div style="background:{complexity_bg}; padding:8px 14px; border-radius:6px; '
        f'margin-bottom:10px; color:#000; font-weight:bold;">'
        f'Feature Complexity: {complexity.upper()}</div>',
        unsafe_allow_html=True,
    )

    # ── Grounding / hallucination warnings ───────────────────────────────
    if result.get("kb_sparse"):
        st.warning(
            "**Sparse KB context** — the knowledge base returned little relevant content for this story. "
            "Scenario counts have been reduced and all scenarios are derived from the user story text only. "
            "Upload the BRD, SRS, or acceptance criteria for this feature to get fully grounded test cases.",
            icon="⚠️",
        )
    if result.get("apis_inferred"):
        st.info(
            "**API endpoints inferred** — no API contracts were found in the knowledge base, so endpoints "
            "were inferred from the user story by the LLM. Upload an API contract or Swagger spec to "
            "replace inferred endpoints with verified ones.",
            icon="ℹ️",
        )

    with st.expander("Feature Understanding", expanded=True):
        st.markdown(result.get("feature_understanding", "N/A"))

    with st.expander("Impacted Modules", expanded=True):
        modules = result.get("impacted_modules", [])
        if modules:
            for m in modules:
                impact = m.get("impact_type", "DIRECT")
                crit = m.get("criticality", 3)
                tag = "[DIRECT]" if impact == "DIRECT" else "[INDIRECT]"
                st.markdown(f"{tag} **{m.get('name', 'Unknown')}** | Impact: `{impact}` | Criticality: `{crit}/5`")
        else:
            st.info("No specific module data in knowledge graph – ingest module documentation first.")

    _LAYER_COLOR = {
        "UI":           "#1565c0",
        "API":          "#6a1b9a",
        "DB":           "#2e7d32",
        "Event":        "#e65100",
        "Consumer":     "#4e342e",
        "Notification": "#00695c",
    }

    with st.expander("End-to-End Event Flow", expanded=False):
        flow = result.get("event_flow", [])
        if flow:
            for entry in flow:
                layer      = entry.get("layer", "")
                component  = entry.get("component", "")
                action     = entry.get("action", "")
                data       = entry.get("data", "")
                validation = entry.get("validation_point", "")
                step_num   = entry.get("step", "")
                color      = _LAYER_COLOR.get(layer, "#37474f")

                data_row = (
                    f'<div style="margin-top:6px;font-size:13px;color:#555;">'
                    f'<strong>Data passing through:</strong> {data}</div>'
                ) if data else ""

                st.markdown(
                    f'<div style="border-left:4px solid {color};padding:12px 16px;'
                    f'margin-bottom:14px;background:#fafafa;border-radius:0 6px 6px 0;">'
                    f'<span style="background:{color};color:white;padding:2px 10px;'
                    f'border-radius:4px;font-size:12px;font-weight:bold">'
                    f'Step {step_num} — {layer}</span>'
                    f'<div style="margin-top:8px;font-weight:bold;color:#111;font-size:14px">{component}</div>'
                    f'<div style="margin-top:4px;color:#333;font-size:13px">{action}</div>'
                    f'{data_row}'
                    f'<div style="margin-top:10px;background:#e8f5e9;padding:8px 12px;'
                    f'border-radius:4px;font-size:13px;color:#1b5e20;">'
                    f'<strong>What to validate:</strong> {validation}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.info(
                "No flow data available. "
                "Upload API contracts, event definitions, or module documentation in the Ingest tab "
                "to generate a detailed end-to-end flow for this feature."
            )

    with st.expander("Risk Areas", expanded=True):
        risks = result.get("risk_areas", [])
        if risks:
            for r in risks:
                prio = r.get("priority", "P4")
                score = r.get("risk_score", 0)
                st.markdown(f"**{prio}** — {r.get('feature', r.get('module', ''))} | Score: `{score:.2f}`")
                for reason in r.get("reasons", []):
                    st.caption(f"  • {reason}")
                st.caption(f"  Past bugs: {r.get('past_bug_count', 0)}")

    _SEV_STYLE = {
        "blocker":  ("#7b0000", "#ffebee", "#c62828"),
        "critical": ("#7b0000", "#ffebee", "#c62828"),
        "p1":       ("#7b0000", "#ffebee", "#c62828"),
        "high":     ("#e65100", "#fff3e0", "#ef6c00"),
        "p2":       ("#e65100", "#fff3e0", "#ef6c00"),
        "medium":   ("#f57f17", "#fffde7", "#f9a825"),
        "p3":       ("#f57f17", "#fffde7", "#f9a825"),
        "low":      ("#1b5e20", "#f1f8e9", "#388e3c"),
    }

    with st.expander(
        f"Heads-Up Warnings  —  {len(result.get('heads_up_warnings', []))} pattern-matched risk(s) found",
        expanded=True,
    ):
        warnings_list = result.get("heads_up_warnings", [])
        if warnings_list:
            for w in warnings_list:
                sev        = w.get("severity", "medium").lower()
                text_color, bg_color, border_color = _SEV_STYLE.get(sev, ("#37474f", "#fafafa", "#78909c"))
                pattern    = w.get("pattern")
                bug_id     = w.get("similar_bug_id", "")
                bug_title  = w.get("bug_title", "Unknown bug")
                module     = w.get("module")
                advice     = w.get("pattern_advice")
                root_cause = w.get("root_cause")
                action     = w.get("recommendation", "")

                sev_badge = (
                    f'<span style="background:{border_color};color:white;padding:2px 10px;'
                    f'border-radius:4px;font-size:12px;font-weight:bold">{sev.upper()}</span>'
                )
                pattern_badge = (
                    f'<span style="background:#e8eaf6;color:#3949ab;padding:2px 10px;'
                    f'border-radius:4px;font-size:12px;margin-left:6px">{pattern}</span>'
                ) if pattern else ""

                bug_ref = f"{bug_title}"
                if bug_id:
                    bug_ref += f" <span style='color:#888;font-size:12px'>({bug_id})</span>"
                if module:
                    bug_ref += f" &nbsp;·&nbsp; <span style='color:#555;font-size:12px'>Module: {module}</span>"

                advice_row = (
                    f'<div style="margin-top:10px;">'
                    f'<div style="font-size:12px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.5px">Why this matters</div>'
                    f'<div style="margin-top:3px;color:#222;font-size:13px">{advice}</div>'
                    f'</div>'
                ) if advice else ""

                root_row = (
                    f'<div style="margin-top:10px;">'
                    f'<div style="font-size:12px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.5px">Original root cause</div>'
                    f'<div style="margin-top:3px;color:#222;font-size:13px">{root_cause}</div>'
                    f'</div>'
                ) if root_cause else ""

                st.markdown(
                    f'<div style="border-left:4px solid {border_color};background:{bg_color};'
                    f'padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:14px;color:#000;">'
                    f'<div>{sev_badge}{pattern_badge}</div>'
                    f'<div style="margin-top:10px;font-weight:bold;font-size:14px;color:{text_color}">'
                    f'{w.get("warning", "")}</div>'
                    f'<div style="margin-top:6px;color:#333;font-size:13px">'
                    f'<strong>Similar past bug:</strong> {bug_ref}</div>'
                    f'{advice_row}'
                    f'{root_row}'
                    f'<div style="margin-top:10px;background:rgba(0,0,0,0.05);padding:8px 12px;'
                    f'border-radius:4px;font-size:13px;color:#222;">'
                    f'<strong>What to do:</strong> {action}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.success("No pattern-matched warnings found — no historically similar bugs detected for this feature.")

    import re as _re

    def _humanize_title(title: str) -> str:
        """Convert technical state-transition notation to plain English."""
        # "Entity: STATE →[EVENT]→ STATE"
        m = _re.match(r'^(.+?):\s*([A-Z][A-Z_]+)\s*→\[([A-Z_]+)\]→\s*([A-Z][A-Z_]+)$', title)
        if m:
            entity, from_s, event, to_s = m.groups()
            return (f"{entity}: Status changes from '{from_s.replace('_',' ').title()}'"
                    f" to '{to_s.replace('_',' ').title()}'"
                    f" when '{event.replace('_',' ').title()}' is triggered")

        # "Entity: REJECT 'EVENT' in state 'STATE'"
        m = _re.match(r"^(.+?):\s*REJECT\s+'([A-Z_]+)'\s+in state\s+'([A-Z_]+)'$", title)
        if m:
            entity, event, state = m.groups()
            return (f"{entity}: '{event.replace('_',' ').title()}' should be blocked"
                    f" when status is '{state.replace('_',' ').title()}'")

        # "Entity: Sequence [S → S → S]"
        m = _re.match(r'^(.+?):\s*Sequence\s+\[(.+)\]$', title)
        if m:
            entity, seq = m.groups()
            readable = ' → '.join(
                p.strip().replace('_', ' ').title()
                for p in _re.split(r'→', seq)
            )
            return f"{entity}: End-to-end journey — {readable}"

        # "Combination test — Param = Value, Param = Value"
        if title.lower().startswith("combination test"):
            return title.replace("Combination test —", "Test with:")

        # "Decision: condition=YES, condition=NO"
        if title.lower().startswith("decision:"):
            return title.replace("Decision:", "Check behaviour when:")

        return title

    _TYPE_LABELS = {
        "functional":            "Functional Test",
        "boundary_value":        "Boundary Value",
        "equivalence_partition": "Equivalence Partition",
        "pairwise":              "Combination Test",
        "decision_table":        "Decision Check",
        "state_transition":      "State Transition",
        "event_flow":            "Event Flow",
        "edge_case":             "Edge Case",
    }
    _RISK_STYLE = {
        "high":   ("background:#c0392b;color:white",   "High Risk"),
        "medium": ("background:#e67e22;color:white",   "Medium Risk"),
        "low":    ("background:#27ae60;color:white",   "Low Risk"),
    }

    with st.expander(f"Test Scenarios  —  {len(result.get('test_scenarios', []))} scenarios generated", expanded=False):
        scenarios = result.get("test_scenarios", [])

        filtered = scenarios

        for s in filtered[:30]:
            stype      = _TYPE_LABELS.get(s.get("type", ""), s.get("type", "").replace("_", " ").title())
            risk_level = s.get("risk_level", "low").lower()
            risk_style, risk_label = _RISK_STYLE.get(risk_level, ("background:#7f8c8d;color:white", risk_level.upper()))

            human_title = _humanize_title(s.get("title", ""))
            with st.expander(human_title[:100], expanded=False):
                # ── ID chip + technique tag + risk badge ───────────────────
                tc_id = s.get("id", "")
                st.markdown(
                    f'<span style="background:#eceff1;color:#546e7a;padding:2px 8px;'
                    f'border-radius:4px;font-size:11px;font-family:monospace">{tc_id}</span>'
                    f'&nbsp;&nbsp;'
                    f'<span style="background:#e8eaf6;color:#3949ab;padding:3px 10px;'
                    f'border-radius:4px;font-size:12px">{stype}</span>'
                    f'&nbsp;&nbsp;'
                    f'<span style="{risk_style};padding:3px 10px;border-radius:4px;'
                    f'font-size:12px;font-weight:bold">{risk_label}</span>',
                    unsafe_allow_html=True,
                )
                st.write("")

                if s.get("traceability"):
                    st.markdown(
                        f'<div style="font-size:12px;color:#555;background:#f1f3f4;'
                        f'padding:4px 10px;border-radius:4px;margin-bottom:10px;">'
                        f'<strong>Covers:</strong> {s.get("traceability")}</div>',
                        unsafe_allow_html=True,
                    )

                if s.get("preconditions"):
                    st.markdown("**Before you start**")
                    for p in s["preconditions"]:
                        st.markdown(f"- {p}")
                    st.write("")

                steps = s.get("steps", [])
                if steps:
                    st.markdown("**Test Steps**")
                    for i, step in enumerate(steps, 1):
                        st.markdown(f"{i}. {step}")
                    st.write("")

                expected = s.get("expected_result", "")
                if expected:
                    st.markdown(
                        f'<div style="background:#eafaf1;border-left:4px solid #27ae60;'
                        f'padding:10px 14px;border-radius:4px;color:#000;">'
                        f'<strong>What you should see</strong><br/>{expected}</div>',
                        unsafe_allow_html=True,
                    )

    with st.expander(f"Gherkin Test Cases ({len(result.get('gherkin_test_cases', []))})", expanded=False):
        for g in result.get("gherkin_test_cases", []):
            tags = " ".join(g.get("tags", []))
            given = "\n".join(f"  {line}" for line in g.get("given", []))
            when  = "\n".join(f"  {line}" for line in g.get("when", []))
            then  = "\n".join(f"  {line}" for line in g.get("then", []))
            st.code(f"{tags}\nScenario: {g.get('scenario_title', '')}\n{given}\n{when}\n{then}", language="gherkin")

    reg_suite = result.get("regression_suite", [])
    reg_gherkin = result.get("regression_gherkin", [])
    with st.expander(
        f"Regression Suite — {len(reg_suite)} TCs to re-run + {len(reg_gherkin)} new interaction scenarios",
        expanded=False,
    ):
        must = [r for r in reg_suite if r.get("priority") == "MUST-RUN"]
        should = [r for r in reg_suite if r.get("priority") == "SHOULD-RUN"]

        # ── Part A: Existing TCs ───────────────────────────────────────────
        st.markdown("#### Part A — Existing Test Cases to Re-run")
        if reg_suite:
            st.markdown(
                f"<span style='background:#922b21;color:white;padding:2px 8px;border-radius:4px;font-size:12px'>MUST-RUN {len(must)}</span> &nbsp;"
                f"<span style='background:#7d6608;color:white;padding:2px 8px;border-radius:4px;font-size:12px'>SHOULD-RUN {len(should)}</span>",
                unsafe_allow_html=True,
            )
            st.write("")
            for r in reg_suite:
                is_must = r.get("priority") == "MUST-RUN"
                trace = r.get("trace", {})
                trigger = trace.get("trigger", "IN SCOPE")
                why = trace.get("why", r.get("reason", ""))
                what = trace.get("what_to_verify", "Re-run and confirm all assertions pass")

                badge_color = "#922b21" if is_must else "#7d6608"
                badge_label = "MUST-RUN" if is_must else "SHOULD-RUN"
                trigger_color = {
                    "MODULE MATCH": "#1a5276", "FEATURE MATCH": "#1a5276",
                    "BUG REGRESSION": "#6e2f17", "API DEPENDENCY": "#4a235a",
                    "EVENT DEPENDENCY": "#4a235a", "TRANSITIVE": "#1e5631",
                    "SECURITY": "#7b241c", "SMOKE": "#145a32",
                    "NEGATIVE": "#6e2f17", "CONCURRENCY": "#784212",
                    "IDEMPOTENCY": "#2e4057",
                }.get(trigger, "#2c3e50")

                st.markdown(
                    f"<span style='background:{badge_color};color:white;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:bold'>{badge_label}</span> "
                    f"<span style='background:{trigger_color};color:white;padding:1px 7px;border-radius:3px;font-size:11px'>{trigger}</span> "
                    f"`{r.get('test_case_id', '')}` — **{r.get('test_case_name', '')}**",
                    unsafe_allow_html=True,
                )
                st.caption(f"WHY: {why}")
                st.caption(f"VERIFY: {what}")
                if r.get("needs_update") and r.get("update_reason"):
                    st.warning(f"UPDATE NEEDED: {r.get('update_reason')}", icon="✏️")
                st.write("")
        else:
            st.info("No existing test cases in graph. Ingest test cases to populate this section.")

        # ── Part B: New Regression Gherkin ────────────────────────────────
        st.divider()
        st.markdown("#### Part B — New Regression Gherkin: Feature Interaction Scenarios")
        if reg_gherkin:
            for g in reg_gherkin:
                tags = " ".join(g.get("tags", ["@regression"]))
                given = "\n".join(f"  {line}" for line in g.get("given", []))
                when  = "\n".join(f"  {line}" for line in g.get("when", []))
                then  = "\n".join(f"  {line}" for line in g.get("then", []))
                st.code(
                    f"{tags}\nScenario: {g.get('scenario_title', '')}\n{given}\n{when}\n{then}",
                    language="gherkin",
                )
        else:
            st.info("Regression Gherkin scenarios will appear here after analysis.")

    with st.expander(f"Test Cases to Update ({len(result.get('test_cases_to_update', []))})", expanded=False):
        for u in result.get("test_cases_to_update", []):
            st.markdown(f"`{u.get('test_case_id', '')}` — {u.get('test_case_name', '')}")
            st.caption(f"Update reason: {u.get('update_reason', '')}")

    with st.expander(f"Missing Coverage ({len(result.get('missing_coverage', []))})", expanded=True):
        for gap in result.get("missing_coverage", []):
            gap_type = gap.get("gap_type", "").replace("_", " ").upper()
            st.markdown(f"[{gap_type}] **{gap.get('area', '')}** — {gap.get('description', '')}")
            st.caption(f"{gap.get('recommendation', '')}")

    with st.expander(f"API + Event Validation ({len(result.get('api_event_validation', []))})", expanded=False):
        for api in result.get("api_event_validation", []):
            st.markdown(f"**`{api.get('method', '')} {api.get('endpoint', '')}`**")
            for v in api.get("validations", []):
                st.markdown(f"  - {v}")
            if api.get("event_triggers"):
                st.caption(f"Events published: {', '.join(api['event_triggers'])}")
            st.divider()



# ─── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("QA Intelligence")
    st.caption("Three-Brain QA Architecture")
    st.divider()

    # DeepInfra pricing per 1M tokens (input_$/M, output_$/M)
    _PRICING = {
        "openai/gpt-oss-120b-Turbo":               (0.80, 2.40),
        "meta-llama/Meta-Llama-3.1-8B-Instruct":   (0.06, 0.06),
        "meta-llama/Meta-Llama-3.1-70B-Instruct":  (0.52, 0.75),
        "meta-llama/Meta-Llama-3.1-405B-Instruct": (2.70, 2.70),
        "mistralai/Mixtral-8x7B-Instruct-v0.1":    (0.27, 0.27),
        "deepseek-ai/DeepSeek-R1":                 (0.55, 2.19),
        "Qwen/Qwen2.5-72B-Instruct":               (0.35, 0.40),
    }

    llm_price = _PRICING.get(settings.LLM_MODEL)

    st.success(f"Model: {settings.LLM_MODEL}")

    # Live session usage + cost (populated after pipeline runs via st.session_state)
    usage = st.session_state["token_usage"]
    inp_tok = usage["input_tokens"]
    out_tok = usage["output_tokens"]

    if llm_price and (inp_tok or out_tok):
        inp_cost  = inp_tok  / 1_000_000 * llm_price[0]
        out_cost  = out_tok  / 1_000_000 * llm_price[1]
        total_cost = inp_cost + out_cost
        st.markdown(
            f"""
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-top:4px;">
  <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:6px;">Session usage · DeepInfra</div>
  <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
    <tr>
      <td style="color:#94a3b8;padding:2px 0;">Input</td>
      <td style="text-align:right;color:#e2e8f0;">{inp_tok:,} tok</td>
      <td style="text-align:right;color:#38bdf8;padding-left:8px;">${inp_cost:.4f}</td>
    </tr>
    <tr>
      <td style="color:#94a3b8;padding:2px 0;">Output</td>
      <td style="text-align:right;color:#e2e8f0;">{out_tok:,} tok</td>
      <td style="text-align:right;color:#38bdf8;padding-left:8px;">${out_cost:.4f}</td>
    </tr>
    <tr style="border-top:1px solid #334155;">
      <td style="color:#f1f5f9;font-weight:bold;padding-top:4px;">Total</td>
      <td style="text-align:right;color:#e2e8f0;padding-top:4px;">{inp_tok+out_tok:,} tok</td>
      <td style="text-align:right;color:#4ade80;font-weight:bold;padding-left:8px;padding-top:4px;">${total_cost:.4f}</td>
    </tr>
  </table>
  <div style="font-size:0.7rem;color:#475569;margin-top:6px;">
    Rates: ${llm_price[0]:.2f} / ${llm_price[1]:.2f} per 1M in/out tokens
  </div>
</div>""",
            unsafe_allow_html=True,
        )
    elif llm_price:
        st.caption(f"Rates: ${llm_price[0]:.2f} / ${llm_price[1]:.2f} per 1M in/out tokens · no calls yet")
    else:
        st.caption("Pricing not listed for this model")

    if (inp_tok or out_tok) and st.button("Reset usage", use_container_width=True, type="secondary"):
        llm_client.reset_usage()
        st.session_state["token_usage"] = {"input_tokens": 0, "output_tokens": 0}
        st.rerun()

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

    if st.button("Clear KB", type="secondary", use_container_width=True):
        try:
            vector_store.clear()
            get_graph().clear()
            st.success("Knowledge Base cleared.")
            st.rerun()
        except Exception as e:
            st.error(f"Clear failed: {e}")

    st.divider()
    st.caption("QA Intelligence System v1.0")


# ─── Main Tabs ────────────────────────────────────────────────────────────────
tab_ingest, tab_analyze = st.tabs(["Ingest", "Analyze & Generate"])


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
                    # Snapshot token usage into session state so the sidebar shows
                    # real counts on the rerun (sidebar renders before pipeline runs)
                    st.session_state["token_usage"] = llm_client.get_usage()
                    complexity = result.get("complexity_level", "moderate").upper()
                    st.session_state["analysis_summary"] = (
                        f"Analysis complete! "
                        f"Module: **{result.get('detected_module', '?')}** | "
                        f"Priority: **{result.get('detected_priority', '?')}** | "
                        f"Complexity: **{complexity}** | "
                        f"Risk: **{result.get('overall_risk', '?')}** | "
                        f"Scenarios: **{result.get('total_scenarios', 0)}** | "
                        f"Warnings: **{len(result.get('heads_up_warnings', []))}**"
                    )
                    st.rerun()
                except Exception as e:
                    st.error(str(e))

    if "analysis_summary" in st.session_state:
        st.success(st.session_state["analysis_summary"])

    if "qa_result" in st.session_state:
        _render_results(st.session_state["qa_result"])


# ═══════════════════════════════════════════════════════════════════════════════
# TAB 3: KNOWLEDGE GRAPH
# ═══════════════════════════════════════════════════════════════════════════════
