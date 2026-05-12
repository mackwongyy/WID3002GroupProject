"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/Badge";
import { api, type Interaction, type Ticket } from "@/lib/api";

function urgencyTone(colour?: string) {
  if (colour === "Red") return "red" as const;
  if (colour === "Orange") return "orange" as const;
  return "yellow" as const;
}

function TicketPageContent() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [message, setMessage] = useState("");
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [ticketResult, messageResult] = await Promise.all([api.getTicket(ticketId), api.getMessages(ticketId)]);
    setTicket(ticketResult.ticket);
    setEditingName(ticketResult.ticket.ticketName);
    setInteractions(messageResult.interactions);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [ticketId]);

  async function renameTicket() {
    if (!editingName.trim() || !ticket) return;
    const result = await api.renameTicket(ticket.id, editingName.trim());
    setTicket(result.ticket);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.sendMessage(ticketId, message.trim());
      setInteractions((prev) => [...prev, result.interaction]);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitTicket() {
    if (!ticket) return;
    const result = await api.submitTicket(ticket.id);
    setTicket(result.ticket);
  }

  if (!ticket) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading ticket...</main>;
  }

  const readOnly = ticket.status === "SUBMITTED";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-2xl border border-slate-300 p-3 text-slate-700"><ArrowLeft size={18} /></Link>
            <div>
              <p className="text-sm text-slate-500">{ticket.displayId}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input className="rounded-xl border border-slate-300 px-3 py-2 text-xl font-bold" value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={renameTicket} />
                <Badge tone={readOnly ? "green" : "blue"}>{ticket.status}</Badge>
              </div>
            </div>
          </div>
          <button disabled={readOnly} onClick={submitTicket} className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            Submit Ticket
          </button>
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 space-y-5">
          {interactions.length === 0 ? <p className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">Start the conversation by describing your issue.</p> : null}
          {interactions.map((interaction) => (
            <article key={interaction.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User message · Step {interaction.stepNumber}</p>
                <p className="mt-2 whitespace-pre-wrap text-slate-900">{interaction.userText}</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Category</p>
                  <p className="mt-2 font-bold text-slate-900">{interaction.modelOutput.category}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Urgency</p>
                  <p className="mt-2"><Badge tone={urgencyTone(interaction.modelOutput.urgency_colour)}>{interaction.modelOutput.urgency}</Badge></p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Sentiment</p>
                  <p className="mt-2 font-bold text-slate-900">{interaction.modelOutput.sentiment}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Department</p>
                  <p className="mt-2 font-bold text-slate-900">{interaction.modelOutput.department}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Key Phrases</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {interaction.modelOutput.key_phrases?.map((phrase) => <Badge key={phrase}>{phrase}</Badge>)}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <form onSubmit={sendMessage} className="sticky bottom-0 mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
          <textarea
            disabled={readOnly || loading}
            className="min-h-28 w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
            placeholder={readOnly ? "This ticket has been submitted. Chat history is read-only." : "Describe your issue here..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <button disabled={readOnly || loading} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:bg-slate-300">
              <Send size={16} /> {loading ? "Analysing..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function TicketPage() {
  return (
    <ProtectedRoute role="CUSTOMER">
      <TicketPageContent />
    </ProtectedRoute>
  );
}
