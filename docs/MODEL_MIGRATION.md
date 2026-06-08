# Model Migration: Qwen3 + LoRA

The NLP service has migrated from the previous Malaysian Llama configuration to a Qwen3 base model with your teammate's LoRA adapter.

## Runtime Model

```env
NLP_MODE=qwen-lora
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_ENABLE_THINKING=false
```

The model is loaded in `nlp-service/app/model_registry.py` through `AutoTokenizer`, `AutoModelForCausalLM`, and `PeftModel.from_pretrained(...)`.

Because Qwen3 is an instruction-tuned causal language model rather than a classification-head model, the service uses a strict JSON prompt to produce the required structured output:

```json
{
  "category": "Payment Issue",
  "urgency": "High",
  "sentiment": "Negative",
  "key_phrases": ["charged twice", "refund not received"],
  "department": "Finance Department"
}
```

The backend API and frontend do not need to change because the NLP service still returns the original `AnalyseResponse` schema.

## Supported NLP Modes

```env
NLP_MODE=demo
```

Fast deterministic fallback. Recommended for first-time local setup and normal laptop development.

```env
NLP_MODE=qwen
```

Loads `Qwen/Qwen3-1.7B` without the adapter.

```env
NLP_MODE=qwen-lora
```

Loads `Qwen/Qwen3-1.7B` and attaches `jieshengchai/qwen3-malaysia-cs-lora-5000-v2` using PEFT.

Legacy values such as `NLP_MODE=llama` and `NLP_MODE=malaysian-llama-lora` are still handled as backwards-compatible aliases, but new deployments should use `qwen` or `qwen-lora`.

## Fine-Tuning

The training script default base model has also been updated:

```bash
cd nlp-service
python training/train_classifier.py \
  --train_csv data/labelled/train.csv \
  --eval_csv data/labelled/eval.csv \
  --output_dir models/qwen3-malaysia-cs-lora
```

Expected CSV columns:

```csv
text,category,urgency,sentiment,key_phrases
```

## Embeddings and Pinecone

The classification model and embedding model remain separate:

- Qwen3 + LoRA: structured category, urgency, sentiment, key phrase, and department output
- BGE-M3 through SentenceTransformers: vector embeddings for Pinecone semantic similarity search

This avoids using a generative model for vector search and keeps Pinecone integration clean.
