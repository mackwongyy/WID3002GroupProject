from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Modes:
    # - demo: fast deterministic rules for local testing
    # - llama / malaysian-llama: prompt-based inference with mesolitica/Malaysian-Llama-3.2-3B-Instruct
    # - sequence-classifier: optional legacy/future supervised classifiers
    nlp_mode: str = "demo"

    llm_model_name: str = "mesolitica/Malaysian-Llama-3.2-3B-Instruct"
    llm_device: str = "auto"
    llm_torch_dtype: str = "auto"
    llm_max_input_tokens: int = 2048
    llm_max_new_tokens: int = 256
    llm_temperature: float = 0.0

    # Optional legacy/future sequence-classifier paths.
    category_model_path: str = "./models/category-malaysian-llama-adapter"
    urgency_model_path: str = "./models/urgency-malaysian-llama-adapter"
    sentiment_model_path: str = "./models/sentiment-malaysian-llama-adapter"

    embedding_model_name: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024

    pinecone_api_key: str | None = None
    pinecone_index_name: str = "customer-feedback-bge-m3"
    pinecone_namespace: str = "ticket-interactions"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"
    similarity_threshold: float = 0.78


settings = Settings()
