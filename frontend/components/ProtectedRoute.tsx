"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken, type Role } from "@/lib/auth";

export function ProtectedRoute({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function verify() {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const { user } = await api.me();
        if (user.role !== role) {
          router.replace(user.role === "ADMIN" ? "/admin" : "/dashboard");
          return;
        }
        setReady(true);
      } catch {
        router.replace("/login");
      }
    }
    verify();
  }, [role, router]);

  if (!ready) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading...</main>;
  }

  return <>{children}</>;
}
