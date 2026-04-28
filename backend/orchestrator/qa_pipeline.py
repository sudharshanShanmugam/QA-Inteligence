"""
QA Intelligence Orchestrator – The Three-Brain Pipeline.

Flow:
  User Story
    → BRAIN 1: Knowledge Graph query (entities, bugs, dependencies)
    → BRAIN 2: Analytical Engine (BVA, EP, State, Pairwise, Risk, Regression)
    → BRAIN 3: RAG retrieve + LLM generate
    → Combine → Structured 12-section QA output
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
import structlog

from graph_builder.neo4j_client import get_graph
from graph_builder.graph_queries import GraphQueryEngine
from analytics_engine.risk_engine import risk_engine
from analytics_engine.bva_engine import bva_engine
from analytics_engine.ep_engine import ep_engine
from analytics_engine.state_transition import state_engine
from analytics_engine.pairwise_engine import pairwise_engine
from analytics_engine.decision_table import decision_table_builder
from analytics_engine.bug_intelligence import bug_intelligence
from analytics_engine.regression_analyzer import regression_analyzer
from analytics_engine.event_flow_tracer import event_flow_tracer
from analytics_engine.coverage_analyzer import coverage_analyzer
from rag_engine.retriever import retriever
from test_generator.llm_client import llm_client

log = structlog.get_logger()


class QAPipeline:
    def __init__(self):
        self._graph_engine: Optional[GraphQueryEngine] = None

    def _get_graph_engine(self) -> GraphQueryEngine:
        if self._graph_engine is None:
            self._graph_engine = GraphQueryEngine(get_graph())
        return self._graph_engine

    # ════════════════════════════════════════════════════════════════════════
    # MAIN ENTRY POINT
    # ════════════════════════════════════════════════════════════════════════

    # ════════════════════════════════════════════════════════════════════════
    # COMPLEXITY ASSESSMENT
    # ════════════════════════════════════════════════════════════════════════

    def _assess_complexity(
        self,
        feature_understanding: str,
        user_story: str,
        modules: List[Dict],
        apis: List[Dict],
        events: List[Dict],
        states: List[Dict],
        risk_priority: str,
    ) -> tuple:
        """Score feature complexity → returns (level, limits).

        level: 'simple' | 'moderate' | 'complex'
        limits: per-technique scenario caps.
        """
        score = 0

        word_count = len(user_story.split())
        if word_count > 100:
            score += 2
        elif word_count > 50:
            score += 1

        score += min(len(apis), 3)
        score += min(len(events), 2)
        score += min(len(states), 2)
        score += min(len(modules), 3)

        risk_scores = {"P1": 4, "P2": 3, "P3": 2, "P4": 0,
                       "critical": 4, "high": 3, "medium": 2, "low": 0}
        score += risk_scores.get(risk_priority, 1)

        if len(feature_understanding) > 500:
            score += 2
        elif len(feature_understanding) > 200:
            score += 1

        if score <= 5:
            level = "simple"
            limits = {"bva": 4, "ep": 3, "pairwise": 2, "dt": 2,
                      "state": 1, "flow": 2, "edge_count": 4, "gherkin": 5}
        elif score <= 10:
            level = "moderate"
            limits = {"bva": 10, "ep": 8, "pairwise": 5, "dt": 5,
                      "state": 3, "flow": 3, "edge_count": 8, "gherkin": 12}
        else:
            level = "complex"
            limits = {"bva": 15, "ep": 12, "pairwise": 8, "dt": 8,
                      "state": 5, "flow": 5, "edge_count": 15, "gherkin": 20}

        log.info("complexity_assessed", level=level, score=score)
        return level, limits

    def run(self, user_story: str, module_name: str = "", priority: str = "medium") -> Dict[str, Any]:
        log.info("pipeline_start", story_preview=user_story[:80])

        gq = self._get_graph_engine()
        feature_name = self._extract_feature_name(user_story)
        module_name = module_name or self._infer_module(user_story)

        # ──────────────────────────────────────────────────────────────────
        # BRAIN 1: Knowledge Graph
        # ──────────────────────────────────────────────────────────────────
        log.info("brain1_graph_start")
        graph_data = gq.full_impact_analysis(feature_name)

        modules = graph_data.get("modules", [])
        impacted_modules = graph_data.get("dependent_modules", [])
        all_bugs = gq.get_all_bugs()
        graph_bugs = graph_data.get("bugs", [])
        test_cases_in_graph = graph_data.get("test_cases", [])
        events = graph_data.get("events", []) or gq.get_all_events()
        apis = graph_data.get("apis", []) or gq.get_all_apis()
        states = graph_data.get("states", [])
        journeys = graph_data.get("journeys", [])

        primary_module = modules[0] if modules else {"id": module_name, "name": module_name, "criticality": 3}

        # ──────────────────────────────────────────────────────────────────
        # BRAIN 2: Analytical Engine
        # ──────────────────────────────────────────────────────────────────
        log.info("brain2_analytics_start")

        # 2a. Risk scoring
        module_risk = risk_engine.score_module(primary_module, graph_bugs, impacted_modules)
        feature_risk = risk_engine.score_feature(
            {"name": feature_name, "priority": priority},
            graph_bugs,
            module_risk["risk_score"],
            has_state_machine=bool(states),
            has_external_events=bool(events),
        )
        all_risk_areas = risk_engine.rank_risk_areas([module_risk, feature_risk])

        # 2b. Field specs from story (heuristic extraction)
        field_specs = self._extract_field_specs(user_story)
        bva_results = bva_engine.analyze(field_specs) if field_specs else []
        ep_results = ep_engine.partition(field_specs) if field_specs else []

        # 2c. Pairwise
        pw_params = pairwise_engine.extract_parameters_from_story(user_story)
        pairwise_results = pairwise_engine.generate(pw_params)

        # 2d. Decision table
        dt_conditions, dt_actions = decision_table_builder.infer_conditions_from_story(user_story)
        dt_result = decision_table_builder.build(dt_conditions, dt_actions)

        # 2e. State transition
        state_machine_spec = state_engine.infer_from_description(user_story)
        state_tests: Dict = {}
        if state_machine_spec:
            machine = state_engine.build_machine(state_machine_spec)
            state_tests = state_engine.generate_tests(machine)

        # 2f. Bug intelligence
        similar_bugs = bug_intelligence.find_similar_bugs(
            feature_name, primary_module.get("name", ""), user_story, all_bugs
        )
        warnings = bug_intelligence.generate_warnings(similar_bugs, user_story)

        # 2g. Event flow trace
        flow_steps = event_flow_tracer.trace(feature_name, apis, events, [], modules)

        # 2h. Coverage analysis
        all_features = gq.find_nodes("Feature") if hasattr(gq, 'find_nodes') else []
        coverage_gaps = coverage_analyzer.analyze(
            features=all_features,
            test_cases=test_cases_in_graph,
            apis=apis,
            events=events,
            states=states,
            bugs=all_bugs,
        )

        # 2i. Regression analysis
        regression = regression_analyzer.synthesize_from_graph_data(
            feature_name, primary_module.get("name", ""),
            impacted_modules, test_cases_in_graph,
        )

        # ──────────────────────────────────────────────────────────────────
        # BRAIN 3: RAG + LLM Generation
        # ──────────────────────────────────────────────────────────────────
        log.info("brain3_rag_llm_start")

        rag_result = retriever.retrieve(user_story + " " + feature_name)
        rag_context_str = retriever.build_context_string(rag_result)

        # LLM: Feature Understanding
        feature_understanding = llm_client.generate_feature_understanding(
            user_story=user_story,
            rag_context=rag_context_str,
            module_name=primary_module.get("name", module_name),
            apis=[f"{a.get('method','')} {a.get('endpoint', a.get('name',''))}" for a in apis[:5]],
            events=[e.get("name", "") for e in events[:5]],
            business_rules=[],
        )

        # Agentic complexity assessment — scales all downstream generation
        complexity_level, complexity_limits = self._assess_complexity(
            feature_understanding=feature_understanding,
            user_story=user_story,
            modules=modules + impacted_modules,
            apis=apis,
            events=events,
            states=states,
            risk_priority=feature_risk["priority"],
        )

        # Rebuild analytical scenarios using complexity-scaled limits
        analytical_scenarios = self._build_scenarios(
            bva_results, ep_results, pairwise_results, dt_result, state_tests, flow_steps,
            limits=complexity_limits,
        )

        # LLM: Gherkin test cases — count scales with complexity
        risk_context = f"Risk Level: {feature_risk['priority']}. Reasons: {'; '.join(feature_risk['reasons'])}"
        gherkin_tests = llm_client.generate_gherkin(
            user_story=user_story,
            scenarios=analytical_scenarios[:complexity_limits["gherkin"]],
            risk_context=risk_context,
            warnings=warnings[:5],
            gherkin_limit=complexity_limits["gherkin"],
        )

        # LLM: Additional edge cases — count scales with complexity
        edge_cases = llm_client.generate_edge_cases(
            feature_name=feature_name,
            bug_context=rag_result.get("context_by_type", {}).get("bug_report", [""])[0][:800] if rag_result.get("context_by_type", {}).get("bug_report") else "",
            bva_results=bva_results[:5],
            ep_results=ep_results[:5],
            state_machine=state_machine_spec,
            edge_count=complexity_limits["edge_count"],
        )

        # LLM: API validations
        api_validations = llm_client.generate_api_validations(apis[:6], events[:4])

        # LLM: Sign-off checklist
        all_module_names = [m.get("name", "") for m in modules + impacted_modules]
        signoff_checklist = llm_client.generate_signoff_checklist(
            feature_name=feature_name,
            risk_level=feature_risk["priority"],
            modules=all_module_names,
            total_tests=len(analytical_scenarios) + len(gherkin_tests),
            regression_count=len(regression.get("must_run", [])),
            gaps=coverage_gaps[:5],
            warnings_count=len(warnings),
        )

        # ──────────────────────────────────────────────────────────────────
        # Assemble Final Output (12 sections)
        # ──────────────────────────────────────────────────────────────────
        overall_risk = feature_risk["priority"]
        total_scenarios = len(analytical_scenarios) + len(gherkin_tests) + len(edge_cases)

        result = {
            # Section 1
            "feature_understanding": feature_understanding,
            # Section 2
            "impacted_modules": self._format_modules(modules, impacted_modules),
            # Section 3
            "event_flow": flow_steps,
            # Section 4
            "risk_areas": all_risk_areas,
            # Section 5
            "heads_up_warnings": warnings,
            # Section 6
            "test_scenarios": self._format_test_scenarios(analytical_scenarios, edge_cases),
            # Section 7
            "gherkin_test_cases": gherkin_tests,
            # Section 8
            "regression_suite": regression.get("must_run", []),
            # Section 9
            "test_cases_to_update": regression.get("to_update", []),
            # Section 10
            "missing_coverage": coverage_gaps,
            # Section 11
            "api_event_validation": api_validations,
            # Section 12
            "signoff_checklist": signoff_checklist,
            # Metadata
            "user_story": user_story,
            "feature_name": feature_name,
            "total_scenarios": total_scenarios,
            "overall_risk": overall_risk,
            "complexity_level": complexity_level,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "graph_stats": gq.get_graph_stats(),
        }

        log.info("pipeline_complete",
                 feature=feature_name,
                 risk=overall_risk,
                 scenarios=total_scenarios,
                 warnings=len(warnings))
        return result

    # ════════════════════════════════════════════════════════════════════════
    # Helpers
    # ════════════════════════════════════════════════════════════════════════

    def _extract_feature_name(self, story: str) -> str:
        """Extract a short feature name from a user story."""
        match = re.search(r'i want (?:to )?(.+?)(?:so that|,|\.|$)', story.lower())
        if match:
            raw = match.group(1).strip()
            return raw[:60]
        words = story.split()[:6]
        return " ".join(words)

    def _infer_module(self, story: str) -> str:
        """Guess module from story keywords."""
        story_lower = story.lower()
        module_keywords = {
            "payment": "Payment",
            "checkout": "Checkout",
            "order": "Orders",
            "cart": "Cart",
            "auth": "Authentication",
            "login": "Authentication",
            "user": "User Management",
            "profile": "User Management",
            "notification": "Notifications",
            "email": "Notifications",
            "report": "Reporting",
            "dashboard": "Dashboard",
            "search": "Search",
            "product": "Product Catalogue",
            "inventory": "Inventory",
            "shipping": "Shipping",
        }
        for kw, mod in module_keywords.items():
            if kw in story_lower:
                return mod
        return "Core"

    def _extract_field_specs(self, story: str) -> List[Dict[str, Any]]:
        """Heuristic field spec extraction from user story text."""
        import re
        fields = []
        story_lower = story.lower()

        # Amount/price fields
        if any(w in story_lower for w in ["amount", "price", "cost", "fee", "total"]):
            fields.append({"name": "amount", "type": "float", "min": 0.01, "max": 999999.99, "required": True})

        # Quantity fields
        if any(w in story_lower for w in ["quantity", "count", "number of", "qty"]):
            fields.append({"name": "quantity", "type": "integer", "min": 1, "max": 10000, "required": True})

        # Age fields
        if "age" in story_lower:
            fields.append({"name": "age", "type": "integer", "min": 0, "max": 150, "required": True})

        # Name/title fields
        if any(w in story_lower for w in ["name", "title", "label"]):
            fields.append({"name": "name", "type": "string", "min": 1, "max": 255, "required": True})

        # Email fields
        if "email" in story_lower:
            fields.append({"name": "email", "type": "email", "required": True})

        # Phone fields
        if "phone" in story_lower or "mobile" in story_lower:
            fields.append({"name": "phone", "type": "phone", "required": False})

        # Date fields
        if any(w in story_lower for w in ["date", "deadline", "expiry", "expiration", "dob"]):
            fields.append({"name": "date", "type": "date", "required": True})

        # Status fields
        if "status" in story_lower:
            fields.append({"name": "status", "type": "enum",
                           "values": ["active", "inactive", "pending", "cancelled"], "required": True})

        # Percentage/discount
        if any(w in story_lower for w in ["discount", "percentage", "percent", "%"]):
            fields.append({"name": "discount_percentage", "type": "float", "min": 0.0, "max": 100.0, "required": False})

        # Default if nothing found
        if not fields:
            fields.append({"name": "input_field", "type": "string", "min": 1, "max": 200, "required": True})

        return fields

    def _build_scenarios(
        self,
        bva_results: List[Dict],
        ep_results: List[Dict],
        pairwise_results: List[Dict],
        dt_result: Dict,
        state_tests: Dict,
        flow_steps: List[Dict],
        limits: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """Combine all analytical scenarios into a unified list."""
        if limits is None:
            limits = {"bva": 10, "ep": 8, "pairwise": 5, "dt": 5, "state": 3, "flow": 3}
        scenarios: List[Dict[str, Any]] = []
        counter = 1

        for bva in bva_results[:limits["bva"]]:
            scenarios.append({
                "id": f"TC-BVA-{counter:03d}",
                "type": "boundary_value",
                "scenario_type": bva.get("scenario_type", "boundary"),
                "title": f"[BVA] {bva.get('field', '')} = {bva.get('value', '')} ({bva.get('description', '')})",
                "description": bva.get("description", ""),
                "preconditions": ["System in valid state"],
                "steps": [
                    f"Set field '{bva.get('field', '')}' to value: {bva.get('value', '')}",
                    "Submit the operation",
                    f"Verify: {bva.get('expected_result', '')}",
                ],
                "expected_result": bva.get("expected_result", ""),
                "risk_level": "high" if bva.get("scenario_type") == "negative" else "medium",
                "traceability": f"Feature → BVA on field '{bva.get('field', '')}' → {bva.get('description', '')}",
            })
            counter += 1

        for ep in ep_results[:limits["ep"]]:
            scenarios.append({
                "id": f"TC-EP-{counter:03d}",
                "type": "equivalence_partition",
                "scenario_type": "negative" if ep.get("partition_class") == "invalid" else "functional",
                "title": f"[EP] {ep.get('partition_class', '').upper()}: {ep.get('field', '')} = {ep.get('value', '')}",
                "description": ep.get("description", ""),
                "preconditions": ["System in valid state"],
                "steps": [
                    f"Set field '{ep.get('field', '')}' to: {ep.get('value', '')}",
                    "Submit the operation",
                    f"Verify: {ep.get('expected_result', '')}",
                ],
                "expected_result": ep.get("expected_result", ""),
                "risk_level": "high" if ep.get("partition_class") == "invalid" else "low",
                "traceability": f"Feature → EP class '{ep.get('partition_class', '')}' → {ep.get('field', '')}",
            })
            counter += 1

        for pw in pairwise_results[:limits["pairwise"]]:
            params_str = ", ".join(f"{k}={v}" for k, v in pw.get("parameters", {}).items())
            scenarios.append({
                "id": pw.get("id", f"TC-PW-{counter:03d}"),
                "type": "pairwise",
                "scenario_type": "functional",
                "title": f"[Pairwise] {params_str}",
                "description": pw.get("description", ""),
                "preconditions": [],
                "steps": [f"Set {k} = {v}" for k, v in pw.get("parameters", {}).items()] + ["Execute operation"],
                "expected_result": pw.get("expected_result", "System handles combination correctly"),
                "risk_level": "medium",
                "traceability": "Feature → Pairwise combination testing",
            })
            counter += 1

        for tc in dt_result.get("test_cases", [])[:limits["dt"]]:
            scenarios.append({
                "id": tc.get("id", f"TC-DT-{counter:03d}"),
                "type": "decision_table",
                "scenario_type": tc.get("scenario_type", "functional"),
                "title": tc.get("title", "Decision table test"),
                "description": tc.get("description", ""),
                "preconditions": [],
                "steps": tc.get("steps", []),
                "expected_result": tc.get("expected_result", ""),
                "risk_level": tc.get("risk_level", "medium"),
                "traceability": "Feature → Decision table condition",
            })
            counter += 1

        for st_list in state_tests.values():
            for tc in st_list[:limits["state"]]:
                scenarios.append({
                    "id": tc.get("id", f"TC-ST-{counter:03d}"),
                    "type": "state_transition",
                    "scenario_type": tc.get("scenario_type", "functional"),
                    "title": tc.get("title", "State transition test"),
                    "description": tc.get("description", ""),
                    "preconditions": tc.get("preconditions", []),
                    "steps": tc.get("steps", []),
                    "expected_result": tc.get("expected_result", ""),
                    "risk_level": tc.get("risk_level", "medium"),
                    "traceability": "Feature → State machine → Transition",
                })
                counter += 1

        # Add E2E flow tests
        for step in flow_steps[:limits["flow"]]:
            scenarios.append({
                "id": f"TC-FLOW-{counter:03d}",
                "type": "event_flow",
                "scenario_type": "functional",
                "title": f"[{step.get('layer', '')}] {step.get('action', '')}",
                "description": step.get("validation_point", ""),
                "preconditions": [],
                "steps": [step.get("action", "")],
                "expected_result": step.get("validation_point", ""),
                "risk_level": "high" if step.get("layer") in ("API", "Event") else "medium",
                "traceability": f"Feature → E2E flow → {step.get('layer', '')} layer",
            })
            counter += 1

        return scenarios

    def _format_modules(
        self, modules: List[Dict], impacted: List[Dict]
    ) -> List[Dict[str, Any]]:
        result = []
        for m in modules:
            result.append({
                "id": m.get("id", ""),
                "name": m.get("name", ""),
                "criticality": m.get("criticality", 3),
                "impact_type": "DIRECT",
                "description": m.get("description", ""),
            })
        for m in impacted:
            result.append({
                "id": m.get("id", ""),
                "name": m.get("name", ""),
                "criticality": m.get("criticality", 3),
                "impact_type": "TRANSITIVE",
                "description": m.get("description", ""),
            })
        return result

    def _format_test_scenarios(
        self, analytical: List[Dict], edge_cases: List[Any]
    ) -> List[Dict[str, Any]]:
        scenarios = list(analytical)
        for i, ec in enumerate(edge_cases):
            if isinstance(ec, dict):
                scenarios.append({
                    "id": f"TC-EDGE-{i+1:03d}",
                    "type": "edge_case",
                    "scenario_type": "edge",
                    "title": ec.get("title", f"Edge case {i+1}"),
                    "description": ec.get("condition", ""),
                    "preconditions": [],
                    "steps": [ec.get("condition", "Trigger edge condition"), "Observe system behaviour"],
                    "expected_result": ec.get("expected", "System handles gracefully"),
                    "risk_level": "high",
                    "traceability": f"Feature → Edge case → {ec.get('risk_reason', 'historical pattern')}",
                })
        return scenarios

    def _find_nodes(self, label: str) -> List[Dict]:
        try:
            return get_graph().find_nodes(label)
        except Exception:
            return []


# Singleton
qa_pipeline = QAPipeline()
