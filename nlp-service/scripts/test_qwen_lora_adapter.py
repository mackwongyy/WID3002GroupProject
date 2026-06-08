from __future__ import annotations

import json
import os

# Standalone smoke test for the Qwen3 + LoRA runtime.
# Run this in a GPU environment, not normal local laptop mode.
os.environ.setdefault("NLP_MODE", "qwen-lora")
os.environ.setdefault("LLM_MODEL_NAME", "Qwen/Qwen3-1.7B")
os.environ.setdefault("LLM_ADAPTER_PATH", "jieshengchai/qwen3-malaysia-cs-lora-5000-v2")
os.environ.setdefault("LLM_DEVICE", "cuda")
os.environ.setdefault("LLM_TORCH_DTYPE", "float16")
os.environ.setdefault("LLM_MAX_INPUT_TOKENS", "1024")
os.environ.setdefault("LLM_MAX_NEW_TOKENS", "128")
os.environ.setdefault("LLM_TEMPERATURE", "0.0")
os.environ.setdefault("LLM_ENABLE_THINKING", "false")
os.environ.setdefault("PINECONE_API_KEY", "")

from app.model_registry import get_classifier


def main() -> None:
    classifier = get_classifier()

    test_cases = [
        "driver态度很不好",
        "Saya sangat marah sebab refund masih belum masuk selepas dua minggu.",
        "Aiyo, duit already deducted but order tak masuk, can check ah?",
        "Thanks, the payment issue has been resolved.",
    ]

    for text in test_cases:
        print("\nINPUT:", text)
        result = classifier.analyse(text)
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
