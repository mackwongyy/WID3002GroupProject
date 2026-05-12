import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";

export type NlpAnalysisRequest = {
  interaction_id: string;
  ticket_id: string;
  user_id: string;
  text: string;
};

export type NlpAnalysisResponse = {
  category: string;
  urgency: "Low" | "Medium" | "High";
  urgency_colour: "Yellow" | "Orange" | "Red";
  sentiment: "Positive" | "Neutral" | "Negative";
  key_phrases: string[];
  department: string;
  confidence: {
    category: number;
    urgency: number;
    sentiment: number;
  };
  similar_tickets: Array<{
    interaction_id: string;
    ticket_id: string;
    score: number;
    text?: string;
    category?: string;
    department?: string;
  }>;
  model_name: string;
  model_version: string;
  prompt_version?: string;
  vector_id?: string;
  cluster_id?: string;
};

export async function analyseText(payload: NlpAnalysisRequest): Promise<NlpAnalysisResponse> {
  const response = await fetch(`${env.NLP_SERVICE_URL}/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(502, "NLP_SERVICE_ERROR", `NLP service failed: ${body}`);
  }

  return response.json() as Promise<NlpAnalysisResponse>;
}
