from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.pipeline import NlpPipeline
from app.schemas import AnalyseRequest, AnalyseResponse

app = FastAPI(title="Smart Feedback NLP Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline: NlpPipeline | None = None


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": "nlp-service",
        "pipeline_loaded": pipeline is not None,
    }


@app.post("/analyse", response_model=AnalyseResponse)
def analyse(payload: AnalyseRequest) -> AnalyseResponse:
    global pipeline

    if pipeline is None:
        pipeline = NlpPipeline()

    return pipeline.analyse(payload)
