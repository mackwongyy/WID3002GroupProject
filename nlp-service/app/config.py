from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    nlp_mode: str = "demo"

    llm_model_name: str = "mesolitica/Malaysian-Llama-3.2-3B-Instruct"
    llm_adapter_path: str | None = None
    llm_device: str = "auto"
    llm_torch_dtype: str = "auto"
    llm_max_input_tokens: int = 2048
    llm_max_new_tokens: int = 256
    llm_temperature: float = 0.0

    embedding_model_name: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024

    pinecone_api_key: str | None = None
    pinecone_index_name: str = "customer-feedback-bge-m3"
    pinecone_namespace: str = "ticket-interactions"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"
    similarity_threshold: float = 0.78


settings = Settings()