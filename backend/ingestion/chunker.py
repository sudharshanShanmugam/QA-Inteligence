"""
Intelligent document-aware chunking pipeline.

Step 2: Document-based structural splitting   — respects doc_type boundaries
Step 3: Semantic refinement                   — merge tiny, split giant blocks
Step 4: Rich metadata attachment              — section, doc_type, source, index
Step 5: Sentence-level overlap                — last sentence of previous chunk
         carried into next for context continuity
"""

import json
import re
from typing import Any, Dict, List, Tuple

MIN_CHUNK_CHARS = 150    # merge chunks smaller than this with their neighbour
MAX_CHUNK_CHARS = 1000   # split chunks larger than this at paragraph/sentence


class DocumentChunker:

    def chunk(self, document: Dict[str, Any]) -> List[Dict[str, Any]]:
        fmt = document.get("format", "text")

        # Step 2: document-based structural split
        if fmt == "json" and document.get("raw"):
            raw_chunks = self._structured_split(document)
        else:
            raw_chunks = self._text_split(document)

        # Step 3: semantic refinement
        refined = self._refine(raw_chunks)

        # Step 4 + 5: metadata + overlap
        return self._finalize(refined, document)

    # ── Step 2a: structured split for typed JSON docs ─────────────────────────

    def _structured_split(self, document: Dict[str, Any]) -> List[Dict[str, str]]:
        doc_type = document.get("doc_type", "")
        raw = document.get("raw", {})
        chunks: List[Dict[str, str]] = []

        if doc_type == "user_story":
            story = (
                f"USER STORY: {raw.get('title', '')}\n"
                f"As a {raw.get('role', 'user')}, "
                f"I want {raw.get('goal', '')}, "
                f"so that {raw.get('benefit', '')}."
            )
            chunks.append({"text": story, "section": "story_body", "no_merge": True})

            acs = raw.get("acceptance_criteria", [])
            if acs:
                chunks.append({
                    "text": "ACCEPTANCE CRITERIA:\n" + "\n".join(f"- {ac}" for ac in acs),
                    "section": "acceptance_criteria",
                    "no_merge": True,
                })

            brs = raw.get("business_rules", [])
            if brs:
                chunks.append({
                    "text": "BUSINESS RULES:\n" + "\n".join(f"- {br}" for br in brs),
                    "section": "business_rules",
                    "no_merge": True,
                })

        elif doc_type == "bug_report":
            text = (
                f"BUG [{raw.get('severity', '?')}]: {raw.get('title', '')}\n"
                f"Module: {raw.get('module', '')} | Feature: {raw.get('feature', '')}\n"
                f"Description: {raw.get('description', '')}\n"
                f"Root Cause: {raw.get('root_cause', '')}\n"
                f"Steps: {raw.get('steps_to_reproduce', '')}\n"
                f"Status: {raw.get('status', '')}"
            )
            chunks.append({"text": text, "section": "bug_report"})

        elif doc_type == "api_contract":
            header = f"API: {raw.get('name', '')} v{raw.get('version', '1.0')}"
            for ep in raw.get("endpoints", []):
                method = ep.get("method", "GET")
                path = ep.get("path", "")
                text = (
                    f"{header}\n"
                    f"ENDPOINT: {method} {path}\n"
                    f"Description: {ep.get('description', '')}\n"
                )
                if ep.get("request_body"):
                    text += f"Request: {json.dumps(ep['request_body'])}\n"
                if ep.get("responses"):
                    text += f"Responses: {list(ep['responses'].keys())}\n"
                if ep.get("events_published"):
                    text += f"Publishes: {ep['events_published']}"
                slug = re.sub(r"\W+", "_", f"{method}_{path}").strip("_")
                chunks.append({"text": text.strip(), "section": f"endpoint_{slug}", "no_merge": True})

        elif doc_type == "db_schema":
            db_name = raw.get("database", "")
            for table in raw.get("tables", []):
                lines = [f"TABLE: {table.get('name', '')} (DB: {db_name})"]
                for col in table.get("columns", []):
                    pk = " PK" if col.get("primary_key") else ""
                    nn = " NOT NULL" if col.get("not_null") else ""
                    lines.append(f"  {col.get('name', '')} {col.get('type', '')}{pk}{nn}")
                chunks.append({
                    "text": "\n".join(lines),
                    "section": f"table_{table.get('name', '').lower()}",
                    "no_merge": True,
                })

        elif doc_type == "event_definition":
            text = (
                f"EVENT: {raw.get('name', '')}\n"
                f"Topic: {raw.get('topic', '')} | Type: {raw.get('type', '')}\n"
                f"Producer: {raw.get('producer', '')} → Consumer: {raw.get('consumer', '')}\n"
                f"Payload: {json.dumps(raw.get('payload_schema', {}))}"
            )
            chunks.append({"text": text, "section": "event_definition"})

        else:
            # Unknown JSON — fall through to text split
            return self._text_split(document)

        return chunks

    # ── Step 2b: structure-aware text split ───────────────────────────────────

    def _text_split(self, document: Dict[str, Any]) -> List[Dict[str, str]]:
        content = document.get("content", "")
        sections = self._split_by_headers(content)
        chunks: List[Dict[str, str]] = []

        for section_title, body in sections:
            text = f"{section_title}\n{body}".strip() if section_title else body.strip()
            if not text:
                continue

            if len(text) > MAX_CHUNK_CHARS:
                for i, block in enumerate(self._split_by_paragraphs(text)):
                    label = f"{section_title}_p{i+1}" if section_title else f"para_{i+1}"
                    chunks.append({"text": block, "section": label})
            else:
                chunks.append({"text": text, "section": section_title or "body"})

        return chunks

    def _split_by_headers(self, text: str) -> List[Tuple[str, str]]:
        """Split on markdown headings or numbered section markers."""
        pattern = re.compile(
            r'^(#{1,4}\s+.+|[0-9]+(?:\.[0-9]+)*\.?\s+[A-Z].*)$',
            re.MULTILINE,
        )
        positions = [(m.start(), m.group().strip()) for m in pattern.finditer(text)]
        if not positions:
            return [("", text)]

        sections: List[Tuple[str, str]] = []
        pre = text[:positions[0][0]].strip()
        if pre:
            sections.append(("", pre))

        for i, (pos, title) in enumerate(positions):
            end = positions[i + 1][0] if i + 1 < len(positions) else len(text)
            body = text[pos + len(title):end].strip()
            sections.append((title, body))

        return sections

    def _split_by_paragraphs(self, text: str) -> List[str]:
        """Break large blocks at double newlines, then sentences."""
        paras = [p.strip() for p in re.split(r"\n\n+", text) if p.strip()]
        result: List[str] = []
        for para in paras:
            if len(para) <= MAX_CHUNK_CHARS:
                result.append(para)
                continue
            # Sentence-level split for oversized paragraphs
            current = ""
            for sent in re.split(r"(?<=[.!?])\s+", para):
                if len(current) + len(sent) > MAX_CHUNK_CHARS and current:
                    result.append(current.strip())
                    current = sent
                else:
                    current += (" " if current else "") + sent
            if current:
                result.append(current.strip())
        return result

    # ── Step 3: semantic refinement ───────────────────────────────────────────

    def _refine(self, raw_chunks: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Merge chunks that are too small into their following neighbour.
        Chunks with no_merge=True are always kept as independent units.
        """
        if not raw_chunks:
            return []

        refined: List[Dict[str, str]] = []
        buf_text = ""
        buf_section = ""

        for chunk in raw_chunks:
            text = chunk.get("text", "").strip()
            section = chunk.get("section", "")
            no_merge = chunk.get("no_merge", False)
            if not text:
                continue

            if no_merge:
                # Flush any accumulated buffer first
                if buf_text:
                    refined.append({"text": buf_text, "section": buf_section})
                    buf_text = ""
                refined.append({"text": text, "section": section})
            elif buf_text and len(buf_text) < MIN_CHUNK_CHARS:
                buf_text += "\n\n" + text
            else:
                if buf_text:
                    refined.append({"text": buf_text, "section": buf_section})
                buf_text = text
                buf_section = section

        if buf_text:
            refined.append({"text": buf_text, "section": buf_section})

        return refined

    # ── Step 4 + 5: metadata + overlap ────────────────────────────────────────

    def _finalize(
        self, chunks: List[Dict[str, str]], document: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        source_id = document.get("source_id", "")
        doc_type = document.get("doc_type", "")
        base_meta = document.get("metadata", {})
        total = len(chunks)
        result: List[Dict[str, Any]] = []

        for i, chunk in enumerate(chunks):
            text = chunk["text"]

            # Step 5: sentence-level overlap — prepend last sentence of previous chunk
            if i > 0:
                overlap = self._last_sentence(chunks[i - 1]["text"])
                if overlap and not text.startswith(overlap[:30]):
                    text = f"[context: {overlap}]\n{text}"

            # ChromaDB requires metadata values to be scalar (str/int/float/bool)
            result.append({
                "text": text,
                "chunk_index": i,
                "total_chunks": total,
                "source_id": source_id,
                "doc_type": doc_type,
                "metadata": {
                    **{k: v for k, v in base_meta.items() if isinstance(v, (str, int, float, bool))},
                    "source_id": source_id,
                    "doc_type": doc_type,
                    "section": chunk.get("section", ""),
                    "chunk_index": i,
                    "total_chunks": total,
                },
            })

        return result

    def _last_sentence(self, text: str) -> str:
        """Return the last meaningful sentence (capped at 120 chars)."""
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        for sent in reversed(sentences):
            sent = sent.strip()
            if len(sent) > 20:
                return sent[-120:]
        return ""


chunker = DocumentChunker()
