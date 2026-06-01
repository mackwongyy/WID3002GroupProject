"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatCard } from "@/components/StatCard";
import { BreakdownList } from "@/components/BreakdownList";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/api";

type ValidationRecord = {
  id: string;
  notes?: string | null;
  validatedAt: string;
  admin?: { id: string; name: string; email: string };
};

type InteractionWithValidation = {
  id: string;
  stepNumber: number;
  userText: string;
  category: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  department: string;
  keyPhrases?: string[];
  validations?: ValidationRecord[];
  analysisStatus?: "PENDING" | "SUCCESS" | "FAILED";
  analysisError?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UserAnalyticsContent() {
  const params = useParams<{ userId: string }>();
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const [validatingInteractionId, setValidatingInteractionId] = useState<string | null>(null);
  const [reanalysingInteractionId, setReanalysingInteractionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadAnalytics() {
    const result = await api.adminUserAnalytics(params.userId);
    setAnalytics(result);
  }

  useEffect(() => {
    loadAnalytics().catch((err) => setError(err.message));
  }, [params.userId]);

  async function openTicket(ticketId: string) {
    setError("");
    setNotice("");
    setLoadingTicketId(ticketId);
    try {
      const result = await api.adminTicketHistory(ticketId);
      setSelectedTicket(result.ticket);
    } catch (err: any) {
      setError(err.message ?? "Unable to load ticket history.");
    } finally {
      setLoadingTicketId(null);
    }
  }

  async function validateInteraction(interaction: InteractionWithValidation) {
    if ((interaction.validations?.length ?? 0) > 0) return;

    setError("");
    setNotice("");
    setValidatingInteractionId(interaction.id);
    try {
      await api.validateInteraction(interaction.id, { notes: "Validated from admin dashboard." });
      if (selectedTicket) await openTicket(selectedTicket.id);
      await loadAnalytics();
      setNotice(`Step ${interaction.stepNumber} was marked as validated and saved to the backend.`);
    } catch (err: any) {
      setError(err.message ?? "Unable to validate interaction.");
    } finally {
      setValidatingInteractionId(null);
    }
  }



  async function reanalyseInteraction(interaction: InteractionWithValidation) {
    setError("");
    setNotice("");
    setReanalysingInteractionId(interaction.id);
    try {
      const result = await api.reanalyseInteraction(interaction.id);
      if (selectedTicket) await openTicket(selectedTicket.id);
      await loadAnalytics();
      if (result.analysis_status === "SUCCESS") {
        setNotice(`Step ${interaction.stepNumber} was re-analysed successfully.`);
      } else {
        setError(result.error ?? `Step ${interaction.stepNumber} analysis retry failed.`);
      }
    } catch (err: any) {
      setError(err.message ?? "Unable to retry analysis.");
    } finally {
      setReanalysingInteractionId(null);
    }
  }

  const selectedTicketValidationSummary = useMemo(() => {
    const interactions = selectedTicket?.interactions ?? [];
    const validated = interactions.filter((interaction: InteractionWithValidation) => (interaction.validations?.length ?? 0) > 0).length;
    return { total: interactions.length, validated, pending: interactions.length - validated };
  }, [selectedTicket]);

  if (!analytics) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading user analytics...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-2xl border border-slate-300 p-3 text-slate-700 hover:bg-white"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">User Analytics</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{analytics.user.name}</h1>
            <p className="text-slate-500">{analytics.user.email}</p>
          </div>
        </div>

        {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

        <SectionCard title="User Snapshot" subtitle="Ticket progress and validation coverage for this user.">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-8">
            <StatCard label="Total Tickets" value={analytics.ticket_summary.total_tickets} />
            <StatCard label="In Progress" value={analytics.ticket_summary.in_progress} />
            <StatCard label="Submitted" value={analytics.ticket_summary.submitted} />
            <StatCard label="Interactions" value={analytics.validation_summary?.total_interactions ?? 0} />
            <StatCard label="Validated" value={analytics.validation_summary?.validated_interactions ?? 0} />
            <StatCard label="Pending Review" value={analytics.validation_summary?.pending_interactions ?? 0} />
            <StatCard label="Analysis Failed" value={analytics.analysis_status_breakdown?.FAILED ?? 0} />
            <StatCard label="Analysis Pending" value={analytics.analysis_status_breakdown?.PENDING ?? 0} />
          </div>
        </SectionCard>

        <SectionCard title="User-level Model Analytics" subtitle="Aggregated model outputs across this user's tickets.">
          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownList title="Categories" data={analytics.category_breakdown} />
            <BreakdownList title="Urgency Levels" data={analytics.urgency_breakdown} />
            <BreakdownList title="Sentiment Breakdown" data={analytics.sentiment_breakdown} />
            <BreakdownList title="Analysis Status" data={analytics.analysis_status_breakdown} />
            <BreakdownList title="Departments Routed To" data={analytics.department_breakdown} />
            <BreakdownList title="Top Key Phrases" data={analytics.top_key_phrases} />
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <SectionCard title="Tickets" subtitle="Choose a ticket to inspect its intermediate model outputs.">
            <div className="space-y-3">
              {analytics.tickets.map((ticket: any) => {
                const active = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{ticket.displayId} · {ticket.ticketName}</p>
                        <p className="text-sm text-slate-500">
                          {ticket._count?.interactions ?? 0} interactions · Created {formatDateTime(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {loadingTicketId === ticket.id ? <Loader2 className="animate-spin text-slate-400" size={16} /> : null}
                        <Badge tone={ticket.status === "SUBMITTED" ? "green" : "blue"}>{ticket.status}</Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Ticket History & Validation" subtitle="Review each model output and save admin validation into the backend.">
            {!selectedTicket ? <p className="text-sm text-slate-500">Select a ticket to inspect its chat history and model outputs.</p> : null}
            {selectedTicket ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedTicket.displayId} · {selectedTicket.ticketName}</p>
                      <p className="text-sm text-slate-500">{selectedTicket.interactions.length} interactions</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="blue">{selectedTicketValidationSummary.total} total</Badge>
                      <Badge tone="green">{selectedTicketValidationSummary.validated} validated</Badge>
                      <Badge tone="orange">{selectedTicketValidationSummary.pending} pending</Badge>
                    </div>
                  </div>
                </div>

                {selectedTicket.interactions.map((interaction: InteractionWithValidation) => {
                  const latestValidation = interaction.validations?.[0];
                  const isValidated = Boolean(latestValidation);
                  const isLoading = validatingInteractionId === interaction.id;
                  const isReanalysing = reanalysingInteractionId === interaction.id;
                  const analysisStatus = interaction.analysisStatus ?? "SUCCESS";

                  return (
                    <article key={interaction.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Step {interaction.stepNumber}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={analysisStatus === "SUCCESS" ? "green" : analysisStatus === "PENDING" ? "orange" : "red"}>
                            Analysis {analysisStatus}
                          </Badge>
                          {isValidated ? <Badge tone="green">Validated</Badge> : <Badge tone="orange">Pending Review</Badge>}
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{interaction.userText}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{interaction.category}</Badge>
                        <Badge tone={interaction.urgency === "HIGH" ? "red" : interaction.urgency === "MEDIUM" ? "orange" : "yellow"}>{interaction.urgency}</Badge>
                        <Badge>{interaction.sentiment}</Badge>
                        <Badge tone="blue">{interaction.department}</Badge>
                      </div>

                      {interaction.keyPhrases?.length ? (
                        <p className="mt-3 text-xs text-slate-500">Key phrases: {interaction.keyPhrases.join(", ")}</p>
                      ) : null}

                      {interaction.analysisError ? (
                        <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                          <p className="font-semibold">Analysis error</p>
                          <p className="mt-1">{interaction.analysisError}</p>
                        </div>
                      ) : null}

                      {isValidated ? (
                        <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                          <div className="flex items-center gap-2 font-semibold">
                            <CheckCircle2 size={16} /> Backend validation saved
                          </div>
                          <p className="mt-1">
                            Validated by {latestValidation?.admin?.name ?? "Admin"} on {formatDateTime(latestValidation?.validatedAt)}.
                          </p>
                          {latestValidation?.notes ? <p className="mt-1 text-emerald-700">Notes: {latestValidation.notes}</p> : null}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => validateInteraction(interaction)}
                          disabled={isValidated || isLoading}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            isValidated
                              ? "cursor-not-allowed bg-emerald-100 text-emerald-700"
                              : "bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                          }`}
                        >
                          {isLoading ? <Loader2 className="animate-spin" size={16} /> : isValidated ? <CheckCircle2 size={16} /> : null}
                          {isValidated ? "Validated" : isLoading ? "Saving..." : "Mark as Validated"}
                        </button>

                        {analysisStatus === "FAILED" ? (
                          <button
                            onClick={() => reanalyseInteraction(interaction)}
                            disabled={isReanalysing}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                          >
                            {isReanalysing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            {isReanalysing ? "Retrying..." : "Retry Analysis"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </section>
    </main>
  );
}

export default function UserAnalyticsPage() {
  return (
    <ProtectedRoute role="ADMIN">
      <UserAnalyticsContent />
    </ProtectedRoute>
  );
}
