"use client";

import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Trust, TrustLadder } from "@/components/rift/Trust";
import { money, range, type BuyerInputs, type GapResult } from "@/lib/core/compute";
import type { Readout as ReadoutData } from "@/lib/core/results";
import type { MatchResult } from "@/lib/core/registry";
import { FUNDING_LABEL, TYPE_LABEL } from "@/lib/core/registry";
import { OWN_LABEL, type Ownership } from "@/lib/core/funnel";
import { RETENTION } from "@/lib/core/privacy";
import { useTrack, track } from "@/lib/rift/track";
import { useState } from "react";

/**
 * The payoff.
 *
 * Ungated by design: no account, no email, nothing to cancel. The whole product
 * thesis is that a stranger receives something genuinely valuable before being
 * asked for anything, and every gate added here trades that thesis for a
 * conversion rate somebody will defend in a meeting.
 *
 * The figures arrive already computed from the server. This file decides only
 * what to show and in what order.
 */

interface Props {
  inputs: BuyerInputs;
  ownership: Ownership;
  timing: string;
  readout: ReadoutData;
  cash: ReturnType<typeof import("@/lib/core/compute").cashToClose>;
  gap: GapResult;
  withHelpGap: GapResult;
  levers: ReturnType<typeof import("@/lib/core/compute").gapLevers>;
  monthly: ReturnType<typeof import("@/lib/core/compute").monthlyComputed>;
  band: { price: number; monthly: number }[];
  match: MatchResult;
  registrySource: "database" | "seed";
  windowDays: number;
}

const TONE: Record<string, string> = {
  ready: "chip-pos", close: "chip-brand", building: "chip-warn", exploring: "chip",
};

export function Readout(p: Props) {
  const { readout: r, cash, gap, match, inputs } = p;
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useTrack({ name: "readout_view", side: "buy", meta: { status: r.status, matched: match.matched.length } });

  const bookHref = `/book?v=buy&topic=${encodeURIComponent(r.blocker.title)}`;

  return (
    <div className="buy" style={{ minHeight: "100vh" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/buy" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">Your readout</span>
          </Link>
          <Link href="/buy/start" className="btn btn-g btn-sm"><Ico.refresh size={13} />Change my answers</Link>
        </div>
      </header>

      <main>
        {/* Verdict */}
        <section className="shell-w" style={{ paddingTop: "clamp(28px,4vw,52px)" }}>
          <div className="row gap-2 wrap">
            <span className={`chip ${TONE[r.status]}`}>{r.statusLabel}</span>
            <Trust state="preliminary" />
          </div>
          <h1 className="serif" style={{
            fontSize: "clamp(25px,3.6vw,44px)", lineHeight: 1.12, letterSpacing: "-0.025em",
            marginTop: 16, maxWidth: 820,
          }}>
            {r.verdict}
          </h1>
          {r.rider ? <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>{r.rider}</p> : null}

          {r.tension ? (
            <div className="card" style={{
              marginTop: 20, padding: "14px 16px", maxWidth: 680, background: "var(--sunk)",
              borderLeft: `3px solid ${r.tension.kind === "behind" ? "var(--warn, #b8791f)" : "var(--pos, #2f7a52)"}`,
            }}>
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                {r.tension.kind === "behind"
                  ? <Ico.scale size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
                  : <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 3 }} />}
                <div>
                  <p className="t-sm w6" style={{ lineHeight: 1.5 }}>{r.tension.headline}</p>
                  <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{r.tension.body}</p>
                </div>
              </div>
            </div>
          ) : null}

          <p className="t-xs c-4" style={{ marginTop: 16 }}>
            Built from {inputs.county} County · {OWN_LABEL[p.ownership] ?? OWN_LABEL.none} ·{" "}
            {money(inputs.price)} target · {money(inputs.savings)} saved · {money(inputs.monthlySaving)} a month
          </p>

          <div className="card glance" style={{ marginTop: 26, overflow: "hidden" }}>
            {[
              { label: "Cash to close", value: money(cash.total), note: `not ${money(cash.down)}` },
              { label: "All-in monthly", value: money(p.band[1].monthly) },
              {
                label: gap.gap > 0 ? "Still to find" : "Covered",
                value: money(gap.gap),
                note: gap.monthsToClose !== null ? `~${gap.monthsToClose} months on your own` : "on your savings alone",
              },
              {
                label: "Assistance, if approved",
                value: match.matched.length ? range(match.usableMin, match.usableMax) : "None matched",
                note: match.matched.length
                  ? (p.withHelpGap.gap <= 0 ? "would close the gap" : `would make it ~${p.withHelpGap.monthsToClose ?? 0} months`)
                  : "on these answers",
              },
            ].map((g) => (
              <div key={g.label} style={{ padding: "16px 18px" }}>
                <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{g.label}</div>
                <div className="num" style={{ fontSize: "clamp(17px,2vw,24px)", marginTop: 5 }}>{g.value}</div>
                {g.note ? <div className="t-xs c-4" style={{ marginTop: 2 }}>{g.note}</div> : null}
              </div>
            ))}
          </div>
        </section>

        <div className="shell-w">
          {/* 1 — the reframe */}
          <Sec n={1} title="The number nobody gave you" sub="Down payment is the figure people quote. It is not the figure that has to exist.">
            <div className="ans">
              <div className="ans-out">
                <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>The figure that actually matters</div>
                <div className="ans-num" style={{ marginTop: 8 }}>{money(cash.total)}</div>
                <p style={{ marginTop: 16, color: "rgba(255,255,255,.75)", fontSize: 15.5, lineHeight: 1.65, maxWidth: 620 }}>
                  {r.reframe.body}
                </p>
              </div>
            </div>
            <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
              {cash.lines.map((l) => (
                <div key={l.label} className="between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                  <div className="row gap-2 grow">
                    <span className="t-sm w5">{l.label}</span>
                    {l.credited ? <span className="chip chip-brand">back at closing</span> : null}
                  </div>
                  <span className="num t-sm" style={{ opacity: l.credited ? 0.4 : 1 }}>{money(l.amount)}</span>
                </div>
              ))}
              <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                <span className="t-md w6">What you bring</span>
                <span className="num" style={{ fontSize: 22 }}>{money(cash.total)}</span>
              </div>
            </div>
            <Assumptions items={cash.assumptions} caveat={cash.couldBeWrong} />
          </Sec>

          {/* 2 — programmes */}
          <Sec
            n={2}
            title={match.matched.length
              ? `${match.matched.length} Georgia program${match.matched.length === 1 ? "" : "s"} may fit your answers`
              : "No verified program matches these answers today"}
            sub={match.matched.length
              ? "Named, with what each one asks of you. Estimated ranges, never approvals."
              : "That is not the same as nothing existing — only that we will not show you a number we cannot stand behind."}
          >
            <div className="col gap-2">
              {match.matched.map((prog) => (
                <div key={prog.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <div className="grow" style={{ minWidth: 220 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w6">{prog.name}</span>
                        <span className={`chip ${prog.funding === "open" ? "chip-pos" : prog.funding === "waitlist" ? "chip-warn" : "chip-neg"}`}>
                          {FUNDING_LABEL[prog.funding]}
                        </span>
                        <span className="chip">{TYPE_LABEL[prog.type]}</span>
                      </div>
                      <div className="t-xs c-4" style={{ marginTop: 4 }}>{prog.administrator}</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div className="num t-lg c-brand">{range(prog.min, prog.max)}</div>
                      <div className="t-2xs c-4">estimated range</div>
                    </div>
                  </div>
                  <div className="col gap-1" style={{ marginTop: 12 }}>
                    {[prog.incomeLimitNote, prog.priceCapNote, ...prog.conditions.slice(0, 2)].map((c) => (
                      <div key={c} className="row gap-2" style={{ alignItems: "flex-start" }}>
                        <Ico.check size={12} className="c-4" style={{ flex: "none", marginTop: 3 }} />
                        <span className="t-xs c-3" style={{ lineHeight: 1.5 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="row gap-2 wrap" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                    <Trust state="verified" short />
                    <span className="t-2xs c-4">
                      Terms confirmed with {prog.verifiedBy} on {prog.verifiedOn}. Whether <em>you</em> qualify
                      is still preliminary until a lender checks your income.
                    </span>
                  </div>
                </div>
              ))}
              {match.suppressed.length ? (
                <p className="t-xs c-4" style={{ lineHeight: 1.6 }}>
                  {match.suppressed.length} further program{match.suppressed.length === 1 ? " was" : "s were"} withheld
                  because we have not re-verified {match.suppressed.length === 1 ? "it" : "them"} in {p.windowDays} days.
                  We would rather show you less than show you something that has quietly changed.
                </p>
              ) : null}
            </div>
          </Sec>

          {/* 3 — the blocker */}
          <Sec n={3} title="The one thing in the way" sub="Not a list of everything. The thing that actually decides your date.">
            <div className="card p-5">
              <div className="t-md w6">{r.blocker.title}</div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65 }}>{r.blocker.body}</p>
              <Link href={bookHref} className="btn btn-p" style={{ marginTop: 16 }}
                onClick={() => track({ name: "booking_start", side: "buy", meta: { from: "blocker" } })}>
                Talk this through — 20 minutes, no obligation<Ico.arrowR size={14} />
              </Link>
            </div>
          </Sec>

          {/* 4 — the steps */}
          <Sec n={4} title="What to do next, in order" sub="Ordered by what unblocks the most.">
            <div className="card" style={{ overflow: "hidden" }}>
              {r.steps.map((s, ix) => (
                <div key={s.label} className="row gap-3" style={{
                  padding: "14px 18px", alignItems: "flex-start",
                  borderBottom: ix === r.steps.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <span className="num t-sm c-4" style={{ minWidth: 20 }}>{ix + 1}</span>
                  <div className="grow">
                    <div className="t-sm w6">{s.label}</div>
                    <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.6 }}>{s.detail}</p>
                  </div>
                  {/* Every step names an owner and a when. A step with neither
                      is a wish, and a list of wishes is what most "next steps"
                      sections actually are. */}
                  <div style={{ flex: "none", textAlign: "right" }}>
                    <div className="chip">{s.owner}</div>
                    <div className="t-2xs c-4" style={{ marginTop: 4 }}>{s.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </Sec>

          {/* 5 — the question sheet */}
          <Sec n={5} title="What to ask a lender" sub="So the first call is not the one where you learn what you did not know to ask.">
            <div className="card p-5">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {r.questions.map((q) => (
                  <li key={q} className="t-sm" style={{ marginBottom: 8, lineHeight: 1.6 }}>{q}</li>
                ))}
              </ul>
            </div>
          </Sec>
        </div>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 40 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <div className="split-w" style={{ marginBottom: 24 }}>
              <TrustLadder
                at="preliminary"
                ask={{ what: "Cash to close, and the gap it leaves", claim: money(cash.total) }}
              />
              <div className="card" style={{ overflow: "hidden" }}>
                <button className="between" style={{ width: "100%", padding: "13px 16px", background: "transparent", border: 0, textAlign: "left" }}
                  onClick={() => setPrivacyOpen(!privacyOpen)}>
                  <div className="row gap-2">
                    <Ico.lock size={14} className="c-3" />
                    <span className="t-sm w55">What we keep, and for how long</span>
                  </div>
                  <Ico.chevD size={14} className="c-4" style={{ transform: privacyOpen ? "rotate(180deg)" : undefined }} />
                </button>
                {privacyOpen ? (
                  <div style={{ padding: "0 16px 16px" }} className="col gap-2">
                    {RETENTION.map((rule) => (
                      <div key={rule.id} className="card p-3">
                        <div className="between wrap gap-2">
                          <span className="t-sm w55 grow" style={{ minWidth: 200 }}>{rule.what}</span>
                          <span className="chip">{rule.keptFor}</span>
                        </div>
                        <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>{rule.why}</p>
                        <p className="t-xs c-4" style={{ marginTop: 4 }}>Then: {rule.thenWhat}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="t-xs c-4" style={{ lineHeight: 1.6, maxWidth: 620 }}>
              Prepared by Rift, guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Every figure
              here is a planning estimate, not a lending commitment, approval, or valuation. Nothing
              on this page requires you to work with us, and none of it stops working if you don&apos;t.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Sec({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <div className="row gap-2" style={{ alignItems: "baseline" }}>
        <span className="num t-xs c-4">{String(n).padStart(2, "0")}</span>
        <h2 className="serif" style={{ fontSize: "clamp(20px,2.6vw,30px)", letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      {sub ? <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 620, lineHeight: 1.6 }}>{sub}</p> : null}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

/** Every figure carries its assumptions and its failure mode. Contract 4.2. */
function Assumptions({ items, caveat }: { items: { label: string; value: string }[]; caveat: string }) {
  return (
    <div className="card p-4" style={{ marginTop: 12, background: "var(--sunk)" }}>
      <div className="t-xs w6" style={{ marginBottom: 8 }}>What this assumes</div>
      <div className="col gap-1">
        {items.map((a) => (
          <div key={a.label} className="between t-xs">
            <span className="c-3">{a.label}</span>
            <span className="num">{a.value}</span>
          </div>
        ))}
      </div>
      <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
        <span className="w6">Where this could be wrong: </span>{caveat}
      </p>
    </div>
  );
}
