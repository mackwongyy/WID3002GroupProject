"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatCard } from "@/components/StatCard";
import { BreakdownList } from "@/components/BreakdownList";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function AdminContent() {
  const router = useRouter();
  const [summary, setSummary] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [summaryResult, usersResult, ticketsResult] = await Promise.all([
      api.adminSummary(),
      api.adminUsers(),
      api.adminTickets()
    ]);
    setSummary(summaryResult);
    setUsers(usersResult.users);
    setTickets(ticketsResult.tickets);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const id = window.setInterval(() => load().catch(() => undefined), 15000);
    return () => window.clearInterval(id);
  }, []);

  function logout() {
    clearSession();
    router.push("/login");
  }

  if (!summary) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading admin dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Operational Overview</h1>
            <p className="mt-1 text-slate-500">Monitor tickets, routing outputs, and validation progress.</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
            <LogOut size={16} /> Logout
          </button>
        </div>

        {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <SectionCard title="Snapshot" subtitle="Overall system activity and admin review coverage.">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-9">
            <StatCard label="Total Tickets" value={summary.total_tickets} />
            <StatCard label="In Progress" value={summary.status_breakdown?.IN_PROGRESS ?? 0} />
            <StatCard label="Submitted" value={summary.status_breakdown?.SUBMITTED ?? 0} />
            <StatCard label="Customers" value={users.length} />
            <StatCard label="Interactions" value={summary.validation_summary?.total_interactions ?? 0} />
            <StatCard label="Validated" value={summary.validation_summary?.validated_interactions ?? 0} />
            <StatCard label="Pending Review" value={summary.validation_summary?.pending_interactions ?? 0} />
            <StatCard label="Analysis Failed" value={summary.analysis_status_breakdown?.FAILED ?? 0} />
            <StatCard label="Analysis Pending" value={summary.analysis_status_breakdown?.PENDING ?? 0} />
          </div>
        </SectionCard>

        <SectionCard title="Model Output Analytics" subtitle="Aggregated categories, urgency, sentiment, departments, and key phrases produced by the NLP service.">
          <div className="grid gap-4 lg:grid-cols-4">
            <BreakdownList title="Categories" data={summary.category_breakdown} />
            <BreakdownList title="Urgency Levels" data={summary.urgency_breakdown} />
            <BreakdownList title="Sentiment Breakdown" data={summary.sentiment_breakdown} />
            <BreakdownList title="Analysis Status" data={summary.analysis_status_breakdown} />
            <BreakdownList title="Departments Routed To" data={summary.department_breakdown} />
            <BreakdownList title="Top Key Phrases" data={summary.top_key_phrases} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Department Status Summary</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.department_status_breakdown ?? {}).map(([department, counts]: any) => (
                  <div key={department} className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{department}</p>
                    <p className="mt-1 text-sm text-slate-500">In Progress: {counts.in_progress} · Submitted: {counts.submitted}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Users" subtitle="Open a user profile to review ticket histories and validate model outputs.">
            <div className="space-y-3">
              {users.map((user) => (
                <Link key={user.id} href={`/admin/users/${user.id}/analytics`} className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <Badge tone="blue">{user._count?.tickets ?? 0} tickets</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Latest Tickets" subtitle="Most recently updated tickets and their latest model routing output.">
            <div className="space-y-3">
              {tickets.slice(0, 8).map((ticket) => {
                const latestInteraction = ticket.interactions?.[0];
                const latestValidated = (latestInteraction?.validations?.length ?? 0) > 0;
                return (
                  <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{ticket.displayId} · {ticket.ticketName}</p>
                        <p className="text-sm text-slate-500">{ticket.user?.name} · {ticket.user?.email}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge tone={ticket.status === "SUBMITTED" ? "green" : "blue"}>{ticket.status}</Badge>
                        {latestInteraction ? <Badge tone={latestValidated ? "green" : "orange"}>{latestValidated ? "Latest Validated" : "Latest Pending"}</Badge> : null}
                      </div>
                    </div>
                    {latestInteraction ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Latest: {latestInteraction.category} · {latestInteraction.department}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute role="ADMIN">
      <AdminContent />
    </ProtectedRoute>
  );
}
