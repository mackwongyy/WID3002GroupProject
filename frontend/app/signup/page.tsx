"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.signup({ name, email, password });
      saveSession(result.token, result.user);
      router.push(result.redirect_to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold text-slate-950">Create account</h1>
        <p className="mt-2 text-sm text-slate-500">Customer accounts are created by default. Admins should be seeded or invited securely.</p>

        <label className="mt-6 block text-sm font-medium text-slate-700">Name</label>
        <input className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
        <input className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <button disabled={loading} className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60">
          {loading ? "Creating..." : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-slate-900">Login</Link>
        </p>
      </form>
    </main>
  );
}
