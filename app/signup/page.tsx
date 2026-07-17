"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/components/RequireAuth";
import { getSession, portalPathForRole, signUp, type UserRole } from "@/lib/auth/local";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
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
    const result = await signUp({ name, email, password, role });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    refresh();
    router.push(portalPathForRole(result.user.role));
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose the portal that matches you. You can switch accounts later by logging out."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset className="mb-1">
          <legend className="mb-2 text-[11.5px] font-semibold text-[#3c433a]">I am signing up as</legend>
          <div className="grid grid-cols-2 gap-2">
            <RoleOption
              selected={role === "client"}
              onSelect={() => setRole("client")}
              title="Homebuyer"
              detail="Client portal"
            />
            <RoleOption
              selected={role === "admin"}
              onSelect={() => setRole("admin")}
              title="Agent"
              detail="Admin portal"
            />
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">Full name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
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
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-5 text-center text-[13px] text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--brand)]">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

function RoleOption({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border px-3 py-3 text-left ${
        selected
          ? "border-[var(--brand)] bg-[rgba(31,61,43,.08)]"
          : "border-[var(--line)] bg-white hover:border-[var(--brand)]/40"
      }`}
    >
      <div className="text-[13px] font-semibold text-[var(--ink)]">{title}</div>
      <div className="text-[11px] text-[var(--muted)]">{detail}</div>
    </button>
  );
}
