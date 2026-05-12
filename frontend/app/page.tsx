import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-10 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">WID3002 NLP Project</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">Smart Customer Feedback Analysis System</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          A role-based ticketing platform that analyses customer messages using NLP, routes tickets to departments and provides admin analytics.
        </p>
        <div className="mt-8 flex gap-3">
          <Link className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white" href="/login">Login</Link>
          <Link className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700" href="/signup">Signup</Link>
        </div>
      </section>
    </main>
  );
}
