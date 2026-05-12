from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.pipeline import NlpPipeline
from app.schemas import AnalyseRequest, AnalyseResponse

app = FastAPI(title="Smart Feedback NLP Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = NlpPipeline()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "nlp-service"}


@app.post("/analyse", response_model=AnalyseResponse)
def analyse(payload: AnalyseRequest) -> AnalyseResponse:
    return pipeline.analyse(payload)
