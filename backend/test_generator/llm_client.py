"""
LLM client wrapping Ollama via LangChain.

Key design: LLM is called with structured analytical data.
It formats intelligence, it does NOT invent intelligence.
"""

import json
import re
from typing import Any, Dict, Generator, List, Optional
import structlog

from config import settings

log = structlog.get_logger()


class LLMClient:
    def __init__(self):
        self._llm = None
        self._streaming_llm = None

    def _get_llm(self, temperature: float = 0.2):
        from langchain_ollama import OllamaLLM
        return OllamaLLM(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=temperature,
        )

    def generate(self, prompt: str, temperature: float = 0.2, max_retries: int = 2) -> str:
        """Generate text from a prompt. Returns raw string."""
        llm = self._get_llm(temperature)
        for attempt in range(max_retries + 1):
            try:
                result = llm.invoke(prompt)
                return result
            except Exception as e:
                log.warning("llm_generation_failed", attempt=attempt, error=str(e))
                if attempt == max_retries:
                    return f"[LLM unavailable: {str(e)}]"

    def generate_json(self, prompt: str, fallback: Any = None) -> Any:
        """Generate and parse JSON from LLM. Falls back gracefully."""
        raw = self.generate(prompt + "\n\nRespond with valid JSON only, no markdown fences.")
        return self._parse_json(raw, fallback)

    def stream(self, prompt: str, temperature: float = 0.3) -> Generator[str, None, None]:
        """Stream tokens from the LLM."""
        llm = self._get_llm(temperature)
        try:
            for chunk in llm.stream(prompt):
                yield chunk
        except Exception as e:
            log.warning("llm_stream_failed", error=str(e))
            yield f"[Stream error: {str(e)}]"

    def generate_feature_understanding(
        self,
        user_story: str,
        rag_context: str,
        module_name: str,
        apis: List[str],
        events: List[str],
        business_rules: List[str],
    ) -> str:
        from test_generator.prompt_templates import FEATURE_UNDERSTANDING_PROMPT
        prompt = FEATURE_UNDERSTANDING_PROMPT.format(
            user_story=user_story[:500],
            rag_context=rag_context[:1500],
            module_name=module_name or "Unknown",
            apis=", ".join(apis[:5]) or "None identified",
            events=", ".join(events[:5]) or "None identified",
            business_rules=", ".join(str(r) for r in business_rules[:5]) or "None identified",
        )
        result = self.generate(prompt, temperature=0.3)
        return result or "Feature understanding not available – insufficient context in knowledge base."

    def generate_gherkin(
        self,
        user_story: str,
        scenarios: List[Dict[str, Any]],
        risk_context: str,
        warnings: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import GHERKIN_GENERATION_PROMPT

        scenarios_text = "\n".join(
            f"{i+1}. [{s.get('type','').upper()}] {s.get('title','')}: {s.get('description','')}"
            for i, s in enumerate(scenarios[:15])
        )
        warnings_text = "\n".join(
            f"- {w.get('warning', '')} → {w.get('recommendation', '')}"
            for w in warnings[:5]
        )

        prompt = GHERKIN_GENERATION_PROMPT.format(
            user_story=user_story[:400],
            scenarios=scenarios_text,
            risk_context=risk_context[:400],
            warnings=warnings_text,
        )
        raw = self.generate(prompt, temperature=0.2)
        return self._parse_gherkin(raw, scenarios[:10])

    def generate_edge_cases(
        self,
        feature_name: str,
        bug_context: str,
        bva_results: List[Dict],
        ep_results: List[Dict],
        state_machine: Optional[Dict],
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import EDGE_CASE_PROMPT

        prompt = EDGE_CASE_PROMPT.format(
            feature_name=feature_name,
            bug_context=bug_context[:800],
            bva_results=json.dumps(bva_results[:5], default=str),
            ep_results=json.dumps(ep_results[:5], default=str),
            state_machine=json.dumps(state_machine or {}, default=str),
        )
        result = self.generate_json(prompt, fallback=[])
        return result if isinstance(result, list) else []

    def generate_signoff_checklist(
        self,
        feature_name: str,
        risk_level: str,
        modules: List[str],
        total_tests: int,
        regression_count: int,
        gaps: List[Dict],
        warnings_count: int,
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import SIGNOFF_CHECKLIST_PROMPT

        prompt = SIGNOFF_CHECKLIST_PROMPT.format(
            feature_name=feature_name,
            risk_level=risk_level,
            modules=", ".join(modules[:5]),
            total_tests=total_tests,
            regression_count=regression_count,
            gaps=json.dumps([g.get("description", "") for g in gaps[:5]], default=str),
            warnings_count=warnings_count,
        )
        result = self.generate_json(prompt, fallback=[])
        return result if isinstance(result, list) else self._default_checklist()

    def generate_api_validations(
        self, apis: List[Dict[str, Any]], events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import API_VALIDATION_PROMPT

        apis_text = json.dumps([
            {"endpoint": a.get("endpoint", a.get("name", "")), "method": a.get("method", "GET")}
            for a in apis[:8]
        ], default=str)
        events_text = json.dumps([
            {"name": e.get("name", ""), "topic": e.get("topic", "")}
            for e in events[:5]
        ], default=str)

        prompt = API_VALIDATION_PROMPT.format(apis=apis_text, events=events_text)
        result = self.generate_json(prompt, fallback=[])
        return result if isinstance(result, list) else self._default_api_validations(apis)

    # ── Parsers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_json(raw: str, fallback: Any) -> Any:
        if not raw:
            return fallback
        raw = raw.strip()
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r'(\[.*\]|\{.*\})', raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
        return fallback

    @staticmethod
    def _parse_gherkin(raw: str, scenarios: List[Dict]) -> List[Dict[str, Any]]:
        """Parse LLM-generated Gherkin into structured objects."""
        if not raw:
            return []

        gherkin_tests = []
        current = None
        feature_name = ""

        for line in raw.split("\n"):
            line_stripped = line.strip()
            if line_stripped.startswith("Feature:"):
                feature_name = line_stripped[len("Feature:"):].strip()
            elif line_stripped.startswith("Scenario:") or line_stripped.startswith("Scenario Outline:"):
                if current:
                    gherkin_tests.append(current)
                current = {
                    "feature": feature_name,
                    "scenario_title": line_stripped.split(":", 1)[1].strip(),
                    "given": [],
                    "when": [],
                    "then": [],
                    "tags": [],
                }
            elif line_stripped.startswith("@") and current is None:
                pass  # top-level tags
            elif line_stripped.startswith("@") and current is not None:
                current["tags"].extend(t.strip() for t in line_stripped.split() if t.startswith("@"))
            elif line_stripped.startswith("Given") and current:
                current["given"].append(line_stripped)
            elif line_stripped.startswith("And") or line_stripped.startswith("But"):
                if current:
                    for section in ("then", "when", "given"):
                        if current[section]:
                            current[section].append(line_stripped)
                            break
            elif line_stripped.startswith("When") and current:
                current["when"].append(line_stripped)
            elif line_stripped.startswith("Then") and current:
                current["then"].append(line_stripped)

        if current:
            gherkin_tests.append(current)

        # If parsing failed, generate minimal Gherkin from scenarios
        if not gherkin_tests:
            for s in scenarios[:8]:
                gherkin_tests.append({
                    "feature": feature_name or "Feature",
                    "scenario_title": s.get("title", "Test scenario"),
                    "given": ["Given the system is in a known state"],
                    "when": [f"When {s.get('description', 'the action is performed')}"],
                    "then": [f"Then {s.get('expected_result', 'the system responds correctly')}"],
                    "tags": ["@" + s.get("scenario_type", "functional")],
                })

        return gherkin_tests

    @staticmethod
    def _default_checklist() -> List[Dict[str, Any]]:
        return [
            {"category": "Functional", "item": "All happy-path scenarios pass", "status": "MUST_VERIFY", "owner": "QA"},
            {"category": "Functional", "item": "All negative scenarios return correct errors", "status": "MUST_VERIFY", "owner": "QA"},
            {"category": "Regression", "item": "Full regression suite executed", "status": "MUST_VERIFY", "owner": "QA"},
            {"category": "Security", "item": "Auth/authorization tested", "status": "MUST_VERIFY", "owner": "QA"},
            {"category": "Performance", "item": "API response time ≤ SLA under normal load", "status": "PENDING", "owner": "QA"},
            {"category": "Data", "item": "DB state correct after all operations", "status": "MUST_VERIFY", "owner": "Dev"},
            {"category": "Documentation", "item": "Test evidence attached to story", "status": "PENDING", "owner": "QA"},
        ]

    @staticmethod
    def _default_api_validations(apis: List[Dict]) -> List[Dict[str, Any]]:
        result = []
        for api in apis:
            endpoint = api.get("endpoint", api.get("name", "endpoint"))
            method = api.get("method", "GET")
            result.append({
                "endpoint": endpoint,
                "method": method,
                "validations": [
                    f"200: {method} {endpoint} returns success with valid input",
                    f"400: {method} {endpoint} returns validation error with invalid input",
                    f"401: {method} {endpoint} returns 401 with missing/invalid auth",
                    f"403: {method} {endpoint} returns 403 with insufficient permissions",
                    f"404: {method} {endpoint} returns 404 for non-existent resource",
                    f"500: {method} {endpoint} handles server errors gracefully",
                ],
                "event_triggers": [],
                "db_impacts": [],
            })
        return result


llm_client = LLMClient()
