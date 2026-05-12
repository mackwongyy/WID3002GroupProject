# Model Migration: Malaysian Llama

The NLP service has been migrated from the earlier XLM-RoBERTa-oriented sequence-classification setup to a Malaysian Llama prompt-based structured classifier.

## Runtime Model

```env
NLP_MODE=llama
LLM_MODEL_NAME=mesolitica/Malaysian-Llama-3.2-3B-Instruct
```

The model is loaded in `nlp-service/app/model_registry.py` through `AutoTokenizer` and `AutoModelForCausalLM`.

Because this model is an instruction-tuned causal language model rather than a classification-head model, the service uses a strict JSON prompt to produce the required structured output:

```json
{
  "category": "Payment Issue",
  "category_confidence": 0.88,
  "urgency": "High",
  "urgency_confidence": 0.84,
  "sentiment": "Negative",
  "sentiment_confidence": 0.91,
  "key_phrases": ["charged twice", "refund not received"]
}
```

The backend API and frontend do not need to change because the NLP service still returns the original `AnalyseResponse` schema.

## Supported NLP Modes

```env
NLP_MODE=demo
```

Fast deterministic fallback. Recommended for first-time local setup.

```env
NLP_MODE=llama
```

Loads `mesolitica/Malaysian-Llama-3.2-3B-Instruct` and performs prompt-based structured inference.

```env
NLP_MODE=sequence-classifier
```

Optional legacy mode for future smaller task-specific classifier comparisons.

## Fine-Tuning

The previous sequence-classification training script has been replaced with a LoRA fine-tuning script for Malaysian Llama:

```bash
cd nlp-service
python training/train_classifier.py \
  --train_csv data/labelled/train.csv \
  --eval_csv data/labelled/eval.csv \
  --output_dir models/malaysian-llama-feedback-lora
```

Expected CSV columns:

```csv
text,category,urgency,sentiment,key_phrases
```

The service currently loads the base model for inference. If you fine-tune a LoRA adapter, the next enhancement is to merge or load that adapter during runtime.

## Embeddings and Pinecone

The classification model and embedding model remain separate:

- Malaysian Llama: structured category, urgency, sentiment and key phrase output
- BGE-M3 through SentenceTransformers: vector embeddings for Pinecone semantic similarity search

This avoids using a generative model for vector search and keeps Pinecone integration clean.
