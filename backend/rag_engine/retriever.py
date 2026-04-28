"""
RAG Retriever – combines vector search results into a structured context block
for the LLM prompt.
"""

from typing import Any, Dict, List
import structlog

from rag_engine.vector_store import vector_store
from config import settings

log = structlog.get_logger()


class RAGRetriever:
    def retrieve(self, query: str, top_k: int = None) -> Dict[str, Any]:
        """
        Retrieve relevant chunks for a query and organise by document type.
        Returns a structured context dict.
        """
        top_k = top_k or settings.MAX_RETRIEVAL_DOCS
        hits = vector_store.search(query, top_k=top_k)

        context: Dict[str, List[str]] = {
            "brd": [],
            "srs": [],
            "user_story": [],
            "test_case": [],
            "bug_report": [],
            "api_contract": [],
            "db_schema": [],
            "event_definition": [],
            "business_rule": [],
            "other": [],
        }

        for hit in hits:
            doc_type = hit.get("doc_type", "other")
            bucket = doc_type if doc_type in context else "other"
            context[bucket].append(hit["text"])

        # Deduplicate within buckets
        context = {k: list(dict.fromkeys(v)) for k, v in context.items()}

        total_retrieved = sum(len(v) for v in context.values())
        log.info("rag_retrieval_complete", query_preview=query[:80], total_chunks=total_retrieved)

        return {
            "query": query,
            "total_retrieved": total_retrieved,
            "context_by_type": context,
            "raw_hits": hits,
        }

    def retrieve_bugs(self, query: str, top_k: int = 15) -> List[str]:
        hits = vector_store.search(query, top_k=top_k, doc_type_filter="bug_report")
        return [h["text"] for h in hits]

    def retrieve_test_cases(self, query: str, top_k: int = 10) -> List[str]:
        hits = vector_store.search(query, top_k=top_k, doc_type_filter="test_case")
        return [h["text"] for h in hits]

    def retrieve_api_contracts(self, query: str, top_k: int = 10) -> List[str]:
        hits = vector_store.search(query, top_k=top_k, doc_type_filter="api_contract")
        return [h["text"] for h in hits]

    def build_context_string(self, retrieval_result: Dict[str, Any], max_chars: int = 4000) -> str:
        """Flatten retrieved context into a single string for the LLM prompt."""
        lines: List[str] = []
        ctx = retrieval_result.get("context_by_type", {})

        for doc_type, chunks in ctx.items():
            if not chunks:
                continue
            lines.append(f"\n=== {doc_type.upper().replace('_', ' ')} ===")
            for chunk in chunks:
                lines.append(chunk)

        full = "\n".join(lines)
        if len(full) > max_chars:
            full = full[:max_chars] + "\n...[truncated for prompt length]"
        return full


retriever = RAGRetriever()
