from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    nlp_mode: str = Field(default="demo", alias="NLP_MODE")

    llm_model_name: str = Field(
        default="mesolitica/Malaysian-Llama-3.2-3B-Instruct",
        alias="LLM_MODEL_NAME",
    )
    llm_adapter_path: str = Field(
        default="mackwongyy/malaysian-feedback-lora-5k-data",
        alias="LLM_ADAPTER_PATH",
    )
    llm_device: str = Field(default="auto", alias="LLM_DEVICE")
    llm_torch_dtype: str = Field(default="auto", alias="LLM_TORCH_DTYPE")
    llm_max_input_tokens: int = Field(default=1024, alias="LLM_MAX_INPUT_TOKENS")
    llm_max_new_tokens: int = Field(default=128, alias="LLM_MAX_NEW_TOKENS")
    llm_temperature: float = Field(default=0.0, alias="LLM_TEMPERATURE")

    embedding_model_name: str = Field(default="BAAI/bge-m3", alias="EMBEDDING_MODEL_NAME")
    embedding_dimension: int = Field(default=1024, alias="EMBEDDING_DIMENSION")

    pinecone_api_key: str = Field(default="", alias="PINECONE_API_KEY")
    pinecone_index_name: str = Field(default="customer-feedback-bge-m3", alias="PINECONE_INDEX_NAME")
    pinecone_namespace: str = Field(default="ticket-interactions", alias="PINECONE_NAMESPACE")
    pinecone_cloud: str = Field(default="aws", alias="PINECONE_CLOUD")
    pinecone_region: str = Field(default="us-east-1", alias="PINECONE_REGION")
    similarity_threshold: float = Field(default=0.78, alias="SIMILARITY_THRESHOLD")


settings = Settings()
