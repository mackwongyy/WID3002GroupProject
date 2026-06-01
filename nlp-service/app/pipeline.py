from __future__ import annotations

from app.keyphrases import simple_keyphrases
from app.model_registry import EmbeddingModel, MalaysianLlamaClassifier, get_classifier, get_embedding_model
from app.pinecone_client import PineconeClient
from app.schemas import AnalyseRequest, AnalyseResponse, Confidence

CATEGORY_TO_DEPARTMENT = {
    "Payment Issue": "Finance Department",
    "Refund Issue": "Finance Department",
    "Technical Issue": "Technical Support Department",
    "Account Access": "Customer Service Department",
    "Account Issue": "Customer Service Department",
    "Delivery Issue": "Logistics Department",
    "Product Issue": "Product Department",
    "Service Complaint": "Customer Service Department",
    "General Enquiry": "Customer Service Department",
}

URGENCY_COLOUR = {
    "High": "Red",
    "Medium": "Orange",
    "Low": "Yellow",
}


class NlpPipeline:
    def __init__(self) -> None:
        self.classifier = get_classifier()
        self.pinecone = PineconeClient()
        # Embedding models are only needed when vector search is enabled. This keeps local
        # development light and avoids failing startup when Pinecone is intentionally disabled.
        self.embedding_model: EmbeddingModel | None = get_embedding_model() if self.pinecone.enabled else None

    def analyse(self, request: AnalyseRequest) -> AnalyseResponse:
        text = request.text.strip()

        if isinstance(self.classifier, MalaysianLlamaClassifier):
            structured = self.classifier.analyse(text)
            category_pred = structured.category
            urgency_pred = structured.urgency
            sentiment_pred = structured.sentiment
            llm_key_phrases = structured.key_phrases
        else:
            category_pred = self.classifier.predict_category(text)
            sentiment_pred = self.classifier.predict_sentiment(text)
            urgency_pred = self.classifier.predict_urgency(text, category_pred.label, sentiment_pred.label)
            llm_key_phrases = []

        department = CATEGORY_TO_DEPARTMENT.get(category_pred.label, "Customer Service Department")
        key_phrases = llm_key_phrases or simple_keyphrases(text)

        vector_id = None
        similar_tickets = []
        cluster_id = None

        if self.pinecone.enabled and self.embedding_model is not None:
            try:
                vector = self.embedding_model.encode(text)
                vector_id, similar_tickets, cluster_id = self.pinecone.upsert_and_search(
                    interaction_id=request.interaction_id,
                    ticket_id=request.ticket_id,
                    user_id=request.user_id,
                    text=text,
                    vector=vector,
                    category=category_pred.label,
                    urgency=urgency_pred.label,
                    sentiment=sentiment_pred.label,
                    department=department,
                )
            except Exception as exc:  # pragma: no cover - external vector integration safety
                print(f"Vector search skipped due to error: {exc}")

        model_name = getattr(self.classifier, "model_name", self.classifier.__class__.__name__)
        model_version = getattr(self.classifier, "model_version", "0.2.0")
        prompt_version = getattr(self.classifier, "prompt_version", None)

        return AnalyseResponse(
            category=category_pred.label,
            urgency=urgency_pred.label,  # type: ignore[arg-type]
            urgency_colour=URGENCY_COLOUR.get(urgency_pred.label, "Yellow"),  # type: ignore[arg-type]
            sentiment=sentiment_pred.label,  # type: ignore[arg-type]
            key_phrases=key_phrases,
            department=department,
            confidence=Confidence(
                category=category_pred.confidence,
                urgency=urgency_pred.confidence,
                sentiment=sentiment_pred.confidence,
            ),
            similar_tickets=similar_tickets,
            model_name=model_name,
            model_version=model_version,
            prompt_version=prompt_version,
            vector_id=vector_id,
            cluster_id=cluster_id,
        )
