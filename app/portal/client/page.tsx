"use client";

import Link from "next/link";
import { useAuth } from "@/components/RequireAuth";

export default function ClientHomePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--accent)] uppercase">Client portal</p>
      <h1 className="font-display mt-2 text-3xl font-semibold text-[var(--app-panel)]">
        Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#a8aea4]">
        This is your space for the Homeownership Roadmap once your intake is complete. Shared, read-only
        roadmaps that update as you progress are coming next.
      </p>

      <div className="mt-10 rounded-2xl border border-white/10 bg-[var(--app-panel)] px-6 py-8">
        <h2 className="font-display text-xl font-semibold text-[var(--brand)]">Your roadmap</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
          No roadmap is linked to this account yet. After your intake with Rift, your personalized plan will
          show up here—target price, monthly payment, cash gap, and next moves.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-[13px] font-semibold text-[var(--brand)] no-underline hover:underline"
        >
          ← Back to Rift
        </Link>
      </div>
    </div>
  );
}
