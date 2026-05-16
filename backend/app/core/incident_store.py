"""
Shared ChromaDB wrapper — store and find incidents and runbooks by semantic similarity.
"""
from typing import Any, Dict, List
import chromadb
from chromadb.config import Settings as ChromaSettings
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class IncidentStore:
    """
    Two ChromaDB collections:
    - 'incidents': past incidents with resolutions (used by Triage + Runbook agents)
    - 'runbooks': generated runbooks linked to incident types (used by Runbook agent)
    """

    def __init__(self):
        try:
            self._client = chromadb.PersistentClient(
                path=settings.chroma_persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        except Exception as e:
            logger.warning("chroma_persistent_failed_using_memory", error=str(e))
            self._client = chromadb.Client()

        self._incidents = self._client.get_or_create_collection(
            name="incidents",
            metadata={"hnsw:space": "cosine"},
        )
        self._runbooks = self._client.get_or_create_collection(
            name="runbooks",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("incident_store_initialized")

    # ── Incidents ──────────────────────────────────────────────────────────────

    def store_incident(
        self,
        incident_id: str,
        title: str,
        description: str,
        metadata: Dict[str, Any],
    ) -> None:
        document = f"{title}. {description}"
        safe_meta = {k: str(v) for k, v in metadata.items()}
        safe_meta["title"] = title
        safe_meta["description"] = description
        try:
            self._incidents.upsert(
                ids=[incident_id],
                documents=[document],
                metadatas=[safe_meta],
            )
            logger.info("incident_stored", incident_id=incident_id)
        except Exception as e:
            logger.error("incident_store_failed", error=str(e))

    def find_similar_incidents(self, query: str, n_results: int = 3) -> List[Dict[str, Any]]:
        count = self._incidents.count()
        if count == 0:
            return []
        try:
            results = self._incidents.query(
                query_texts=[query],
                n_results=min(n_results, count),
                include=["metadatas", "distances"],
            )
        except Exception as e:
            logger.error("incident_find_failed", error=str(e))
            return []

        return [
            {
                "title": m.get("title", ""),
                "description": m.get("description", ""),
                "severity": m.get("severity", ""),
                "team": m.get("team", ""),
                "resolution": m.get("resolution", ""),
                "resolution_time": m.get("resolution_time", ""),
                "similarity": round(1 - d, 3),
            }
            for m, d in zip(results["metadatas"][0], results["distances"][0])
        ]

    # ── Runbooks ───────────────────────────────────────────────────────────────

    def store_runbook(
        self,
        runbook_id: str,
        incident_title: str,
        content: str,
        metadata: Dict[str, Any],
    ) -> None:
        safe_meta = {k: str(v) for k, v in metadata.items()}
        safe_meta["incident_title"] = incident_title
        try:
            self._runbooks.upsert(
                ids=[runbook_id],
                documents=[f"{incident_title}. {content}"],
                metadatas=[safe_meta],
            )
            logger.info("runbook_stored", runbook_id=runbook_id)
        except Exception as e:
            logger.error("runbook_store_failed", error=str(e))

    def find_similar_runbooks(self, query: str, n_results: int = 3) -> List[Dict[str, Any]]:
        count = self._runbooks.count()
        if count == 0:
            return []
        try:
            results = self._runbooks.query(
                query_texts=[query],
                n_results=min(n_results, count),
                include=["metadatas", "distances"],
            )
        except Exception as e:
            logger.error("runbook_find_failed", error=str(e))
            return []

        return [
            {
                "incident_title": m.get("incident_title", ""),
                "estimated_time": m.get("estimated_time", ""),
                "team": m.get("team", ""),
                "similarity": round(1 - d, 3),
            }
            for m, d in zip(results["metadatas"][0], results["distances"][0])
        ]


# Global singleton — import this in agents
incident_store = IncidentStore()

# Made with Bob