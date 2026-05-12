"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatCard } from "@/components/StatCard";
import { BreakdownList } from "@/components/BreakdownList";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/api";

function UserAnalyticsContent() {
  const params = useParams<{ userId: string }>();
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminUserAnalytics(params.userId).then(setAnalytics).catch((err) => setError(err.message));
  }, [params.userId]);

  async function openTicket(ticketId: string) {
    const result = await api.adminTicketHistory(ticketId);
    setSelectedTicket(result.ticket);
  }

  async function validateInteraction(interactionId: string) {
    await api.validateInteraction(interactionId, { notes: "Validated from admin dashboard." });
    if (selectedTicket) await openTicket(selectedTicket.id);
  }

  if (!analytics) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading user analytics...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-2xl border border-slate-300 p-3 text-slate-700"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-sm text-slate-500">User Analytics</p>
            <h1 className="text-3xl font-bold text-slate-950">{analytics.user.name}</h1>
            <p className="text-slate-500">{analytics.user.email}</p>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard label="Total Tickets" value={analytics.ticket_summary.total_tickets} />
          <StatCard label="In Progress" value={analytics.ticket_summary.in_progress} />
          <StatCard label="Submitted" value={analytics.ticket_summary.submitted} />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <BreakdownList title="Categories" data={analytics.category_breakdown} />
          <BreakdownList title="Urgency Levels" data={analytics.urgency_breakdown} />
          <BreakdownList title="Sentiment Breakdown" data={analytics.sentiment_breakdown} />
          <BreakdownList title="Departments Routed To" data={analytics.department_breakdown} />
          <BreakdownList title="Top Key Phrases" data={analytics.top_key_phrases} />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Tickets</h2>
            <div className="mt-4 space-y-3">
              {analytics.tickets.map((ticket: any) => (
                <button key={ticket.id} onClick={() => openTicket(ticket.id)} className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{ticket.displayId} · {ticket.ticketName}</p>
                      <p className="text-sm text-slate-500">{ticket._count?.interactions ?? 0} interactions</p>
                    </div>
                    <Badge tone={ticket.status === "SUBMITTED" ? "green" : "blue"}>{ticket.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Ticket History</h2>
            {!selectedTicket ? <p className="mt-4 text-sm text-slate-500">Select a ticket to inspect its chat history and model outputs.</p> : null}
            {selectedTicket ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">{selectedTicket.displayId} · {selectedTicket.ticketName}</p>
                  <p className="text-sm text-slate-500">{selectedTicket.interactions.length} interactions</p>
                </div>
                {selectedTicket.interactions.map((interaction: any) => (
                  <article key={interaction.id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Step {interaction.stepNumber}</p>
                    <p className="mt-2 text-sm text-slate-900">{interaction.userText}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{interaction.category}</Badge>
                      <Badge tone={interaction.urgency === "HIGH" ? "red" : interaction.urgency === "MEDIUM" ? "orange" : "yellow"}>{interaction.urgency}</Badge>
                      <Badge>{interaction.sentiment}</Badge>
                      <Badge tone="blue">{interaction.department}</Badge>
                    </div>
                    <button onClick={() => validateInteraction(interaction.id)} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                      Mark as Validated
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
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
