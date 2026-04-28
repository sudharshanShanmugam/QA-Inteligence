"""
Entity extraction from raw documents using a structured LLM prompt.

Extracts: Module, Feature, API, DBTable, Event, TestCase, Bug, UserJourney,
          BusinessRule, State — with their properties.
"""

import json
import re
import uuid
from typing import Any, Dict, List
import structlog

log = structlog.get_logger()

EXTRACTION_PROMPT = """You are a QA knowledge graph entity extractor.
Analyze the following document and extract ALL entities and relationships.

Document Type: {doc_type}
Document Content:
{content}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{{
  "entities": [
    {{
      "id": "unique_slug_id",
      "label": "Module|Feature|API|DBTable|Event|TestCase|Bug|UserJourney|BusinessRule|State",
      "name": "entity name",
      "properties": {{...additional properties...}}
    }}
  ],
  "relationships": [
    {{
      "from_id": "entity_id",
      "to_id": "entity_id",
      "type": "DEPENDS_ON|BELONGS_TO|TRIGGERS|UPDATES|RELATED_TO|FOUND_IN|VALIDATES|SPANS|PRODUCES|CONSUMES|TRANSITIONS_TO|GOVERNED_BY",
      "properties": {{...}}
    }}
  ]
}}

Rules:
- Extract every module, feature, API endpoint, database table, event, test case, bug, user journey, business rule, and state mentioned
- Generate stable slug IDs (snake_case, no spaces)
- For Bug entities include: severity, status, root_cause
- For API entities include: endpoint path, HTTP method
- For Module entities include: criticality (1=low to 5=critical)
- For Feature entities include: priority (low/medium/high/critical)
- Every Feature must have a BELONGS_TO relationship to its Module
- Return empty arrays if nothing found, never null
"""


class EntityExtractor:
    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from langchain_ollama import OllamaLLM
            from config import settings
            self._llm = OllamaLLM(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                temperature=0.1,
                format="json",
            )
        return self._llm

    def extract(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """Extract entities and relationships from a document."""
        content = document.get("content", "")[:3000]  # cap to avoid token overflow
        doc_type = document.get("doc_type", "unknown")

        prompt = EXTRACTION_PROMPT.format(doc_type=doc_type, content=content)

        try:
            llm = self._get_llm()
            raw = llm.invoke(prompt)
            result = self._parse_json(raw)
        except Exception as e:
            log.warning("entity_extraction_llm_failed", error=str(e))
            result = self._rule_based_extract(document)

        # Validate and clean entities
        result["entities"] = [self._normalize_entity(e) for e in result.get("entities", [])]
        result["relationships"] = [r for r in result.get("relationships", []) if r.get("from_id") and r.get("to_id")]

        log.info("entities_extracted",
                 source_id=document.get("source_id"),
                 entities=len(result["entities"]),
                 relationships=len(result["relationships"]))
        return result

    def _parse_json(self, raw: str) -> Dict[str, Any]:
        raw = raw.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract JSON object
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            return {"entities": [], "relationships": []}

    def _normalize_entity(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure entity has required fields."""
        if not entity.get("id"):
            entity["id"] = re.sub(r'\W+', '_', entity.get("name", "unknown").lower())
        if not entity.get("name"):
            entity["name"] = entity["id"]
        entity.setdefault("properties", {})
        return entity

    def _rule_based_extract(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback: simple keyword-based extraction when LLM is unavailable."""
        entities: List[Dict] = []
        relationships: List[Dict] = []
        content = document.get("content", "")
        doc_type = document.get("doc_type", "")
        source_id = document.get("source_id", "doc")

        if doc_type == "bug_report":
            raw = document.get("raw", {})
            bug_id = f"bug_{source_id}"
            entities.append({
                "id": bug_id,
                "label": "Bug",
                "name": raw.get("title", source_id),
                "properties": {
                    "severity": raw.get("severity", "medium"),
                    "status": raw.get("status", "open"),
                    "root_cause": raw.get("root_cause", ""),
                    "description": raw.get("description", ""),
                }
            })
            if raw.get("module"):
                mod_id = f"mod_{re.sub(r'\\W+', '_', raw['module'].lower())}"
                entities.append({"id": mod_id, "label": "Module", "name": raw["module"], "properties": {"criticality": 3}})
                relationships.append({"from_id": bug_id, "to_id": mod_id, "type": "FOUND_IN", "properties": {}})
            if raw.get("feature"):
                feat_id = f"feat_{re.sub(r'\\W+', '_', raw['feature'].lower())}"
                entities.append({"id": feat_id, "label": "Feature", "name": raw["feature"], "properties": {}})
                relationships.append({"from_id": bug_id, "to_id": feat_id, "type": "RELATED_TO", "properties": {}})

        elif doc_type == "api_contract":
            raw = document.get("raw", {})
            for ep in raw.get("endpoints", []):
                api_id = f"api_{re.sub(r'\\W+', '_', ep.get('path', '').lower())}"
                entities.append({
                    "id": api_id,
                    "label": "API",
                    "name": f"{ep.get('method', 'GET')} {ep.get('path', '')}",
                    "properties": {"endpoint": ep.get("path", ""), "method": ep.get("method", "GET")}
                })

        elif doc_type == "db_schema":
            raw = document.get("raw", {})
            for table in raw.get("tables", []):
                tbl_id = f"tbl_{table.get('name', '').lower()}"
                entities.append({
                    "id": tbl_id,
                    "label": "DBTable",
                    "name": table.get("name", ""),
                    "properties": {"columns": len(table.get("columns", []))}
                })

        return {"entities": entities, "relationships": relationships}


entity_extractor = EntityExtractor()
