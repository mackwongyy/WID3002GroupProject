# LoRA Fine-Tuning Results

## Base Model

`mesolitica/Malaysian-Llama-3.2-3B-Instruct`

## Fine-Tuning Method

QLoRA with LoRA adapters.

## Training Dataset

Synthetic Malaysian customer feedback dataset with 500 examples.

| Data Type | Count |
|---|---:|
| Malaysian Chinese / Mandarin-style | 250 |
| Malay | 100 |
| Malaysian English / Manglish | 100 |
| Code-mixed Malaysian slang / informal writing | 50 |

## Training Setup

| Item | Value |
|---|---|
| Platform | Google Colab |
| GPU | Tesla T4 |
| Epochs | 3 |
| Training steps | 186 |
| Final training loss | 1.4960 |
| Max sequence length | 384 / 512 depending on final run |
| LoRA rank | 4 |
| LoRA alpha | 8 |
| Target modules | q_proj, v_proj |

## Output

The final LoRA adapter was saved to:

```text
models/malaysian-feedback-lora