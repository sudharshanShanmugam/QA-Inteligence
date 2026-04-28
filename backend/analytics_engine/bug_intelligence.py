"""
Bug Intelligence Engine – Brain 2, Component 7

Matches new features to historically similar bugs via:
- Module/Feature name similarity
- Root cause pattern matching
- Keyword clustering

Outputs HEADS-UP warnings – not LLM guesses, but pattern-matched evidence.
"""

import re
from collections import defaultdict
from typing import Any, Dict, List, Tuple


SEVERITY_ORDER = {"blocker": 0, "critical": 1, "p1": 1, "high": 2, "p2": 2, "medium": 3, "p3": 3, "low": 4, "p4": 4, "trivial": 5}

# High-risk root cause keywords mapped to warning templates
ROOT_CAUSE_PATTERNS = {
    "race condition": "Race condition risk – ensure thread-safety and idempotency for concurrent requests",
    "null pointer": "Null/undefined reference risk – add null checks at all entry points",
    "null reference": "Null/undefined reference risk – add null checks at all entry points",
    "timeout": "Timeout risk – test with slow network and high load; add circuit breakers",
    "deadlock": "Deadlock risk – review lock ordering; use timeouts on all lock acquisitions",
    "encoding": "Character encoding risk – test with Unicode, special chars, multilingual input",
    "validation": "Input validation gap – ensure server-side validation mirrors client-side rules",
    "auth": "Authentication/authorisation risk – test with expired tokens, missing roles, privilege escalation",
    "cache": "Cache invalidation risk – test after data updates; verify stale data is flushed",
    "pagination": "Pagination edge-case risk – test with 0, 1, max, and overflow page indices",
    "concurrency": "Concurrency risk – test simultaneous operations on the same resource",
    "sql injection": "SQL injection risk – parameterise all queries; fuzz input fields",
    "migration": "Data migration risk – verify existing records are correctly transformed",
    "decimal": "Floating-point/decimal precision risk – test monetary calculations with edge amounts",
    "rounding": "Rounding risk – verify rounding rules for financial calculations",
    "date": "Date/timezone risk – test across DST transitions and timezone boundaries",
    "timezone": "Timezone risk – test across timezone boundaries and DST transitions",
    "limit": "Limit/threshold risk – test at-limit, above-limit, and unlimited scenarios",
    "dependency": "External dependency risk – test with dependency unavailable/slow/returning errors",
    "event": "Event ordering risk – test out-of-order, duplicate, and missing events",
    "rollback": "Transaction rollback risk – test partial failure scenarios",
}


class BugIntelligenceEngine:
    def find_similar_bugs(
        self,
        feature_name: str,
        module_name: str,
        story_text: str,
        all_bugs: List[Dict[str, Any]],
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Score all known bugs by relevance to the current feature.
        Returns top_k bugs, sorted by relevance × severity.
        """
        if not all_bugs:
            return []

        scored: List[Tuple[float, Dict[str, Any]]] = []
        story_lower = story_text.lower()
        feat_lower = feature_name.lower()
        mod_lower = module_name.lower() if module_name else ""

        for bug in all_bugs:
            score = self._relevance_score(bug, feat_lower, mod_lower, story_lower)
            if score > 0:
                scored.append((score, bug))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [b for _, b in scored[:top_k]]

    def generate_warnings(
        self,
        similar_bugs: List[Dict[str, Any]],
        story_text: str,
    ) -> List[Dict[str, Any]]:
        """Convert similar bugs into actionable HEADS-UP warnings."""
        warnings: List[Dict[str, Any]] = []
        used_patterns: set = set()

        # Warnings from similar historical bugs
        for bug in similar_bugs:
            sev = bug.get("severity", "medium").lower()
            warnings.append({
                "warning": f"Similar bug '{bug.get('title', bug.get('id', 'UNKNOWN'))}' was found in a similar area",
                "similar_bug_id": bug.get("id", ""),
                "bug_title": bug.get("title", ""),
                "severity": sev,
                "module": bug.get("module_id", bug.get("module", "")),
                "recommendation": (
                    f"Re-verify: {bug.get('root_cause', 'Root cause unknown')}. "
                    f"Ensure fix did not regress."
                ),
            })

        # Warnings from root cause pattern matching against the story
        story_lower = story_text.lower()
        for bug in similar_bugs:
            root_cause = (bug.get("root_cause", "") + " " + bug.get("description", "")).lower()
            for keyword, template in ROOT_CAUSE_PATTERNS.items():
                if keyword in root_cause and keyword not in used_patterns:
                    used_patterns.add(keyword)
                    warnings.append({
                        "warning": f"[ROOT CAUSE PATTERN] '{keyword}' class defect detected in similar feature",
                        "similar_bug_id": bug.get("id", ""),
                        "bug_title": bug.get("title", ""),
                        "severity": bug.get("severity", "medium"),
                        "module": bug.get("module_id", ""),
                        "recommendation": template,
                    })

        # Warnings from story text directly (proactive)
        for keyword, template in ROOT_CAUSE_PATTERNS.items():
            if keyword in story_lower and keyword not in used_patterns:
                used_patterns.add(keyword)
                warnings.append({
                    "warning": f"[PROACTIVE] Story mentions '{keyword}' – historically a source of defects",
                    "similar_bug_id": "",
                    "bug_title": "",
                    "severity": "medium",
                    "module": "",
                    "recommendation": template,
                })

        # Sort: critical first
        warnings.sort(key=lambda w: SEVERITY_ORDER.get(w["severity"].lower(), 5))
        return warnings

    def get_bug_patterns(self, all_bugs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate bug statistics for risk calculation."""
        severity_dist: Dict[str, int] = defaultdict(int)
        module_counts: Dict[str, int] = defaultdict(int)
        root_cause_freq: Dict[str, int] = defaultdict(int)

        for bug in all_bugs:
            sev = bug.get("severity", "unknown").lower()
            severity_dist[sev] += 1
            mod = bug.get("module_id", bug.get("module", "unknown"))
            module_counts[mod] += 1
            root = bug.get("root_cause", "").lower()
            for kw in ROOT_CAUSE_PATTERNS:
                if kw in root:
                    root_cause_freq[kw] += 1

        return {
            "total_bugs": len(all_bugs),
            "severity_distribution": dict(severity_dist),
            "bugs_per_module": dict(module_counts),
            "root_cause_frequency": dict(root_cause_freq),
            "hotspot_modules": sorted(module_counts, key=module_counts.get, reverse=True)[:5],
        }

    # ── Scoring ────────────────────────────────────────────────────────────────

    def _relevance_score(
        self, bug: Dict[str, Any], feat_lower: str, mod_lower: str, story_lower: str
    ) -> float:
        score = 0.0
        bug_text = (
            bug.get("title", "") + " " +
            bug.get("description", "") + " " +
            bug.get("feature", bug.get("feature_id", "")) + " " +
            bug.get("module_id", bug.get("module", ""))
        ).lower()

        # Module match (strong signal)
        if mod_lower and mod_lower in bug_text:
            score += 0.40

        # Feature name match
        if feat_lower and feat_lower in bug_text:
            score += 0.30

        # Keyword overlap between story and bug
        story_words = set(re.findall(r'\b\w{4,}\b', story_lower))
        bug_words = set(re.findall(r'\b\w{4,}\b', bug_text))
        overlap = len(story_words & bug_words)
        score += min(0.30, overlap * 0.05)

        # Severity boost (higher severity = more important to surface)
        sev = bug.get("severity", "medium").lower()
        sev_boost = {0: 0.10, 1: 0.10, 2: 0.07, 3: 0.04, 4: 0.01, 5: 0.0}
        score += sev_boost.get(SEVERITY_ORDER.get(sev, 3), 0.0)

        return score


bug_intelligence = BugIntelligenceEngine()
