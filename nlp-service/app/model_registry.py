from __future__ import annotations

import json
import re
from typing import Any

from app.config import settings


SYSTEM_PROMPT = (
    "You are an NLP classifier for a Malaysian customer feedback system. "
    "Return only valid JSON with exactly these fields: "
    "category, urgency, sentiment, key_phrases, department. "
    "Use category from: Payment Issue, Refund Issue, Technical Issue, "
    "Account Issue, Delivery Issue, Product Issue, Service Complaint, General Enquiry. "
    "Use urgency from: Low, Medium, High. "
    "Use sentiment from: Positive, Neutral, Negative. "
    "For complaints, anger, bad attitude, rude service, dissatisfaction, or words like "
    "投诉, 生气, 不满意, 态度不好, marah, angry, classify sentiment as Negative. "
    "Do not include explanations, markdown, or thinking text outside JSON."
)

URGENCY_COLOUR = {
    "High": "Red",
    "Medium": "Orange",
    "Low": "Yellow",
}

DEFAULT_CONFIDENCE = {
    "category": 0.80,
    "urgency": 0.80,
    "sentiment": 0.80,
}

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


class DemoClassifier:
    """Lightweight local fallback classifier.

    This mode is safe for local Mac development and keeps the full app working
    without loading the Qwen base model or LoRA adapter.
    """

    model_name = "demo-rules"
    model_version = "demo-v3-qwen-compatible"
    prompt_version = "demo-rules-v3"

    def analyse(self, text: str) -> dict[str, Any]:
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
            sentiment = "Negative"
        elif any(k in lower for k in positive_markers):
            sentiment = "Positive"
        else:
            sentiment = "Neutral"

        if any(k in lower for k in ["投诉", "投訴", "complaint", "complain", "attitude", "态度", "態度", "rude", "service", "客服"]):
            category = "Service Complaint"
            urgency = "Medium" if sentiment != "Positive" else "Low"
        elif any(k in lower for k in ["refund", "退款", "bayaran balik"]):
            category = "Refund Issue"
            urgency = "High" if sentiment == "Negative" else "Medium"
        elif any(k in lower for k in ["扣钱", "扣了", "charged", "payment", "付款", "bayar", "duit", "deducted"]):
            category = "Payment Issue"
            urgency = "High" if sentiment == "Negative" else "Medium"
        elif any(k in lower for k in ["login", "crash", "error", "bug", "otp", "cannot access", "app"]):
            category = "Technical Issue"
            urgency = "High" if sentiment == "Negative" else "Medium"
        elif any(k in lower for k in ["parcel", "delivery", "rider", "包裹", "送", "delivered"]):
            category = "Delivery Issue"
            urgency = "High" if sentiment == "Negative" else "Medium"
        elif any(k in lower for k in ["product", "item", "barang", "产品", "商品", "faulty", "rosak"]):
            category = "Product Issue"
            urgency = "Medium"
        elif any(k in lower for k in ["account", "akaun", "账号", "帳號", "password", "密码"]):
            category = "Account Issue"
            urgency = "High" if sentiment == "Negative" else "Medium"
        else:
            category = "General Enquiry"
            urgency = "Low"

        department = CATEGORY_TO_DEPARTMENT.get(category, "Customer Service Department")
        return build_response(
            category=category,
            urgency=urgency,
            sentiment=sentiment,
            key_phrases=extract_key_phrases(text),
            department=department,
            model_name=self.model_name,
            model_version=self.model_version,
            prompt_version=self.prompt_version,
            confidence={"category": 0.75, "urgency": 0.75, "sentiment": 0.75},
        )


class QwenClassifier:
    """Qwen3 base classifier without adapter.

    Runtime base model:
    - Qwen/Qwen3-1.7B

    Use only in a GPU/server environment unless you are intentionally testing
    slow local inference.
    """

    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.model_name = settings.llm_model_name
        self.model_version = "qwen3-1.7b-base-v1"
        self.prompt_version = "qwen3-malaysian-feedback-json-v1"

        self.tokenizer = AutoTokenizer.from_pretrained(settings.llm_model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        torch_dtype = resolve_torch_dtype(settings.llm_torch_dtype)
        device_map = resolve_device_map(settings.llm_device)

        self.model = AutoModelForCausalLM.from_pretrained(
            settings.llm_model_name,
            torch_dtype=torch_dtype,
            device_map=device_map,
            low_cpu_mem_usage=True,
        )
        self.model.eval()

    def analyse(self, text: str) -> dict[str, Any]:
        return self._analyse_with_model(text)

    def _apply_chat_template(self, messages: list[dict[str, str]]) -> str:
        try:
            return self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=settings.llm_enable_thinking,
            )
        except TypeError:
            # Older tokenizer versions may not expose enable_thinking. The
            # project requirements now require transformers >= 4.51.0, but this
            # fallback keeps the service safer if a user has a stale environment.
            return self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )

    def _analyse_with_model(self, text: str) -> dict[str, Any]:
        import torch

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ]

        prompt = self._apply_chat_template(messages)
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=settings.llm_max_input_tokens,
        )

        device = next(self.model.parameters()).device
        inputs = {key: value.to(device) for key, value in inputs.items()}

        do_sample = settings.llm_temperature > 0
        generation_kwargs: dict[str, Any] = {
            "max_new_tokens": settings.llm_max_new_tokens,
            "do_sample": do_sample,
            "pad_token_id": self.tokenizer.eos_token_id,
        }
        if do_sample:
            generation_kwargs.update(
                {
                    "temperature": settings.llm_temperature,
                    "top_p": 0.8,
                    "top_k": 20,
                }
            )

        with torch.no_grad():
            outputs = self.model.generate(**inputs, **generation_kwargs)

        generated = self.tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[-1]:],
            skip_special_tokens=True,
        ).strip()

        cleaned = strip_thinking_text(generated)
        parsed = parse_json_output(cleaned)
        parsed = normalise_model_output(parsed, text)

        return build_response(
            category=parsed["category"],
            urgency=parsed["urgency"],
            sentiment=parsed["sentiment"],
            key_phrases=parsed["key_phrases"],
            department=parsed["department"],
            model_name=self.model_name,
            model_version=self.model_version,
            prompt_version=self.prompt_version,
            confidence=DEFAULT_CONFIDENCE,
            raw_output=generated,
        )


class QwenLoraClassifier(QwenClassifier):
    """Qwen3 + PEFT LoRA adapter classifier.

    Runtime base model:
    - Qwen/Qwen3-1.7B

    Runtime LoRA adapter:
    - jieshengchai/qwen3-malaysia-cs-lora-5000-v2
    """

    def __init__(self) -> None:
        if not settings.llm_adapter_path:
            raise ValueError("LLM_ADAPTER_PATH is required when NLP_MODE=qwen-lora.")

        super().__init__()

        from peft import PeftModel

        self.model = PeftModel.from_pretrained(self.model, settings.llm_adapter_path)
        self.model.eval()

        self.model_name = f"{settings.llm_model_name}+{settings.llm_adapter_path}"
        self.model_version = "qwen3-malaysia-cs-lora-5000-v2"
        self.prompt_version = "qwen3-malaysian-feedback-json-lora-v2"


# Backwards-compatible aliases so old imports do not immediately fail.
MalaysianLlamaClassifier = QwenClassifier
MalaysianLlamaLoraClassifier = QwenLoraClassifier


class EmbeddingModel:
    """Optional embedding model for vector search.

    It is loaded only when Pinecone is configured. This keeps local demo mode
    lightweight.
    """

    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model_name = settings.embedding_model_name
        self.model = SentenceTransformer(self.model_name)

    def encode(self, text: str) -> list[float]:
        vector = self.model.encode(text, normalize_embeddings=True)
        return vector.tolist()


class NoopEmbeddingModel:
    model_name = "noop-embedding"

    def encode(self, text: str) -> list[float]:
        return []


def get_classifier():
    mode = settings.nlp_mode.lower().strip()

    if mode == "demo":
        return DemoClassifier()

    if mode in {"qwen-lora", "qwen3-lora", "qwen3-malaysia-cs-lora", "lora"}:
        return QwenLoraClassifier()

    if mode in {"qwen", "qwen3", "qwen-base"}:
        return QwenClassifier()

    # Backwards-compatible handling for old env values. These now map to the
    # Qwen runtime because the project has migrated away from Malaysian Llama.
    if mode in {"malaysian-llama-lora", "llama-lora"}:
        return QwenLoraClassifier()
    if mode in {"malaysian-llama", "llama"}:
        return QwenClassifier()

    return DemoClassifier()


def get_embedding_model():
    if not settings.pinecone_api_key:
        return NoopEmbeddingModel()

    return EmbeddingModel()


def resolve_torch_dtype(dtype_setting: str):
    import torch

    dtype = (dtype_setting or "auto").lower().strip()

    if dtype in {"float16", "fp16"}:
        return torch.float16
    if dtype in {"bfloat16", "bf16"}:
        return torch.bfloat16
    if dtype in {"float32", "fp32"}:
        return torch.float32

    return torch.float16 if torch.cuda.is_available() else torch.float32


def resolve_device_map(device_setting: str):
    import torch

    device = (device_setting or "auto").lower().strip()

    if device == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError(
                "LLM_DEVICE=cuda was requested, but CUDA is not available. "
                "Use NLP_MODE=demo locally, or run Qwen + LoRA on Colab/RunPod/GPU."
            )
        return {"": 0}

    if device == "cpu":
        return {"": "cpu"}

    if device == "mps":
        return {"": "mps"}

    if device == "auto":
        return {"": 0} if torch.cuda.is_available() else "auto"

    return "auto"


def build_response(
    *,
    category: str,
    urgency: str,
    sentiment: str,
    key_phrases: list[str],
    department: str,
    model_name: str,
    model_version: str,
    prompt_version: str,
    confidence: dict[str, float] | None = None,
    raw_output: str | None = None,
) -> dict[str, Any]:
    response = {
        "category": category,
        "urgency": urgency,
        "urgency_colour": URGENCY_COLOUR.get(urgency, "Yellow"),
        "sentiment": sentiment,
        "key_phrases": key_phrases,
        "department": department,
        "confidence": confidence or DEFAULT_CONFIDENCE,
        "model_name": model_name,
        "model_version": model_version,
        "prompt_version": prompt_version,
    }

    if raw_output is not None:
        response["raw_output"] = raw_output

    return response


def strip_thinking_text(raw: str) -> str:
    # Qwen3 may produce <think>...</think> if thinking mode is enabled or if an
    # older runtime ignores enable_thinking=False. Remove it before JSON parsing.
    return re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()


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
        "Refund Issue",
        "Technical Issue",
        "Account Issue",
        "Delivery Issue",
        "Product Issue",
        "Service Complaint",
        "General Enquiry",
    }

    allowed_urgency = {"Low", "Medium", "High"}
    allowed_sentiment = {"Positive", "Neutral", "Negative"}

    category = result.get("category", "General Enquiry")
    urgency = result.get("urgency", "Low")
    sentiment = result.get("sentiment", "Neutral")
    department = result.get("department") or CATEGORY_TO_DEPARTMENT.get(category, "Customer Service Department")
    key_phrases = result.get("key_phrases", extract_key_phrases(text))

    if category not in allowed_categories:
        category = "General Enquiry"

    if urgency not in allowed_urgency:
        urgency = "Low"

    if sentiment not in allowed_sentiment:
        sentiment = "Neutral"

    if not isinstance(key_phrases, list):
        key_phrases = extract_key_phrases(text)

    normalised = {
        "category": category,
        "urgency": urgency,
        "urgency_colour": URGENCY_COLOUR.get(urgency, "Yellow"),
        "sentiment": sentiment,
        "department": department,
        "key_phrases": key_phrases,
    }

    return apply_guardrails(text, normalised)


def apply_guardrails(text: str, result: dict[str, Any]) -> dict[str, Any]:
    lower = text.lower()

    negative_markers = [
        "投诉", "投訴", "生气", "生氣", "很生气", "很生氣",
        "不爽", "不满意", "不滿意", "态度不好", "態度不好",
        "态度很不好", "態度很不好", "很不好", "很差", "太差",
        "angry", "complain", "complaint",
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

    phrases = []
    known_phrases = [
        "投诉", "投訴", "态度很不好", "態度很不好", "态度不好", "態度不好",
        "driver", "refund", "payment", "login", "OTP", "crash",
        "marah", "angry", "charged twice", "扣钱", "退款", "delivery",
        "rider", "account", "password",
    ]

    lower = cleaned.lower()

    for phrase in known_phrases:
        if phrase.lower() in lower:
            phrases.append(phrase)

    if not phrases:
        words = cleaned.split()
        phrases = words[:4] if words else [cleaned[:20]]

    return list(dict.fromkeys(phrases))
