import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from trl import SFTConfig, SFTTrainer
from peft import LoraConfig, prepare_model_for_kbit_training


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


def main() -> None:
    dataset = load_dataset("json", data_files=TRAIN_DATA_PATH, split="train")

    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        use_fast=True,
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=quant_config,
        device_map="auto",
        trust_remote_code=True,
    )

    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )

    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-5,
        num_train_epochs=3,
        max_seq_length=1024,
        logging_steps=10,
        save_steps=100,
        save_total_limit=2,
        bf16=True,
        packing=False,
        assistant_only_loss=True,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        peft_config=lora_config,
        processing_class=tokenizer,
    )

    trainer.train()
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    print(f"LoRA adapter saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()