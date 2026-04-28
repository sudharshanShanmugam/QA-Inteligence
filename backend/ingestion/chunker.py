"""Text chunking with semantic awareness."""

from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import settings


class DocumentChunker:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", " "],
            length_function=len,
        )

    def chunk(self, document: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Split a document into overlapping chunks with metadata."""
        content = document["content"]
        raw_chunks = self.splitter.split_text(content)
        chunks = []
        for i, chunk_text in enumerate(raw_chunks):
            chunks.append({
                "text": chunk_text,
                "chunk_index": i,
                "total_chunks": len(raw_chunks),
                "source_id": document["source_id"],
                "doc_type": document["doc_type"],
                "metadata": {
                    **document.get("metadata", {}),
                    "source_id": document["source_id"],
                    "doc_type": document["doc_type"],
                    "chunk_index": i,
                },
            })
        return chunks


chunker = DocumentChunker()
