from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.config import settings


@dataclass
class Prediction:
    label: str
    confidence: float = 0.0


@dataclass
class StructuredLlmOutput:
    category: Prediction
    urgency: Prediction
    sentiment: Prediction
    key_phrases: list[str]
    department: str


class DemoClassifier:
    model_name = "demo-rules"
    model_version = "demo-v1"
    prompt_version = "demo-rules-v1"

    def predict_category(self, text: str) -> Prediction:
        lower = text.lower()

        if any(k in lower for k in ["投诉", "投訴", "complaint", "complain", "attitude", "态度", "態度", "rude"]):
            return Prediction("Service Complaint", 0.85)

        if any(k in lower for k in ["refund", "退款", "charged", "扣钱", "扣錢", "扣了", "payment", "付款", "bayar"]):
            return Prediction("Payment Issue", 0.85)

        if any(k in lower for k in ["login", "otp", "crash", "error", "bug", "cannot access", "app"]):
            return Prediction("Technical Issue", 0.80)

        if any(k in lower for k in ["delivery", "parcel", "包裹", "地址", "rider", "delivered"]):
            return Prediction("Delivery Issue", 0.80)

        if any(k in lower for k in ["product", "item", "商品", "产品", "產品", "faulty", "rosak"]):
            return Prediction("Product Issue", 0.80)

        return Prediction("General Enquiry", 0.65)

    def predict_sentiment(self, text: str) -> Prediction:
        lower = text.lower()

        negative_markers = [
            "angry", "bad", "terrible", "complaint", "complain", "not good",
            "marah", "sangat marah", "geram", "kecewa", "tak puas hati",
            "投诉", "投訴", "生气", "生氣", "不爽", "不满意", "不滿意",
            "很差", "太差", "不好", "很不好", "态度不好", "態度不好",
            "态度很不好", "態度很不好", "糟糕", "离谱", "離譜",
            "aiyo", "walao", "sien", "pekcek", "beh tahan", "jialat",
        ]

        positive_markers = [
            "thanks", "thank you", "good", "great", "resolved", "helpful",
            "terima kasih", "bagus", "baik",
            "谢谢", "謝謝", "不错", "不錯", "很好", "满意", "滿意",
        ]

        if any(k in lower for k in negative_markers):
            return Prediction("Negative", 0.90)

        if any(k in lower for k in positive_markers):
            return Prediction("Positive", 0.85)

        return Prediction("Neutral", 0.65)

    def predict_urgency(self, text: str, category: str, sentiment: str) -> Prediction:
        lower = text.lower()

        high_markers = [
            "urgent", "very urgent", "cannot login", "cannot access",
            "otp", "account locked", "charged twice", "扣了两次", "扣了兩次",
            "missing parcel", "did not receive", "没有收到", "沒有收到",
        ]

        medium_markers = [
            "投诉", "投訴", "complaint", "态度不好", "態度不好",
            "很不好", "marah", "angry", "refund", "退款",
        ]

        if any(k in lower for k in high_markers):
            return Prediction("High", 0.85)

        if sentiment == "Negative" or any(k in lower for k in medium_markers):
            return Prediction("Medium", 0.80)

        return Prediction("Low", 0.70)


class MalaysianLlamaClassifier:
    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.model_name = settings.llm_model_name
        self.model_version = "base-llama-v1"
        self.prompt_version = "malaysian-feedback-json-v1"

        self.tokenizer = AutoTokenizer.from_pretrained(
            settings.llm_model_name,
            trust_remote_code=True,
        )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model = AutoModelForCausalLM.from_pretrained(
            settings.llm_model_name,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
        self.model.eval()

    def analyse(self, text: str) -> StructuredLlmOutput:
        return self._analyse_with_model(text)

    def _analyse_with_model(self, text: str) -> StructuredLlmOutput:
        import torch

        system_prompt = (
            "You are an NLP classifier for a Malaysian customer feedback system. "
            "Return only valid JSON with exactly these fields: "
            "category, urgency, sentiment, key_phrases, department. "
            "Use category from: Payment Issue, Technical Issue, Account Issue, "
            "Delivery Issue, Refund Issue, Product Issue, Service Complaint, General Enquiry. "
            "Use urgency from: Low, Medium, High. "
            "Use sentiment from: Positive, Neutral, Negative. "
            "For complaints, anger, bad attitude, rude service, dissatisfaction, or words like "
            "投诉, 生气, 不满意, 态度不好, marah, angry, classify sentiment as Negative."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ]

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=settings.llm_max_input_tokens,
        )

        device = next(self.model.parameters()).device
        inputs = {key: value.to(device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=settings.llm_max_new_tokens,
                temperature=settings.llm_temperature,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        generated = self.tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[-1]:],
            skip_special_tokens=True,
        ).strip()

        parsed = parse_json_output(generated)
        parsed = normalise_model_output(parsed, text)

        return StructuredLlmOutput(
            category=Prediction(parsed["category"], 0.80),
            urgency=Prediction(parsed["urgency"], 0.80),
            sentiment=Prediction(parsed["sentiment"], 0.80),
            key_phrases=parsed["key_phrases"],
            department=parsed["department"],
        )


class MalaysianLlamaLoraClassifier(MalaysianLlamaClassifier):
    def __init__(self) -> None:
        super().__init__()

        if not settings.llm_adapter_path:
            raise ValueError(
                "LLM_ADAPTER_PATH is required when NLP_MODE=malaysian-llama-lora"
            )

        from peft import PeftModel

        self.model = PeftModel.from_pretrained(
            self.model,
            settings.llm_adapter_path,
        )
        self.model.eval()

        self.model_name = f"{settings.llm_model_name}+{settings.llm_adapter_path}"
        self.model_version = "lora-adapter-v1"
        self.prompt_version = "malaysian-feedback-json-lora-v1"


class EmbeddingModel:
    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model_name = settings.embedding_model_name
        self.model = SentenceTransformer(self.model_name)

    def encode(self, text: str) -> list[float]:
        vector = self.model.encode(text, normalize_embeddings=True)
        return vector.tolist()


def parse_json_output(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

    return {
        "category": "General Enquiry",
        "urgency": "Low",
        "sentiment": "Neutral",
        "key_phrases": [],
        "department": "Customer Service Department",
        "raw_output": raw,
    }


def normalise_model_output(result: dict[str, Any], text: str) -> dict[str, Any]:
    allowed_categories = {
        "Payment Issue",
        "Technical Issue",
        "Account Issue",
        "Account Access",
        "Delivery Issue",
        "Refund Issue",
        "Product Issue",
        "Service Complaint",
        "General Enquiry",
    }

    allowed_urgency = {"Low", "Medium", "High"}
    allowed_sentiment = {"Positive", "Neutral", "Negative"}

    category = result.get("category", "General Enquiry")
    urgency = result.get("urgency", "Low")
    sentiment = result.get("sentiment", "Neutral")
    department = result.get("department", "Customer Service Department")
    key_phrases = result.get("key_phrases", extract_key_phrases(text))

    if category not in allowed_categories:
        category = "General Enquiry"

    if urgency not in allowed_urgency:
        urgency = "Low"

    if sentiment not in allowed_sentiment:
        sentiment = "Neutral"

    if not isinstance(key_phrases, list):
        key_phrases = extract_key_phrases(text)

    output = {
        "category": category,
        "urgency": urgency,
        "sentiment": sentiment,
        "department": department,
        "key_phrases": key_phrases,
        "urgency_colour": {
            "High": "Red",
            "Medium": "Orange",
            "Low": "Yellow",
        }[urgency],
    }

    return apply_guardrails(text, output)


def apply_guardrails(text: str, result: dict[str, Any]) -> dict[str, Any]:
    lower = text.lower()

    negative_markers = [
        "投诉", "投訴", "生气", "生氣", "很生气", "很生氣",
        "不爽", "不满意", "不滿意", "态度不好", "態度不好",
        "态度很不好", "態度很不好", "很不好", "很差", "太差",
        "angry", "complain", "complaint", "rude",
        "marah", "sangat marah", "geram", "kecewa",
        "tak puas hati", "pekcek", "beh tahan", "jialat",
    ]

    service_markers = [
        "投诉", "投訴", "态度", "態度", "driver", "staff",
        "rude", "service", "客服", "服务", "服務",
    ]

    if any(marker in lower for marker in negative_markers):
        result["sentiment"] = "Negative"
        if result.get("urgency") == "Low":
            result["urgency"] = "Medium"
            result["urgency_colour"] = "Orange"

    if any(marker in lower for marker in service_markers):
        if result.get("category") == "General Enquiry":
            result["category"] = "Service Complaint"
            result["department"] = "Customer Service Department"

    return result


def extract_key_phrases(text: str) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    phrases: list[str] = []
    known_phrases = [
        "投诉", "投訴", "态度很不好", "態度很不好",
        "态度不好", "態度不好", "driver", "refund",
        "payment", "login", "OTP", "crash",
        "marah", "angry", "charged twice",
    ]

    lower = cleaned.lower()
    for phrase in known_phrases:
        if phrase.lower() in lower:
            phrases.append(phrase)

    if not phrases:
        words = cleaned.split()
        phrases = words[:4] if words else [cleaned[:20]]

    return list(dict.fromkeys(phrases))


def get_classifier():
    mode = settings.nlp_mode.lower().strip()

    if mode == "demo":
        return DemoClassifier()

    if mode in {"malaysian-llama-lora", "llama-lora", "lora"}:
        return MalaysianLlamaLoraClassifier()

    if mode in {"malaysian-llama", "llama"}:
        return MalaysianLlamaClassifier()

    return DemoClassifier()


def get_embedding_model() -> EmbeddingModel:
    return EmbeddingModel()
