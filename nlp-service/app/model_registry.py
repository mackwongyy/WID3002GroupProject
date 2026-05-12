from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.config import settings


@dataclass
class Prediction:
    label: str
    confidence: float


@dataclass
class StructuredLlmPrediction:
    category: Prediction
    urgency: Prediction
    sentiment: Prediction
    key_phrases: list[str]


class DemoClassifier:
    """Deterministic fallback classifier for local demos and marking."""

    def predict_category(self, text: str) -> Prediction:
        t = text.lower()
        if any(k in t for k in ["refund", "charged", "payment", "duit", "付款", "bayar", "transaction"]):
            return Prediction("Payment Issue", 0.88)
        if any(k in t for k in ["login", "password", "account", "cannot access", "tak boleh masuk", "locked"]):
            return Prediction("Account Access", 0.84)
        if any(k in t for k in ["delivery", "parcel", "shipment", "order", "late", "alamat"]):
            return Prediction("Delivery Issue", 0.81)
        if any(k in t for k in ["bug", "error", "crash", "app", "system", "technical"]):
            return Prediction("Technical Issue", 0.82)
        return Prediction("General Enquiry", 0.69)

    def predict_urgency(self, text: str, category: str, sentiment: str) -> Prediction:
        t = text.lower()
        high_keywords = [
            "urgent",
            "immediately",
            "asap",
            "cannot access",
            "charged twice",
            "double charged",
            "fraud",
            "scam",
            "account locked",
        ]
        medium_keywords = ["pending", "delay", "belum", "still", "not yet", "failed", "gagal"]
        if any(k in t for k in high_keywords) or (category in {"Payment Issue", "Account Access"} and sentiment == "Negative"):
            return Prediction("High", 0.84)
        if any(k in t for k in medium_keywords):
            return Prediction("Medium", 0.75)
        return Prediction("Low", 0.72)

    def predict_sentiment(self, text: str) -> Prediction:
        t = text.lower()
        negative = [
        # English
        "angry",
        "bad",
        "terrible",
        "frustrated",
        "not received",
        "failed",
        "cannot",
        "problem",
        "issue",

        # Malay / Malaysian Malay
        "marah",
        "sangat marah",
        "geram",
        "kecewa",
        "tak puas hati",
        "tidak puas hati",
        "teruk",
        "buruk",
        "tak boleh",
        "gagal",
        "masalah",
        "lambat",
        "belum dapat",
        "belum terima",

        # Manglish / common local expressions
        "cannot lah",
        "so bad",
        "very bad",
        "kena charge",
        "kena charged",
        ]
        positive = [
        "thanks",
        "thank you",
        "good",
        "great",
        "resolved",
        "helpful",
        "terima kasih",
        "bagus",
        "baik",
        "puas hati",]
        if any(k in t for k in negative):
            return Prediction("Negative", 0.86)
        if any(k in t for k in positive):
            return Prediction("Positive", 0.78)
        return Prediction("Neutral", 0.68)


class HuggingFaceSequenceClassifier:
    """Optional wrapper around fine-tuned HuggingFace sequence-classification models.

    This is kept for teams that later want to compare the Llama prompt-based pipeline
    with smaller supervised classifiers. It is no longer the primary production path.
    """

    def __init__(self) -> None:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

        self.category_pipe: Any | None = None
        self.urgency_pipe: Any | None = None
        self.sentiment_pipe: Any | None = None

        model_paths = {
            "category": settings.category_model_path,
            "urgency": settings.urgency_model_path,
            "sentiment": settings.sentiment_model_path,
        }

        for task, path in model_paths.items():
            if os.path.exists(path):
                tokenizer = AutoTokenizer.from_pretrained(path)
                model = AutoModelForSequenceClassification.from_pretrained(path)
                setattr(self, f"{task}_pipe", pipeline("text-classification", model=model, tokenizer=tokenizer))

        self.fallback = DemoClassifier()

    @staticmethod
    def _predict(pipe: Any, text: str) -> Prediction:
        result = pipe(text, truncation=True, max_length=256)[0]
        return Prediction(label=str(result["label"]), confidence=float(result["score"]))

    def predict_category(self, text: str) -> Prediction:
        return self._predict(self.category_pipe, text) if self.category_pipe else self.fallback.predict_category(text)

    def predict_urgency(self, text: str, category: str, sentiment: str) -> Prediction:
        return self._predict(self.urgency_pipe, text) if self.urgency_pipe else self.fallback.predict_urgency(text, category, sentiment)

    def predict_sentiment(self, text: str) -> Prediction:
        return self._predict(self.sentiment_pipe, text) if self.sentiment_pipe else self.fallback.predict_sentiment(text)


class MalaysianLlamaClassifier:
    """Prompt-based structured classifier using mesolitica/Malaysian-Llama-3.2-3B-Instruct.

    The model is a causal instruction model, not a sequence-classification head. For this
    project, it is used with a strict JSON prompt so the backend still receives a stable,
    auditable model output schema.
    """

    allowed_categories = ["Payment Issue", "Technical Issue", "Delivery Issue", "Account Access", "General Enquiry"]
    allowed_urgencies = ["Low", "Medium", "High"]
    allowed_sentiments = ["Positive", "Neutral", "Negative"]

    def __init__(self) -> None:
        self.fallback = DemoClassifier()
        self.model: Any | None = None
        self.tokenizer: Any | None = None
        self.device = "cpu"

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            requested_device = settings.llm_device.lower()
            if requested_device != "auto":
                self.device = requested_device
            elif torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"

            dtype = torch.float32
            if self.device == "cuda" and settings.llm_torch_dtype in {"auto", "bfloat16"}:
                dtype = torch.bfloat16
            elif self.device in {"cuda", "mps"} and settings.llm_torch_dtype in {"auto", "float16"}:
                dtype = torch.float16

            self.tokenizer = AutoTokenizer.from_pretrained(settings.llm_model_name, trust_remote_code=True)
            self.model = AutoModelForCausalLM.from_pretrained(
                settings.llm_model_name,
                torch_dtype=dtype,
                trust_remote_code=True,
            )
            self.model.to(self.device)
            self.model.eval()

            if self.tokenizer.pad_token_id is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
        except Exception as exc:  # pragma: no cover - model download/runtime safety
            print(f"Malaysian Llama unavailable; using deterministic fallback. Reason: {exc}")
            self.model = None
            self.tokenizer = None

    def analyse(self, text: str) -> StructuredLlmPrediction:
        if self.model is None or self.tokenizer is None:
            category = self.fallback.predict_category(text)
            sentiment = self.fallback.predict_sentiment(text)
            urgency = self.fallback.predict_urgency(text, category.label, sentiment.label)
            return StructuredLlmPrediction(category=category, urgency=urgency, sentiment=sentiment, key_phrases=[])

        prompt = self._build_prompt(text)
        raw_output = self._generate(prompt)
        parsed = self._parse_json(raw_output)

        category = self._coerce_prediction(
            parsed,
            key="category",
            confidence_key="category_confidence",
            allowed=self.allowed_categories,
            fallback=self.fallback.predict_category(text),
        )
        sentiment = self._coerce_prediction(
            parsed,
            key="sentiment",
            confidence_key="sentiment_confidence",
            allowed=self.allowed_sentiments,
            fallback=self.fallback.predict_sentiment(text),
        )
        urgency = self._coerce_prediction(
            parsed,
            key="urgency",
            confidence_key="urgency_confidence",
            allowed=self.allowed_urgencies,
            fallback=self.fallback.predict_urgency(text, category.label, sentiment.label),
        )
        key_phrases = parsed.get("key_phrases", []) if isinstance(parsed, dict) else []
        key_phrases = [str(phrase).strip() for phrase in key_phrases if str(phrase).strip()][:6]

        return StructuredLlmPrediction(category=category, urgency=urgency, sentiment=sentiment, key_phrases=key_phrases)

    def predict_category(self, text: str) -> Prediction:
        return self.analyse(text).category

    def predict_urgency(self, text: str, category: str, sentiment: str) -> Prediction:
        return self.analyse(text).urgency

    def predict_sentiment(self, text: str) -> Prediction:
        return self.analyse(text).sentiment

    def _build_prompt(self, text: str) -> str:
        system_message = (
            "You are an NLP classifier for a Malaysian customer feedback ticketing system. "
            "Classify multilingual or code-mixed feedback, including Malaysian English, Malay, Mandarin, Tamil, Manglish, "
            "and common Malaysian expressions. Return only valid JSON. Do not add explanations outside JSON."
        )
        user_message = f"""
Classify the customer feedback below.

Allowed categories: {self.allowed_categories}
Allowed urgency levels: {self.allowed_urgencies}
Allowed sentiments: {self.allowed_sentiments}

Return exactly this JSON schema:
{{
  "category": "one allowed category",
  "category_confidence": 0.0,
  "urgency": "Low|Medium|High",
  "urgency_confidence": 0.0,
  "sentiment": "Positive|Neutral|Negative",
  "sentiment_confidence": 0.0,
  "key_phrases": ["phrase 1", "phrase 2"]
}}

Customer feedback:
{text}
""".strip()

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ]
        try:
            return self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        except Exception:
            return f"{system_message}\n\n{user_message}\n\nJSON:"

    def _generate(self, prompt: str) -> str:
        import torch

        encoded = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=settings.llm_max_input_tokens)
        encoded = {key: value.to(self.device) for key, value in encoded.items()}

        generation_kwargs = {
            "max_new_tokens": settings.llm_max_new_tokens,
            "do_sample": settings.llm_temperature > 0,
            "pad_token_id": self.tokenizer.pad_token_id,
            "eos_token_id": self.tokenizer.eos_token_id,
        }
        if settings.llm_temperature > 0:
            generation_kwargs["temperature"] = settings.llm_temperature

        with torch.no_grad():
            output_ids = self.model.generate(**encoded, **generation_kwargs)

        generated_ids = output_ids[0][encoded["input_ids"].shape[-1] :]
        return self.tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

    @staticmethod
    def _parse_json(raw_output: str) -> dict[str, Any]:
        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", raw_output, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}
        return {}

    @staticmethod
    def _coerce_prediction(
        parsed: dict[str, Any],
        *,
        key: str,
        confidence_key: str,
        allowed: list[str],
        fallback: Prediction,
    ) -> Prediction:
        label = str(parsed.get(key, "")).strip()
        if label not in allowed:
            return fallback
        raw_confidence = parsed.get(confidence_key, fallback.confidence)
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            confidence = fallback.confidence
        confidence = max(0.0, min(1.0, confidence))
        return Prediction(label=label, confidence=confidence)


class EmbeddingModel:
    def __init__(self) -> None:
        self.mode = settings.nlp_mode.lower()
        self.model: Any | None = None
        if self.mode in {"huggingface", "sequence", "sequence-classifier", "llama", "malaysian-llama"}:
            try:
                from sentence_transformers import SentenceTransformer

                self.model = SentenceTransformer(settings.embedding_model_name)
            except Exception as exc:  # pragma: no cover - fallback for lightweight environments
                print(f"Embedding model unavailable; using deterministic fallback. Reason: {exc}")
                self.model = None

    def encode(self, text: str) -> list[float]:
        if self.model is not None:
            vector = self.model.encode(text, normalize_embeddings=True)
            return vector.tolist()

        return self._deterministic_embedding(text, settings.embedding_dimension)

    @staticmethod
    def _deterministic_embedding(text: str, dimension: int) -> list[float]:
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
        rng = np.random.default_rng(seed)
        vector = rng.normal(0, 1, dimension)
        norm = np.linalg.norm(vector)
        if norm == 0:
            return vector.tolist()
        return (vector / norm).tolist()


ClassifierType = DemoClassifier | HuggingFaceSequenceClassifier | MalaysianLlamaClassifier


def get_classifier() -> ClassifierType:
    mode = settings.nlp_mode.lower()
    if mode in {"llama", "malaysian-llama", "huggingface"}:
        return MalaysianLlamaClassifier()
    if mode in {"sequence", "sequence-classifier"}:
        return HuggingFaceSequenceClassifier()
    return DemoClassifier()


def get_embedding_model() -> EmbeddingModel:
    return EmbeddingModel()
