from fastapi import FastAPI
from app.pipeline import NlpPipeline
from app.schemas import AnalyseRequest, AnalyseResponse

app = FastAPI(title="Smart Feedback NLP Service")

pipeline: NlpPipeline | None = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "pipeline_loaded": pipeline is not None,
    }


@app.post("/analyse", response_model=AnalyseResponse)
def analyse(request: AnalyseRequest):
    global pipeline

    if pipeline is None:
        pipeline = NlpPipeline()

    return pipeline.analyse(request)