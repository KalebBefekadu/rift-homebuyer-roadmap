"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";

export default function LandingPage() {
  return (
    <div className="bg-[var(--ink)] text-[var(--ink)]">
      {/* Hero — one composition: brand, headline, support, CTAs, full-bleed image */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2400&q=80)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0e1610] via-[#0e1610]/55 to-[#1f3d2b]/35"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl animate-[rift-drift_12s_ease-in-out_infinite]"
          aria-hidden
        />
        <MarketingNav />

        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-16 pt-28 md:px-10 md:pb-20">
          <p className="font-display mb-3 text-[13px] font-semibold tracking-[0.2em] text-[var(--accent)] uppercase animate-[rift-fade_0.9s_ease-out_both]">
            Rift
          </p>
          <h1 className="font-display max-w-[14ch] text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.98] font-semibold tracking-[-0.03em] text-white animate-[rift-fade_1s_ease-out_0.1s_both]">
            Your path to owning starts with a clear plan.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/80 animate-[rift-fade_1s_ease-out_0.2s_both]">
            A first-time buyer readiness program for renters who want a real roadmap—not a sales pitch.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-[rift-fade_1s_ease-out_0.35s_both]">
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--accent)] px-5 py-3 text-[14px] font-semibold text-[#1a1408] no-underline hover:brightness-110"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/35 bg-white/5 px-5 py-3 text-[14px] font-semibold text-white no-underline backdrop-blur-sm hover:bg-white/12"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative bg-[var(--paper)] px-5 py-20 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-tight text-[var(--brand)]">
            How the program works
          </h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[var(--muted)]">
            Interests are aligned out loud: we only win when you become a qualified, confident, well-financed
            buyer. The diagnosis is generous. The execution is sequenced as you progress.
          </p>
          <ol className="mt-12 space-y-10">
            {[
              {
                n: "01",
                t: "Intake & roadmap",
                d: "In about 30 minutes we map your target price, monthly payment, cash to close, assistance you may qualify for, and the exact gap left to close.",
              },
              {
                n: "02",
                t: "Work the gap",
                d: "Credit moves, savings, documentation, and down-payment programs—tracked against your personal plan, with a standing monthly group for accountability.",
              },
              {
                n: "03",
                t: "Mortgage ready → shop",
                d: "When the numbers and paperwork line up, lender intro and house hunting start from the same plan you already own.",
              },
            ].map((step) => (
              <li key={step.n} className="grid gap-2 border-t border-[var(--line)] pt-8 sm:grid-cols-[4rem_1fr]">
                <span className="font-display text-2xl font-semibold text-[var(--accent)]">{step.n}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-[var(--brand)]">{step.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative overflow-hidden bg-[var(--brand)] px-5 py-20 text-white md:px-10">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=70')] bg-cover bg-center opacity-25"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-tight">
            Built for first-time buyers who are renting today
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/75">
            Especially for people who have said they want to own but figure they cannot yet—credit, cash, or
            documentation standing in the way. Community workshops (including Amharic) and warm referrals feed
            this path. Ads do not.
          </p>
          <ul className="mt-10 max-w-xl space-y-3 text-[15px] text-white/85">
            <li className="flex gap-3">
              <span className="text-[var(--accent)]">→</span>
              Personalized Homeownership Roadmap you keep
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--accent)]">→</span>
              Clear cash-gap number after savings and assistance programs
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--accent)]">→</span>
              A portal to track progress when your plan is ready
            </li>
          </ul>
        </div>
      </section>

      {/* Portal preview */}
      <section className="bg-[var(--app-bg)] px-5 py-20 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-tight text-[var(--app-panel)]">
            One site. Two portals.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#a8aea4]">
            Agents run intakes and the pipeline. Clients sign in later to see their living roadmap. Sign up for
            the side that matches you.
          </p>
          <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-7">
              <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--accent)] uppercase">Admin</p>
              <h3 className="font-display mt-2 text-xl font-semibold text-white">Agent portal</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#a8aea4]">
                Create roadmaps, manage the pipeline, and download branded PDFs during live intakes.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-7">
              <p className="text-[11px] font-bold tracking-[0.12em] text-[var(--accent)] uppercase">Client</p>
              <h3 className="font-display mt-2 text-xl font-semibold text-white">Buyer portal</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#a8aea4]">
                Your place to view the plan after intake. Shared roadmap links and updates come next.
              </p>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--accent)] px-5 py-3 text-[14px] font-semibold text-[#1a1408] no-underline hover:brightness-110"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-5 py-3 text-[14px] font-semibold text-white no-underline hover:bg-white/10"
            >
              Log in to your portal
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0e1610] px-5 py-8 text-center text-[12px] text-[#7a8278] md:px-10">
        <p className="font-display text-sm text-white/70">Rift</p>
        <p className="mt-2 max-w-lg mx-auto leading-relaxed">
          Planning estimates only—not a loan approval, quote, or commitment. Your lender remains the authority on
          real numbers.
        </p>
      </footer>
    </div>
  );
}
