import { getToken } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type TicketStatus = "IN_PROGRESS" | "SUBMITTED";
export type Urgency = "LOW" | "MEDIUM" | "HIGH";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type Ticket = {
  id: string;
  displayId: string;
  ticketName: string;
  status: TicketStatus;
  sortOrder: number;
  createdAt: string;
  submittedAt?: string | null;
  resolvedAt?: string | null;
  _count?: { interactions: number };
};

export type AnalysisStatus = "PENDING" | "SUCCESS" | "FAILED";

export type Interaction = {
  id: string;
  ticketId: string;
  stepNumber: number;
  userText: string;
  modelOutput: {
    category: string;
    urgency: "Low" | "Medium" | "High";
    urgency_colour: "Yellow" | "Orange" | "Red";
    sentiment: "Positive" | "Neutral" | "Negative";
    key_phrases: string[];
    department: string;
    confidence?: Record<string, number>;
    similar_tickets?: Array<{ interaction_id: string; ticket_id: string; score: number; text?: string }>;
  };
  category: string;
  urgency: Urgency;
  urgencyColour: string;
  sentiment: Sentiment;
  department: string;
  keyPhrases: string[];
  analysisStatus?: AnalysisStatus;
  analysisError?: string | null;
  createdAt: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  signup: (payload: { name: string; email: string; password: string }) =>
    request<{ token: string; user: any; redirect_to: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: any; redirect_to: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  me: () => request<{ user: any }>("/api/auth/me"),

  getTickets: () => request<{ tickets: Ticket[] }>("/api/customer/tickets"),
  createTicket: (ticket_name: string) =>
    request<{ ticket: Ticket }>("/api/customer/tickets", {
      method: "POST",
      body: JSON.stringify({ ticket_name })
    }),
  renameTicket: (ticketId: string, ticket_name: string) =>
    request<{ ticket: Ticket }>(`/api/customer/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ ticket_name })
    }),
  reorderTickets: (ordered_ticket_ids: string[]) =>
    request<{ tickets: Ticket[] }>("/api/customer/tickets/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ordered_ticket_ids })
    }),
  deleteTicket: (ticketId: string) =>
    request<void>(`/api/customer/tickets/${ticketId}`, { method: "DELETE" }),
  getTicket: (ticketId: string) => request<{ ticket: Ticket }>(`/api/customer/tickets/${ticketId}`),
  getMessages: (ticketId: string) => request<{ interactions: Interaction[] }>(`/api/customer/tickets/${ticketId}/messages`),
  sendMessage: (ticketId: string, text: string) =>
    request<{ interaction: Interaction }>(`/api/customer/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  submitTicket: (ticketId: string) =>
    request<{ ticket: Ticket }>(`/api/customer/tickets/${ticketId}/submit`, { method: "POST" }),

  adminSummary: () => request<any>("/api/admin/summary"),
  adminUsers: () => request<{ users: any[] }>("/api/admin/users"),
  adminTickets: () => request<{ tickets: any[] }>("/api/admin/tickets"),
  adminUserAnalytics: (userId: string) => request<any>(`/api/admin/users/${userId}/analytics`),
  adminTicketHistory: (ticketId: string) => request<any>(`/api/admin/tickets/${ticketId}/history`),
  validateInteraction: (interactionId: string, payload: any) =>
    request<any>(`/api/admin/interactions/${interactionId}/validate`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  reanalyseInteraction: (interactionId: string) =>
    request<any>(`/api/admin/interactions/${interactionId}/reanalyse`, {
      method: "POST"
    })
};
