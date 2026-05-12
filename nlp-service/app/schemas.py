from typing import Literal
from pydantic import BaseModel, Field


Urgency = Literal["Low", "Medium", "High"]
UrgencyColour = Literal["Yellow", "Orange", "Red"]
Sentiment = Literal["Positive", "Neutral", "Negative"]


class AnalyseRequest(BaseModel):
    interaction_id: str
    ticket_id: str
    user_id: str
    text: str = Field(min_length=1, max_length=5000)


class SimilarTicket(BaseModel):
    interaction_id: str
    ticket_id: str
    score: float
    text: str | None = None
    category: str | None = None
    department: str | None = None


class Confidence(BaseModel):
    category: float
    urgency: float
    sentiment: float


class AnalyseResponse(BaseModel):
    category: str
    urgency: Urgency
    urgency_colour: UrgencyColour
    sentiment: Sentiment
    key_phrases: list[str]
    department: str
    confidence: Confidence
    similar_tickets: list[SimilarTicket]
    model_name: str
    model_version: str
    prompt_version: str | None = None
    vector_id: str | None = None
    cluster_id: str | None = None
