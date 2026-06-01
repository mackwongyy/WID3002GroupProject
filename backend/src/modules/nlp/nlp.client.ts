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
  prompt_version?: string | null;
  vector_id?: string | null;
  cluster_id?: string | null;
};

export async function analyseText(payload: NlpAnalysisRequest): Promise<NlpAnalysisResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NLP_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.NLP_SERVICE_URL}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(502, "NLP_SERVICE_ERROR", `NLP service failed: ${body}`);
    }

    return response.json() as Promise<NlpAnalysisResponse>;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    const message = error instanceof Error ? error.message : "Unknown NLP connection error.";
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "NLP_SERVICE_TIMEOUT", `NLP service timed out after ${env.NLP_TIMEOUT_MS} ms.`);
    }

    throw new HttpError(502, "NLP_SERVICE_UNAVAILABLE", `Unable to reach NLP service: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
