"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/components/RequireAuth";
import { getSession, portalPathForRole, signIn } from "@/lib/auth/local";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (existing) router.replace(portalPathForRole(existing.role));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn({ email, password });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    refresh();
    const next = params.get("next");
    router.push(next || portalPathForRole(result.user.role));
  }

  return (
    <AuthShell title="Log in" subtitle="Enter your portal—admin or client, based on your account.">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-[13px] text-[#b04a3a]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:bg-[#16301f] disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-5 text-center text-[13px] text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[var(--brand)]">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[var(--app-bg)] text-[#c5cbc0]">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
