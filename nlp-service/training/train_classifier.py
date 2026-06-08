"""LoRA fine-tuning script for Qwen/Qwen3-1.7B.

This script prepares the Qwen3 model to return the same structured JSON
schema used by the runtime NLP service. The current runtime adapter is
`jieshengchai/qwen3-malaysia-cs-lora-5000-v2`.

Expected CSV columns by default:
    text, category, urgency, sentiment, key_phrases

Example:
    python training/train_classifier.py \
        --train_csv data/labelled/train.csv \
        --eval_csv data/labelled/eval.csv \
        --output_dir models/qwen3-malaysia-cs-lora
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

ALLOWED_CATEGORIES = ["Payment Issue", "Technical Issue", "Delivery Issue", "Account Access", "General Enquiry"]
ALLOWED_URGENCIES = ["Low", "Medium", "High"]
ALLOWED_SENTIMENTS = ["Positive", "Neutral", "Negative"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base_model", default="Qwen/Qwen3-1.7B")
    parser.add_argument("--train_csv", required=True)
    parser.add_argument("--eval_csv", required=True)
    parser.add_argument("--text_column", default="text")
    parser.add_argument("--category_column", default="category")
    parser.add_argument("--urgency_column", default="urgency")
    parser.add_argument("--sentiment_column", default="sentiment")
    parser.add_argument("--key_phrases_column", default="key_phrases")
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--batch_size", type=int, default=1)
    parser.add_argument("--gradient_accumulation_steps", type=int, default=8)
    parser.add_argument("--max_length", type=int, default=1024)
    return parser.parse_args()


def normalise_key_phrases(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raw = str(value).strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in raw.split(",") if item.strip()]


def build_prompt(text: str) -> str:
    return f"""
You are an NLP classifier for a Malaysian customer feedback ticketing system.
Classify multilingual or code-mixed feedback, including Malaysian English, Malay, Mandarin, Tamil, Manglish, and common Malaysian expressions.
Return only valid JSON. Do not add explanations outside JSON.

Allowed categories: {ALLOWED_CATEGORIES}
Allowed urgency levels: {ALLOWED_URGENCIES}
Allowed sentiments: {ALLOWED_SENTIMENTS}

Customer feedback:
{text}

JSON:
""".strip()


def main() -> None:
    args = parse_args()
    dataset = load_dataset("csv", data_files={"train": args.train_csv, "eval": args.eval_csv})

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(args.base_model)
    model.config.use_cache = False

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)

    def preprocess(example: dict[str, Any]) -> dict[str, Any]:
        label_json = {
            "category": str(example[args.category_column]),
            "category_confidence": 1.0,
            "urgency": str(example[args.urgency_column]),
            "urgency_confidence": 1.0,
            "sentiment": str(example[args.sentiment_column]),
            "sentiment_confidence": 1.0,
            "key_phrases": normalise_key_phrases(example.get(args.key_phrases_column)),
        }
        full_text = build_prompt(str(example[args.text_column])) + "\n" + json.dumps(label_json, ensure_ascii=False)
        tokenized = tokenizer(full_text, truncation=True, max_length=args.max_length)
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized

    tokenized_dataset = dataset.map(preprocess, remove_columns=dataset["train"].column_names)
    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        num_train_epochs=args.epochs,
        logging_steps=10,
        save_total_limit=2,
        fp16=False,
        bf16=False,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["eval"],
        data_collator=collator,
    )

    trainer.train()
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)


if __name__ == "__main__":
    main()
