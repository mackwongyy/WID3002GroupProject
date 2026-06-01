from __future__ import annotations

from typing import Any

from app.keyphrases import simple_keyphrases
from app.model_registry import EmbeddingModel, get_classifier, get_embedding_model
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


def _normalise_urgency(value: Any) -> str:
    text = str(value or "Low").strip()
    mapping = {
        "LOW": "Low",
        "Low": "Low",
        "low": "Low",
        "MEDIUM": "Medium",
        "Medium": "Medium",
        "medium": "Medium",
        "HIGH": "High",
        "High": "High",
        "high": "High",
    }
    return mapping.get(text, "Low")


def _normalise_sentiment(value: Any) -> str:
    text = str(value or "Neutral").strip()
    mapping = {
        "POSITIVE": "Positive",
        "Positive": "Positive",
        "positive": "Positive",
        "NEUTRAL": "Neutral",
        "Neutral": "Neutral",
        "neutral": "Neutral",
        "NEGATIVE": "Negative",
        "Negative": "Negative",
        "negative": "Negative",
    }
    return mapping.get(text, "Neutral")


def _extract_label_and_confidence(value: Any, default_label: str, default_confidence: float = 0.80) -> tuple[str, float]:
    """Supports both old Prediction objects and new dict/string outputs."""

    if value is None:
        return default_label, default_confidence

    if isinstance(value, dict):
        label = value.get("label", value.get("value", default_label))
        confidence = value.get("confidence", default_confidence)
        return str(label), float(confidence)

    label = getattr(value, "label", None)
    confidence = getattr(value, "confidence", None)

    if label is not None:
        return str(label), float(confidence if confidence is not None else default_confidence)

    return str(value), default_confidence


def _get_dict_value(data: dict[str, Any], key: str, default: Any = None) -> Any:
    value = data.get(key)
    return default if value is None else value


class NlpPipeline:
    def __init__(self) -> None:
        self.classifier = get_classifier()
        self.pinecone = PineconeClient()

        # Embedding models are only needed when vector search is enabled. This keeps
        # local development light and avoids loading sentence-transformers when
        # Pinecone is intentionally disabled.
        self.embedding_model: EmbeddingModel | None = get_embedding_model() if self.pinecone.enabled else None

    def analyse(self, request: AnalyseRequest) -> AnalyseResponse:
        text = request.text.strip()

        # New classifier contract:
        #   classifier.analyse(text) -> dict with category, urgency, sentiment, etc.
        #
        # Legacy classifier contract:
        #   predict_category(), predict_sentiment(), predict_urgency()
        #
        # The previous pipeline only recognised MalaysianLlamaClassifier as a
        # structured analyser. After the LoRA adapter patch, DemoClassifier also
        # implements analyse(), so this generic check prevents:
        #   AttributeError: 'DemoClassifier' object has no attribute 'predict_category'
        if hasattr(self.classifier, "analyse"):
            structured = self.classifier.analyse(text)

            if not isinstance(structured, dict):
                raise TypeError(
                    f"Classifier analyse() must return dict, got {type(structured).__name__}"
                )

            category_label, category_confidence = _extract_label_and_confidence(
                _get_dict_value(structured, "category", "General Enquiry"),
                "General Enquiry",
            )
            urgency_label, urgency_confidence = _extract_label_and_confidence(
                _get_dict_value(structured, "urgency", "Low"),
                "Low",
            )
            sentiment_label, sentiment_confidence = _extract_label_and_confidence(
                _get_dict_value(structured, "sentiment", "Neutral"),
                "Neutral",
            )

            urgency_label = _normalise_urgency(urgency_label)
            sentiment_label = _normalise_sentiment(sentiment_label)

            llm_key_phrases = structured.get("key_phrases") or []
            if not isinstance(llm_key_phrases, list):
                llm_key_phrases = simple_keyphrases(text)

            department = structured.get("department") or CATEGORY_TO_DEPARTMENT.get(
                category_label,
                "Customer Service Department",
            )

            model_name = structured.get("model_name") or getattr(
                self.classifier,
                "model_name",
                self.classifier.__class__.__name__,
            )
            model_version = structured.get("model_version") or getattr(
                self.classifier,
                "model_version",
                "0.2.0",
            )
            prompt_version = structured.get("prompt_version") or getattr(
                self.classifier,
                "prompt_version",
                None,
            )

        else:
            category_pred = self.classifier.predict_category(text)
            sentiment_pred = self.classifier.predict_sentiment(text)
            urgency_pred = self.classifier.predict_urgency(
                text,
                category_pred.label,
                sentiment_pred.label,
            )

            category_label = category_pred.label
            urgency_label = _normalise_urgency(urgency_pred.label)
            sentiment_label = _normalise_sentiment(sentiment_pred.label)

            category_confidence = float(category_pred.confidence)
            urgency_confidence = float(urgency_pred.confidence)
            sentiment_confidence = float(sentiment_pred.confidence)

            llm_key_phrases = []
            department = CATEGORY_TO_DEPARTMENT.get(category_label, "Customer Service Department")
            model_name = getattr(self.classifier, "model_name", self.classifier.__class__.__name__)
            model_version = getattr(self.classifier, "model_version", "0.2.0")
            prompt_version = getattr(self.classifier, "prompt_version", None)

        department = department or CATEGORY_TO_DEPARTMENT.get(category_label, "Customer Service Department")
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
                    category=category_label,
                    urgency=urgency_label,
                    sentiment=sentiment_label,
                    department=department,
                )
            except Exception as exc:  # pragma: no cover - external vector integration safety
                print(f"Vector search skipped due to error: {exc}")

        return AnalyseResponse(
            category=category_label,
            urgency=urgency_label,  # type: ignore[arg-type]
            urgency_colour=URGENCY_COLOUR.get(urgency_label, "Yellow"),  # type: ignore[arg-type]
            sentiment=sentiment_label,  # type: ignore[arg-type]
            key_phrases=key_phrases,
            department=department,
            confidence=Confidence(
                category=category_confidence,
                urgency=urgency_confidence,
                sentiment=sentiment_confidence,
            ),
            similar_tickets=similar_tickets,
            model_name=model_name,
            model_version=model_version,
            prompt_version=prompt_version,
            vector_id=vector_id,
            cluster_id=cluster_id,
        )
