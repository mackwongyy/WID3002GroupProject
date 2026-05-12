from __future__ import annotations

from typing import Any

from app.config import settings
from app.schemas import SimilarTicket


class PineconeClient:
    def __init__(self) -> None:
        self.enabled = bool(settings.pinecone_api_key)
        self.index: Any | None = None

        if not self.enabled:
            return

        try:
            from pinecone import Pinecone, ServerlessSpec

            pc = Pinecone(api_key=settings.pinecone_api_key)
            if not pc.has_index(settings.pinecone_index_name):
                pc.create_index(
                    name=settings.pinecone_index_name,
                    dimension=settings.embedding_dimension,
                    metric="cosine",
                    spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region),
                    deletion_protection="disabled",
                )
            self.index = pc.Index(settings.pinecone_index_name)
        except Exception as exc:  # pragma: no cover - external integration safety
            print(f"Pinecone disabled due to configuration/client error: {exc}")
            self.enabled = False
            self.index = None

    def upsert_and_search(
        self,
        *,
        interaction_id: str,
        ticket_id: str,
        user_id: str,
        text: str,
        vector: list[float],
        category: str,
        urgency: str,
        sentiment: str,
        department: str,
    ) -> tuple[str | None, list[SimilarTicket], str | None]:
        if not self.enabled or self.index is None:
            return None, [], None

        vector_id = interaction_id
        metadata = {
            "interaction_id": interaction_id,
            "ticket_id": ticket_id,
            "user_id": user_id,
            "text": text,
            "category": category,
            "urgency": urgency,
            "sentiment": sentiment,
            "department": department,
        }

        response = self.index.query(
            vector=vector,
            top_k=6,
            include_metadata=True,
            namespace=settings.pinecone_namespace,
        )
        matches = getattr(response, "matches", None)
        if matches is None and isinstance(response, dict):
            matches = response.get("matches", [])
        matches = matches or []

        similar_tickets: list[SimilarTicket] = []
        cluster_id: str | None = None
        for match in matches:
            score = float(getattr(match, "score", 0.0) if not isinstance(match, dict) else match.get("score", 0.0))
            match_id = getattr(match, "id", None) if not isinstance(match, dict) else match.get("id")
            meta = getattr(match, "metadata", {}) if not isinstance(match, dict) else match.get("metadata", {})
            meta = meta or {}
            if match_id == vector_id:
                continue
            if score >= settings.similarity_threshold:
                if cluster_id is None:
                    cluster_id = str(meta.get("ticket_id", ticket_id))
                similar_tickets.append(
                    SimilarTicket(
                        interaction_id=str(meta.get("interaction_id", match_id)),
                        ticket_id=str(meta.get("ticket_id", "")),
                        score=score,
                        text=meta.get("text"),
                        category=meta.get("category"),
                        department=meta.get("department"),
                    )
                )

        self.index.upsert(
            vectors=[{"id": vector_id, "values": vector, "metadata": metadata}],
            namespace=settings.pinecone_namespace,
        )

        return vector_id, similar_tickets, cluster_id
