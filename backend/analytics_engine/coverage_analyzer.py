"""
Coverage Analyzer – Brain 2, Component 10

Identifies gaps in existing test coverage:
- Features with no test cases
- Untested state transitions
- Uncovered APIs
- Missing equivalence classes
- Missing negative/edge scenarios
"""

from typing import Any, Dict, List, Set


class CoverageAnalyzer:
    def analyze(
        self,
        features: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        apis: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
        states: List[Dict[str, Any]],
        bugs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Return a list of coverage gaps with recommendations and coverage percentages."""
        gaps: List[Dict[str, Any]] = []

        gaps.extend(self._feature_coverage_gaps(features, test_cases))
        gaps.extend(self._api_coverage_gaps(apis, test_cases))
        gaps.extend(self._event_coverage_gaps(events, test_cases))
        gaps.extend(self._scenario_type_gaps(test_cases, features))
        gaps.extend(self._bug_driven_gaps(bugs, test_cases))
        gaps.extend(self._state_coverage_gaps(states, test_cases))

        return gaps

    def coverage_summary(
        self,
        features: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        apis: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
        states: List[Dict[str, Any]],
        bugs: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Return percentage-based coverage metrics across all dimensions."""

        def _pct(covered: int, total: int) -> float:
            return round(covered / total * 100, 1) if total else 100.0

        # Features
        tested_features: Set[str] = set()
        for tc in test_cases:
            fid = tc.get("feature_id", tc.get("feature", ""))
            if fid:
                tested_features.add(fid.lower())
        covered_features = sum(
            1 for f in features
            if f.get("id", f.get("name", "")).lower() in tested_features
            or f.get("name", "").lower() in tested_features
        )

        # APIs
        tc_text = " ".join(
            (tc.get("name", "") + " " + tc.get("description", "")).lower()
            for tc in test_cases
        )
        covered_apis = sum(
            1 for api in apis
            if any(
                part in tc_text
                for part in api.get("endpoint", api.get("name", "")).lower()
                           .replace("/", "").replace("{", "").replace("}", "").split()
                if len(part) > 3
            )
        )

        # Events
        covered_events = sum(
            1 for ev in events
            if ev.get("name", "").lower() in tc_text
        )

        # States
        covered_states = sum(
            1 for s in states
            if s.get("name", "").lower() in tc_text
        )

        # Bugs with regression tests
        covered_bugs = sum(
            1 for bug in bugs
            if bug.get("status", "").lower() in ("fixed", "closed", "resolved")
            and (
                bug.get("id", "").lower() in tc_text
                or bug.get("title", "").lower()[:20] in tc_text
            )
        )
        closed_bugs = sum(
            1 for bug in bugs
            if bug.get("status", "").lower() in ("fixed", "closed", "resolved")
        )

        # Scenario type diversity
        types_present: Set[str] = {
            tc.get("type", tc.get("scenario_type", "functional")).lower()
            for tc in test_cases
        }
        needed_types = {"negative", "edge", "security", "performance"}
        covered_types = len(needed_types & types_present)

        return {
            "feature_coverage_pct": _pct(covered_features, len(features)),
            "feature_covered": covered_features,
            "feature_total": len(features),
            "api_coverage_pct": _pct(covered_apis, len(apis)),
            "api_covered": covered_apis,
            "api_total": len(apis),
            "event_coverage_pct": _pct(covered_events, len(events)),
            "event_covered": covered_events,
            "event_total": len(events),
            "state_coverage_pct": _pct(covered_states, len(states)),
            "state_covered": covered_states,
            "state_total": len(states),
            "bug_regression_coverage_pct": _pct(covered_bugs, closed_bugs),
            "bugs_with_regression": covered_bugs,
            "closed_bugs_total": closed_bugs,
            "scenario_type_diversity_pct": _pct(covered_types, len(needed_types)),
            "scenario_types_present": sorted(types_present),
            "scenario_types_missing": sorted(needed_types - types_present),
        }

    # ── Feature gaps ──────────────────────────────────────────────────────────

    def _feature_coverage_gaps(
        self, features: List[Dict[str, Any]], test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        gaps = []
        tested_features: Set[str] = set()
        for tc in test_cases:
            fid = tc.get("feature_id", tc.get("feature", ""))
            if fid:
                tested_features.add(fid.lower())

        for feat in features:
            fid = feat.get("id", feat.get("name", "")).lower()
            fname = feat.get("name", fid)
            if fid not in tested_features and fname.lower() not in tested_features:
                gaps.append({
                    "area": fname,
                    "gap_type": "missing_test",
                    "description": f"Feature '{fname}' has NO test cases in the knowledge graph",
                    "recommendation": f"Create minimum: 1 happy-path, 1 negative, 1 edge case for '{fname}'",
                })
        return gaps

    # ── API gaps ──────────────────────────────────────────────────────────────

    def _api_coverage_gaps(
        self, apis: List[Dict[str, Any]], test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        gaps = []
        tc_text = " ".join(
            (tc.get("name", "") + " " + tc.get("description", "")).lower()
            for tc in test_cases
        )

        for api in apis:
            endpoint = api.get("endpoint", api.get("name", ""))
            method = api.get("method", "GET")
            endpoint_lower = endpoint.lower().replace("/", "").replace("{", "").replace("}", "")

            if not any(part in tc_text for part in endpoint_lower.split() if len(part) > 3):
                gaps.append({
                    "area": f"{method} {endpoint}",
                    "gap_type": "untested_flow",
                    "description": f"API endpoint '{method} {endpoint}' has no corresponding test cases",
                    "recommendation": (
                        f"Add tests for: {method} {endpoint} – "
                        f"200 success, 400 invalid input, 401 unauthorized, 404 not found, 500 server error"
                    ),
                })

        return gaps

    # ── Event gaps ────────────────────────────────────────────────────────────

    def _event_coverage_gaps(
        self, events: List[Dict[str, Any]], test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        gaps = []
        tc_text = " ".join(
            (tc.get("name", "") + " " + tc.get("description", "")).lower()
            for tc in test_cases
        )

        for event in events:
            ev_name = event.get("name", "").lower()
            if ev_name and ev_name not in tc_text:
                gaps.append({
                    "area": f"Event: {event.get('name', '')}",
                    "gap_type": "untested_flow",
                    "description": f"Event '{event.get('name', '')}' is not covered by any test case",
                    "recommendation": (
                        f"Add: publish test (happy path), consumer test, "
                        f"duplicate event test (idempotency), schema validation test for '{event.get('name', '')}'"
                    ),
                })

        return gaps

    # ── Scenario type gaps ────────────────────────────────────────────────────

    def _scenario_type_gaps(
        self, test_cases: List[Dict[str, Any]], features: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        gaps = []
        types_present: Set[str] = set()
        for tc in test_cases:
            types_present.add(tc.get("type", tc.get("scenario_type", "functional")).lower())

        needed_types = {
            "negative": "No negative test cases found – add invalid input, unauthorised access, and error path tests",
            "edge": "No edge case tests found – add boundary, empty, null, and overflow scenarios",
            "security": "No security test cases found – add XSS, SQL injection, auth bypass, IDOR tests",
            "performance": "No performance test cases found – consider load and latency SLA tests for critical APIs",
        }

        for tc_type, recommendation in needed_types.items():
            if tc_type not in types_present:
                gaps.append({
                    "area": f"Test type: {tc_type}",
                    "gap_type": "edge_case" if tc_type in ("edge", "security") else "missing_test",
                    "description": f"No '{tc_type}' test cases exist in the knowledge graph",
                    "recommendation": recommendation,
                })

        return gaps

    # ── Bug-driven gaps ───────────────────────────────────────────────────────

    def _bug_driven_gaps(
        self, bugs: List[Dict[str, Any]], test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Every closed bug should have a regression test. Flag those that don't."""
        gaps = []
        tc_text = " ".join(tc.get("name", "").lower() for tc in test_cases)

        for bug in bugs:
            if bug.get("status", "").lower() in ("fixed", "closed", "resolved"):
                bug_id = bug.get("id", "")
                bug_title = bug.get("title", "")
                if bug_id.lower() not in tc_text and bug_title.lower()[:20] not in tc_text:
                    gaps.append({
                        "area": f"Bug: {bug_id} – {bug_title}",
                        "gap_type": "missing_test",
                        "description": f"Fixed bug '{bug_id}' has no corresponding regression test",
                        "recommendation": (
                            f"Add regression test: reproduce scenario from bug '{bug_id}'; "
                            f"verify fix holds. Severity was: {bug.get('severity', 'unknown')}"
                        ),
                    })

        return gaps

    # ── State coverage gaps ───────────────────────────────────────────────────

    def _state_coverage_gaps(
        self, states: List[Dict[str, Any]], test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        gaps = []
        tc_text = " ".join(tc.get("name", "").lower() for tc in test_cases)

        for state in states:
            state_name = state.get("name", "").lower()
            if state_name and state_name not in tc_text:
                gaps.append({
                    "area": f"State: {state.get('name', '')}",
                    "gap_type": "untested_flow",
                    "description": f"State '{state.get('name', '')}' is not explicitly tested",
                    "recommendation": (
                        f"Add: enter-state test, remain-in-state test, "
                        f"and exit-state test for '{state.get('name', '')}'"
                    ),
                })

        return gaps


coverage_analyzer = CoverageAnalyzer()
