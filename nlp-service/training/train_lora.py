import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, prepare_model_for_kbit_training
from trl import SFTTrainer


BASE_MODEL = os.getenv(
    "LLM_MODEL_NAME",
    "mesolitica/Malaysian-Llama-3.2-3B-Instruct",
)

TRAIN_DATA_PATH = os.getenv(
    "TRAIN_DATA_PATH",
    "data/sample_feedback_sft.jsonl",
)

OUTPUT_DIR = os.getenv(
    "LORA_OUTPUT_DIR",
    "models/malaysian-feedback-lora",
)

MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", "384"))
NUM_EPOCHS = float(os.getenv("NUM_EPOCHS", "3"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "2e-5"))


def main():
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is required for QLoRA training.")

    dataset = load_dataset("json", data_files=TRAIN_DATA_PATH, split="train")

    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        use_fast=True,
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    tokenizer.padding_side = "right"

    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=quant_config,
        device_map={"": 0},
        torch_dtype=torch.float16,
        trust_remote_code=True,
    )

    model = prepare_model_for_kbit_training(model)
    model.config.use_cache = False

    lora_config = LoraConfig(
        r=4,
        lora_alpha=8,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "v_proj",
        ],
    )

    def formatting_func(example):
        return tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=LEARNING_RATE,
        num_train_epochs=NUM_EPOCHS,
        logging_steps=10,
        save_steps=100,
        save_total_limit=2,
        warmup_ratio=0.05,
        weight_decay=0.01,
        report_to="none",
        fp16=True,
        bf16=False,
        optim="paged_adamw_8bit",
        remove_unused_columns=True,
        gradient_checkpointing=True,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        peft_config=lora_config,
        tokenizer=tokenizer,
        formatting_func=formatting_func,
        max_seq_length=MAX_SEQ_LENGTH,
        packing=False,
    )

    trainer.train()

    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    print(f"LoRA adapter saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()