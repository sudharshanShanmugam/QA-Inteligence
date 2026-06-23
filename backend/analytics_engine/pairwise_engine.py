"""
Pairwise / N-wise Testing Engine – Brain 2, Component 5

Implements a greedy AllPairs-style algorithm supporting 2-way (pairwise) and
3-way (triple-wise) combination coverage.  3-way coverage catches interaction
bugs that 2-way misses — e.g. user_role × payment_method × coupon_type.
"""

import random
from itertools import combinations
from typing import Any, Dict, List, Set, Tuple


class PairwiseEngine:
    def generate(
        self,
        parameters: Dict[str, List[Any]],
        seed: int = 42,
        strength: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Generate a minimal N-wise test suite.

        parameters: {"param_name": [val1, val2, ...], ...}
        strength:   2 = pairwise (default), 3 = triple-wise
        returns:    list of test case dicts
        """
        if not parameters or len(parameters) < 2:
            return []

        # Auto-upgrade to 3-way when there are 3+ parameters — catches
        # interaction bugs that 2-way misses with minimal extra cases.
        effective_strength = strength
        if effective_strength == 2 and len(parameters) >= 3:
            effective_strength = 3

        random.seed(seed)
        param_names = list(parameters.keys())
        param_values = [parameters[p] for p in param_names]
        n = len(param_names)

        # Build the set of all t-way tuples to cover
        tuples_to_cover: Set[Tuple] = set()
        t = min(effective_strength, n)
        for indices in combinations(range(n), t):
            for value_combo in _cartesian([param_values[i] for i in indices]):
                key = tuple(
                    item
                    for pair in zip(indices, [str(v) for v in value_combo])
                    for item in pair
                )
                tuples_to_cover.add(key)

        test_cases: List[Dict[str, Any]] = []
        max_iterations = len(tuples_to_cover) * 4  # safety cap
        iteration = 0

        while tuples_to_cover and iteration < max_iterations:
            iteration += 1
            best_candidate = None
            best_coverage = -1

            # Sample N random candidates; keep the one covering the most uncovered tuples
            for _ in range(80):
                candidate = {param_names[k]: random.choice(param_values[k]) for k in range(n)}
                coverage = _count_covered(candidate, param_names, t, tuples_to_cover)
                if coverage > best_coverage:
                    best_coverage = coverage
                    best_candidate = candidate

            if best_candidate:
                test_cases.append(best_candidate)
                _remove_covered(best_candidate, param_names, t, tuples_to_cover)

        # Annotate with test IDs
        annotated = []
        for idx, tc in enumerate(test_cases, 1):
            annotated.append({
                "id": f"PW-{idx:03d}",
                "type": "pairwise",
                "scenario_type": "functional",
                "combination_strength": effective_strength,
                "parameters": tc,
                "title": (
                    f"{'Triple' if effective_strength == 3 else 'Pairwise'}-wise "
                    f"Combination {idx}: {', '.join(f'{k}={v}' for k, v in tc.items())}"
                ),
                "description": (
                    f"Covers all {effective_strength}-way interactions among: {list(tc.keys())}"
                ),
                "expected_result": "System handles combination correctly",
            })
        return annotated


# ── helpers ───────────────────────────────────────────────────────────────────

def _cartesian(lists: List[List[Any]]) -> List[List[Any]]:
    """Return the cartesian product of a list of lists."""
    result = [[]]
    for lst in lists:
        result = [x + [y] for x in result for y in lst]
    return result


def _count_covered(
    candidate: Dict[str, Any],
    param_names: List[str],
    t: int,
    tuples_to_cover: Set[Tuple],
) -> int:
    n = len(param_names)
    count = 0
    for indices in combinations(range(n), t):
        key = tuple(
            item
            for pair in zip(indices, [str(candidate[param_names[i]]) for i in indices])
            for item in pair
        )
        if key in tuples_to_cover:
            count += 1
    return count


def _remove_covered(
    candidate: Dict[str, Any],
    param_names: List[str],
    t: int,
    tuples_to_cover: Set[Tuple],
) -> None:
    n = len(param_names)
    for indices in combinations(range(n), t):
        key = tuple(
            item
            for pair in zip(indices, [str(candidate[param_names[i]]) for i in indices])
            for item in pair
        )
        tuples_to_cover.discard(key)

    def extract_parameters_from_story(self, story: str) -> Dict[str, List[Any]]:
        """
        Heuristic extraction of testable parameters from a user story.
        Returns a parameter map for pairwise generation.
        """
        import re

        params: Dict[str, List[Any]] = {}

        # Role/user type patterns
        role_match = re.search(r'as (?:a|an) (\w+)', story.lower())
        if role_match:
            params["user_role"] = [role_match.group(1), "admin", "guest"]

        # Status/state mentions
        statuses = re.findall(r'\b(active|inactive|pending|approved|rejected|draft|published)\b', story.lower())
        if statuses:
            params["status"] = list(set(statuses))

        # Quantity/amount mentions
        if any(w in story.lower() for w in ["amount", "quantity", "count", "number", "limit"]):
            params["quantity"] = [0, 1, 10, 100, -1]

        # Boolean flag patterns
        if any(w in story.lower() for w in ["enabled", "disabled", "true", "false", "flag", "toggle"]):
            params["flag"] = [True, False]

        # Device/platform patterns
        if any(w in story.lower() for w in ["mobile", "desktop", "app", "browser", "device"]):
            params["device"] = ["mobile", "desktop", "tablet"]

        # Payment/pricing patterns
        if any(w in story.lower() for w in ["payment", "price", "discount", "coupon", "promo"]):
            params["payment_type"] = ["credit_card", "debit_card", "upi", "wallet", "netbanking"]
            params["discount_applied"] = [True, False]

        # Auth patterns
        if any(w in story.lower() for w in ["login", "auth", "token", "session", "otp"]):
            params["auth_state"] = ["authenticated", "unauthenticated", "expired_token"]

        # Default minimal params if extraction found nothing
        if not params:
            params = {
                "input_type": ["valid", "invalid", "boundary"],
                "user_state": ["new", "existing", "inactive"],
                "network_condition": ["online", "offline", "slow"],
            }

        return params


pairwise_engine = PairwiseEngine()
