"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/Badge";
import { api, type Ticket } from "@/lib/api";
import { clearSession } from "@/lib/auth";

function DashboardContent() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketName, setTicketName] = useState("");
  const [error, setError] = useState("");

  async function loadTickets() {
    const result = await api.getTickets();
    setTickets(result.tickets);
  }

  useEffect(() => {
    loadTickets().catch((err) => setError(err.message));
  }, []);

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();
    if (!ticketName.trim()) return;
    const result = await api.createTicket(ticketName.trim());
    router.push(`/dashboard/tickets/${result.ticket.id}`);
  }

  async function deleteTicket(ticketId: string) {
    await api.deleteTicket(ticketId);
    await loadTickets();
  }

  async function moveTicket(index: number, direction: -1 | 1) {
    const next = [...tickets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setTickets(next);
    await api.reorderTickets(next.map((ticket) => ticket.id));
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Customer Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Your Tickets</h1>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            <LogOut size={16} /> Logout
          </button>
        </div>

        <form onSubmit={createTicket} className="mt-8 flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3"
            placeholder="Set a ticket name, e.g. Double charge issue"
            value={ticketName}
            onChange={(e) => setTicketName(e.target.value)}
          />
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white">
            <Plus size={18} /> Create Ticket
          </button>
        </form>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600">
            <span className="col-span-2">Ticket ID</span>
            <span className="col-span-3">Name</span>
            <span className="col-span-2">Created</span>
            <span className="col-span-2">Submitted</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          {tickets.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No tickets yet. Create your first ticket above.</p>
          ) : null}
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className="grid grid-cols-12 items-center gap-3 border-b border-slate-100 px-5 py-4 text-sm last:border-b-0">
              <Link href={`/dashboard/tickets/${ticket.id}`} className="col-span-2 font-semibold text-slate-900 hover:underline">{ticket.displayId}</Link>
              <span className="col-span-3 text-slate-700">{ticket.ticketName}</span>
              <span className="col-span-2 text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</span>
              <span className="col-span-2 text-slate-500">{ticket.submittedAt ? new Date(ticket.submittedAt).toLocaleString() : "-"}</span>
              <span className="col-span-1"><Badge tone={ticket.status === "SUBMITTED" ? "green" : "blue"}>{ticket.status}</Badge></span>
              <span className="col-span-2 flex justify-end gap-2">
                <button className="rounded-xl border border-slate-300 px-2 py-1" onClick={() => moveTicket(index, -1)}>↑</button>
                <button className="rounded-xl border border-slate-300 px-2 py-1" onClick={() => moveTicket(index, 1)}>↓</button>
                <button className="rounded-xl border border-red-200 p-2 text-red-600" onClick={() => deleteTicket(ticket.id)} aria-label="Delete ticket">
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute role="CUSTOMER">
      <DashboardContent />
    </ProtectedRoute>
  );
}
