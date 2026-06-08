# Qwen3 LoRA Integration

The NLP runtime has migrated from the previous Malaysian Llama/LoRA configuration to your teammate's Qwen3 LoRA adapter.

## Active model stack

```text
Base model: Qwen/Qwen3-1.7B
LoRA adapter: jieshengchai/qwen3-malaysia-cs-lora-5000-v2
```

## Local development mode

Local machines should normally run the NLP service in demo mode:

```env
NLP_MODE=demo
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_ENABLE_THINKING=false
```

This keeps the full web application usable without loading the 1.7B model locally.

## GPU inference mode

Use this configuration in Colab, RunPod, a GPU server, or another environment with enough VRAM:

```env
NLP_MODE=qwen-lora
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_DEVICE=cuda
LLM_TORCH_DTYPE=float16
LLM_MAX_INPUT_TOKENS=1024
LLM_MAX_NEW_TOKENS=128
LLM_TEMPERATURE=0.0
LLM_ENABLE_THINKING=false
```

## Why `LLM_ENABLE_THINKING=false` is used

Qwen3 can produce thinking text before the final answer. For this project, the NLP service must return strict JSON for category, urgency, sentiment, key phrases, and department routing. Therefore, thinking mode is disabled and the parser also strips `<think>...</think>` blocks defensively.

## Runtime files updated

```text
nlp-service/app/config.py
nlp-service/app/model_registry.py
nlp-service/requirements.txt
nlp-service/.env.example
nlp-service/.env
.env.example
nlp-service/training/train_classifier.py
```

## Important dependency note

Qwen3 requires a modern `transformers` version. The project now uses:

```text
transformers>=4.51.0,<5.0.0
```

After applying the patch, rebuild the NLP virtual environment or upgrade dependencies:

```bash
cd nlp-service
source .venv/bin/activate
pip install --upgrade -r requirements.txt
```
