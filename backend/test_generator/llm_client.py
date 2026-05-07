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

    def _get_llm(self, temperature: float = 0):
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            openai_api_key=settings.DEEPINFRA_API_KEY,
            openai_api_base=settings.DEEPINFRA_BASE_URL,
            model=settings.LLM_MODEL,
            temperature=temperature,
            seed=42,
            timeout=60,
            max_retries=1,
        )

    def generate(self, prompt: str, temperature: float = 0, max_retries: int = 2) -> str:
        """Generate text from a prompt. Returns raw string."""
        llm = self._get_llm(temperature)
        for attempt in range(max_retries + 1):
            try:
                result = llm.invoke(prompt)
                return result.content if hasattr(result, "content") else str(result)
            except Exception as e:
                log.warning("llm_generation_failed", attempt=attempt, error=str(e))
                if attempt == max_retries:
                    return f"[LLM unavailable: {str(e)}]"

    def generate_json(self, prompt: str, fallback: Any = None) -> Any:
        """Generate and parse JSON from LLM. Falls back gracefully."""
        raw = self.generate(prompt + "\n\nRespond with valid JSON only, no markdown fences.")
        return self._parse_json(raw, fallback)

    def stream(self, prompt: str, temperature: float = 0) -> Generator[str, None, None]:
        """Stream tokens from the LLM."""
        llm = self._get_llm(temperature)
        try:
            for chunk in llm.stream(prompt):
                yield chunk.content if hasattr(chunk, "content") else str(chunk)
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
        result = self.generate(prompt, temperature=0)
        return result or "Feature understanding not available – insufficient context in knowledge base."

    def generate_gherkin(
        self,
        user_story: str,
        scenarios: List[Dict[str, Any]],
        risk_context: str,
        warnings: List[Dict[str, Any]],
        gherkin_limit: int = 12,
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import GHERKIN_GENERATION_PROMPT

        scenarios_text = "\n".join(
            f"{i+1}. [{s.get('type','').upper()}] {s.get('title','')}: {s.get('description','')}"
            for i, s in enumerate(scenarios[:gherkin_limit])
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
            gherkin_limit=gherkin_limit,
        )
        raw = self.generate(prompt, temperature=0)
        return self._parse_gherkin(raw, scenarios[:gherkin_limit])

    def generate_edge_cases(
        self,
        feature_name: str,
        bug_context: str,
        bva_results: List[Dict],
        ep_results: List[Dict],
        state_machine: Optional[Dict],
        edge_count: int = 8,
    ) -> List[Dict[str, Any]]:
        from test_generator.prompt_templates import EDGE_CASE_PROMPT

        prompt = EDGE_CASE_PROMPT.format(
            feature_name=feature_name,
            bug_context=bug_context[:800],
            bva_results=json.dumps(bva_results[:5], default=str),
            ep_results=json.dumps(ep_results[:5], default=str),
            state_machine=json.dumps(state_machine or {}, default=str),
            edge_count=edge_count,
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

    def generate_risk_assessment(
        self,
        user_story: str,
        feature_name: str,
        module_name: str,
        bugs: list,
        modules: list,
        apis: list,
        events: list,
        states: list,
        priority: str,
    ) -> list:
        """LLM-based risk reasoning — returns ranked list of risk areas.

        Each item matches the schema:
        { module, feature, risk_score, priority, reasons, past_bug_count }
        """
        bugs_summary = "\n".join(
            f"- [{b.get('severity','?').upper()}] {b.get('title', b.get('name','?'))}: "
            f"{b.get('description', b.get('root_cause', ''))[:120]}"
            for b in bugs[:15]
        ) or "None"

        modules_summary = ", ".join(
            f"{m.get('name','?')} (criticality {m.get('criticality', 3)}/5)"
            for m in modules[:8]
        ) or "None"

        apis_summary = ", ".join(
            f"{a.get('method','?')} {a.get('endpoint', a.get('name','?'))}"
            for a in apis[:8]
        ) or "None"

        events_summary = ", ".join(e.get("name", "?") for e in events[:6]) or "None"
        states_summary = ", ".join(s.get("name", "?") for s in states[:6]) or "None"

        prompt = (
            "You are a senior QA architect with 20+ years of experience in risk-based testing.\n"
            "Analyze the feature below and reason about ALL risk areas like an expert — consider:\n"
            "- Past bug patterns and their severity\n"
            "- Business criticality and financial impact\n"
            "- Integration complexity (APIs, events, DB)\n"
            "- State machine complexity\n"
            "- Security, concurrency, and data integrity risks\n"
            "- What could go wrong in production\n\n"
            f"Feature: {feature_name}\n"
            f"Module: {module_name}\n"
            f"Detected Priority: {priority}\n\n"
            f"User Story:\n{user_story[:600]}\n\n"
            f"Past Bugs (from knowledge base):\n{bugs_summary}\n\n"
            f"Modules involved: {modules_summary}\n"
            f"APIs involved: {apis_summary}\n"
            f"Events involved: {events_summary}\n"
            f"States involved: {states_summary}\n\n"
            "Return a JSON array of risk areas — one entry per distinct risk area (max 6).\n"
            "Each entry must have:\n"
            '- "feature": the feature or area name\n'
            '- "module": the module name\n'
            '- "risk_score": float 0.0–1.0 (P1≥0.75, P2≥0.50, P3≥0.25, P4<0.25)\n'
            '- "priority": "P1" | "P2" | "P3" | "P4"\n'
            '- "reasons": list of 2–4 specific reason strings explaining the risk\n'
            '- "past_bug_count": integer count of related past bugs\n\n'
            "Sort by risk_score descending. Respond with JSON array only."
        )

        result = self.generate_json(prompt, fallback=[])
        if not isinstance(result, list):
            return self._fallback_risk(feature_name, module_name, bugs, priority)

        valid = []
        for item in result:
            if not isinstance(item, dict):
                continue
            score = float(item.get("risk_score", 0.5))
            score = round(min(1.0, max(0.0, score)), 3)
            item["risk_score"] = score
            item.setdefault("priority", self._risk_label(score))
            item.setdefault("feature", feature_name)
            item.setdefault("module", module_name)
            item.setdefault("reasons", ["LLM-assessed risk"])
            item.setdefault("past_bug_count", 0)
            valid.append(item)

        log.info("llm_risk_assessment_complete", areas=len(valid), top_priority=valid[0]["priority"] if valid else "?")
        return sorted(valid, key=lambda x: x["risk_score"], reverse=True)

    @staticmethod
    def _risk_label(score: float) -> str:
        if score >= 0.75: return "P1"
        if score >= 0.50: return "P2"
        if score >= 0.25: return "P3"
        return "P4"

    @staticmethod
    def _fallback_risk(feature_name: str, module_name: str, bugs: list, priority: str) -> list:
        """Rule-based fallback when LLM is unavailable."""
        bug_count = len(bugs)
        score = min(1.0, 0.3 + (bug_count * 0.08) + (0.2 if priority in ("high", "critical") else 0))
        return [{
            "feature": feature_name,
            "module": module_name,
            "risk_score": round(score, 3),
            "priority": "P1" if score >= 0.75 else "P2" if score >= 0.5 else "P3",
            "reasons": [f"{bug_count} historical bugs", f"Priority: {priority}"],
            "past_bug_count": bug_count,
        }]

    def infer_story_metadata(self, user_story: str) -> dict:
        """Auto-detect module, priority, and risk level from a user story.

        Returns: {"module": str, "priority": "low|medium|high|critical", "risk_level": "low|medium|high|critical"}
        """
        prompt = (
            "You are a senior QA analyst. Read the user story below and extract three things.\n\n"
            f"User Story:\n{user_story}\n\n"
            "Return ONLY this JSON — no markdown, no explanation:\n"
            "{\n"
            '  "module": "<which application module this belongs to, e.g. Checkout, Auth, Payments, Cart, User Management, Search, Notifications, Reporting, Inventory, Shipping, Core>",\n'
            '  "priority": "<one of: low | medium | high | critical>",\n'
            '  "risk_level": "<one of: low | medium | high | critical — based on business impact, data sensitivity, and complexity>",\n'
            '  "reason": "<one sentence explaining the priority and risk assessment>"\n'
            "}"
        )
        result = self.generate_json(prompt, fallback={
            "module": "Core", "priority": "medium", "risk_level": "medium", "reason": "fallback"
        })
        if not isinstance(result, dict):
            return {"module": "Core", "priority": "medium", "risk_level": "medium", "reason": "fallback"}

        valid_priorities = {"low", "medium", "high", "critical"}
        if result.get("priority") not in valid_priorities:
            result["priority"] = "medium"
        if result.get("risk_level") not in valid_priorities:
            result["risk_level"] = "medium"
        if not result.get("module"):
            result["module"] = "Core"

        log.info("story_metadata_inferred",
                 module=result["module"], priority=result["priority"],
                 risk=result["risk_level"], reason=result.get("reason", ""))
        return result

    def recommend_chunking_strategy(self, document: dict) -> str:
        """Send a document preview to the LLM and ask which chunking strategy fits best.

        Returns one of: structured | section | paragraph | sentence | semantic
        Falls back to a rule-based guess if the LLM is unavailable.
        """
        doc_type = document.get("doc_type", "unknown")
        fmt = document.get("format", "text")
        content = document.get("content", "")[:2000]

        prompt = (
            "You are a document processing expert building a RAG knowledge base. "
            "Analyze the document excerpt below and pick the single best chunking strategy.\n\n"
            f"Document Type: {doc_type}\n"
            f"Format: {fmt}\n"
            f"Document Excerpt (first 2000 chars):\n{content}\n\n"
            "Choose ONE strategy from this exact list:\n"
            '- "recursive_meta"   : Recursive splitting with rich metadata on every chunk. '
            "Best for most flat documents — recommended default.\n"
            '- "auto"             : Let the system inspect the document and decide automatically.\n'
            '- "recursive"        : Smart recursive split using multiple separator tiers '
            "(double newline → newline → sentence → word). Good for long mixed prose.\n"
            '- "markdown_header"  : Split strictly at # / ## / ### / #### boundaries. '
            "Best when the document is markdown with clear header hierarchy.\n"
            '- "structure"        : Field-aware split for typed JSON documents '
            "(user stories, bug reports, API specs, DB schemas, event definitions).\n"
            '- "sentence"         : Sentence-level splitting. Best for dense technical specs '
            "where every sentence carries critical information.\n"
            '- "paragraph"        : Pure paragraph splitting. Best for narrative prose, '
            "meeting notes, plain-text descriptions.\n"
            '- "fixed"            : Fixed 500-character chunks with 50-char overlap. '
            "Use when structure is absent and uniform chunk size matters.\n"
            '- "token"            : Approximate token-based splitting (~256 tokens per chunk). '
            "Best for LLM context-window alignment.\n\n"
            'Respond with JSON only: {"strategy": "<strategy>", "reason": "<one sentence why>"}'
        )

        result = self.generate_json(
            prompt, fallback={"strategy": self._fallback_strategy(doc_type, fmt)}
        )

        valid = {
            "recursive_meta", "auto", "recursive", "markdown_header",
            "structure", "sentence", "paragraph", "fixed", "token",
        }
        strategy = result.get("strategy", "") if isinstance(result, dict) else ""
        reason = result.get("reason", "") if isinstance(result, dict) else "fallback"

        if strategy not in valid:
            strategy = self._fallback_strategy(doc_type, fmt)
            reason = "fallback — LLM returned an invalid strategy"

        log.info("chunking_strategy_selected", doc_type=doc_type, strategy=strategy, reason=reason)
        return strategy

    @staticmethod
    def _fallback_strategy(doc_type: str, fmt: str) -> str:
        """Rule-based fallback when the LLM is unavailable."""
        if fmt == "json" or doc_type in {
            "user_story", "bug_report", "api_contract", "db_schema", "event_definition"
        }:
            return "structure"
        if doc_type in {"brd", "srs"}:
            return "recursive_meta"
        return "auto"

    def check_document_relevance(self, content: str, filename: str, doc_type: str) -> Dict[str, Any]:
        """Check whether a document is relevant to a software QA / project knowledge base.

        Returns:
            {
              "is_relevant": bool,
              "confidence": "high" | "medium" | "low",
              "detected_type": str,   # what we think the doc actually is
              "reason": str,          # one-sentence explanation
            }
        """
        preview = content[:1500].strip()

        prompt = (
            "You are a QA knowledge base gatekeeper. Decide if this document belongs in a software QA knowledge base.\n\n"
            f"Filename: {filename}\n"
            f"Detected type: {doc_type}\n"
            f"Document preview (first 1500 chars):\n{preview}\n\n"
            "A RELEVANT document is one of:\n"
            "  - Business Requirements Document (BRD), SRS, PRD, product spec\n"
            "  - User story, use case, acceptance criteria\n"
            "  - Bug report, defect log, issue tracker export\n"
            "  - API contract, Swagger/OpenAPI spec, REST endpoint list\n"
            "  - Database schema, data dictionary, ER diagram description\n"
            "  - Test plan, test cases, test strategy, QA checklist\n"
            "  - Event definition, message schema, Kafka topic spec\n"
            "  - Architecture document, technical design document\n"
            "  - Release notes, changelog, sprint backlog\n\n"
            "NOT RELEVANT: resumes/CVs, recipes, news articles, marketing copy, "
            "personal documents, invoices, legal contracts unrelated to software, random text.\n\n"
            "Return ONLY valid JSON — no markdown:\n"
            "{\n"
            '  "is_relevant": true | false,\n'
            '  "confidence": "high" | "medium" | "low",\n'
            '  "detected_type": "what this document actually appears to be",\n'
            '  "reason": "one sentence explaining the decision"\n'
            "}"
        )

        result = self.generate_json(prompt, fallback={
            "is_relevant": True,
            "confidence": "low",
            "detected_type": doc_type,
            "reason": "Could not assess — defaulting to relevant",
        })

        if not isinstance(result, dict):
            return {
                "is_relevant": True,
                "confidence": "low",
                "detected_type": doc_type,
                "reason": "LLM check unavailable — defaulting to relevant",
            }

        result.setdefault("is_relevant", True)
        result.setdefault("confidence", "low")
        result.setdefault("detected_type", doc_type)
        result.setdefault("reason", "")

        log.info("document_relevance_check",
                 filename=filename,
                 is_relevant=result["is_relevant"],
                 confidence=result["confidence"],
                 detected_type=result["detected_type"])
        return result

    def infer_state_machine_from_story(self, user_story: str) -> Optional[Dict[str, Any]]:
        """LLM extracts domain-accurate state machine from user story."""
        prompt = (
            "You are a QA engineer specializing in state-based testing.\n"
            "Extract the complete state machine from this user story.\n\n"
            f"User Story:\n{user_story[:800]}\n\n"
            "Identify ALL states the entity can be in, transitions, and triggering events.\n"
            "Use UPPERCASE_SNAKE_CASE for state names (e.g. COUPON_APPLIED, ORDER_CONFIRMED).\n"
            "Return ONLY valid JSON — no markdown:\n"
            "{\n"
            '  "entity": "the main entity name (e.g. Order, Coupon, Cart)",\n'
            '  "states": ["STATE_1", "STATE_2", ...],\n'
            '  "initial_state": "STARTING_STATE",\n'
            '  "final_states": ["TERMINAL_STATE", ...],\n'
            '  "transitions": [\n'
            '    {"from": "STATE_1", "event": "event_name", "to": "STATE_2", "guard": "optional condition"}\n'
            "  ]\n"
            "}\n"
            "If no meaningful states can be identified, return null."
        )
        result = self.generate_json(prompt, fallback=None)
        if not isinstance(result, dict):
            return None
        states = result.get("states", [])
        transitions = result.get("transitions", [])
        if len(states) < 2 or not transitions:
            return None
        log.info("llm_state_machine_inferred", entity=result.get("entity"), states=len(states), transitions=len(transitions))
        return result

    def infer_apis_from_story(self, user_story: str) -> List[Dict[str, Any]]:
        """LLM infers likely API endpoints from user story when KB has no APIs."""
        prompt = (
            "You are a backend architect. Based on this user story, infer the REST API endpoints needed.\n\n"
            f"User Story:\n{user_story[:800]}\n\n"
            "Return a JSON array of API endpoints. Each must have endpoint path, HTTP method, and short description.\n"
            "Use realistic REST paths (e.g. /api/cart/apply-coupon).\n"
            "Return ONLY valid JSON array — no markdown:\n"
            '[{"endpoint": "/api/...", "method": "POST|GET|PUT|DELETE|PATCH", "description": "..."}]\n'
            "Return empty array [] if nothing can be inferred."
        )
        result = self.generate_json(prompt, fallback=[])
        if not isinstance(result, list):
            return []
        apis = []
        for item in result:
            if isinstance(item, dict) and item.get("endpoint"):
                apis.append({
                    "endpoint": item["endpoint"],
                    "method": item.get("method", "POST"),
                    "name": item.get("description", item["endpoint"]),
                    "description": item.get("description", ""),
                    "source": "inferred_from_story",
                })
        log.info("apis_inferred_from_story", count=len(apis))
        return apis

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
