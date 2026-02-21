
import logging
import chromadb
from chromadb import Settings as ChromaSettings
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from pathlib import Path

logger = logging.getLogger("agent.knowledge_base")

CHROMA_PATH = str(Path(__file__).parent.parent / "chroma_db")
COLLECTION_NAME = "clinical_knowledge"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Lazy-loaded singletons (no inline type hints — chromadb.PersistentClient
# is a factory function in chromadb>=0.5, so X|None raises TypeError at runtime)
_client = None
_collection = None


def _get_collection():
    """Initialise ChromaDB client and collection on first call."""
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=CHROMA_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        embedding_fn = SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL
        )
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn,
        )
        count = _collection.count()
        if count == 0:
            logger.warning("Knowledge base is EMPTY — run chains/ingest.py to populate")
        else:
            logger.info("Knowledge base ready | documents=%d", count)
    return _collection


def query_clinical_knowledge(query: str, n_results: int = 3) -> str:
    if not query.strip():
        return ""

    collection = _get_collection()
    if collection.count() == 0:
        return ""

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, collection.count()),
    )

    docs: list[str] = results.get("documents", [[]])[0]
    if not docs:
        logger.debug("KB query returned no results for: %s", query[:80])
        return ""

    logger.debug("KB query='%.60s' | retrieved=%d docs", query, len(docs))
    return "\n\n---\n\n".join(docs)
