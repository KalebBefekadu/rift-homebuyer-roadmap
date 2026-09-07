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
import type { RateAssumption } from "@/lib/core/rate";
import { useTrack, track } from "@/lib/rift/track";
import { useState, useRef } from "react";
import { sessionId } from "@/lib/rift/session";

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
  rate: RateAssumption;
  /** Whether they named somebody else in the decision. */
  coBuyer?: boolean;
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
            <RateNote rate={p.rate} />
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

        <div className="shell-w">
          <Keep
            side="buy"
            inputs={inputs}
            figures={{
              verdict: r.verdict,
              cashToClose: cash.total,
              monthly: p.band[1].monthly,
              gap: gap.gap,
              assistance: match.matched.length ? range(match.usableMin, match.usableMax) : "None matched",
              status: r.status,
            }}
            matched={match.matched.map((m) => ({ id: m.id, name: m.name, min: m.min, max: m.max }))}
            bookHref={bookHref}
            lead={{
              timing: p.timing,
              /* Months on savings alone — the same figure the readout leads
                 with, and null when no saving rate was given rather than 0,
                 which would read as "ready today". */
              monthsToReady: gap.gap <= 0 ? 0 : gap.monthsToClose,
              /* Deal size is the purchase price. Cash to close was being sent
                 here, which understated every lead by roughly 90%. */
              value: inputs.price,
              coBuyer: Boolean(p.coBuyer),
            }}
          />
        </div>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 40 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <div className="split-w" style={{ marginBottom: 24 }}>
              <AskReview what="Cash to close, and the gap it leaves" claim={money(cash.total)} />
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
                    <ForgetMe />
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


/* ------------------------------------------------------------------ *
 * Keep and share
 * ------------------------------------------------------------------ */

/**
 * The three rungs of the conversion ladder, at three commitment levels.
 *
 * Keeping the readout is deliberately the EASIEST of the three and asks for
 * nothing. The product's promise is that a stranger keeps what they were given;
 * charging an email for it would make the promise conditional, and a
 * conditional gift is a trade somebody can decline.
 *
 * The share link is the referral loop's first turn. Somebody sending their
 * numbers to a partner or a parent is doing the most valuable thing that can
 * happen on this page, and it costs them one tap.
 */
function Keep({ side, inputs, figures, matched, bookHref, lead }: {
  side: "buy" | "sell";
  inputs: BuyerInputs;
  figures: Record<string, string | number>;
  matched: { id: string; name: string; min: number; max: number }[];
  bookHref: string;
  /**
   * Everything the score needs, from the readout that already computed it.
   *
   * This carried three of the six signals and passed cash-to-close where the
   * model expects the purchase price. A lead captured here therefore scored
   * well below what its own answers justified, and the ranking an agent is
   * asked to trust would have been built on partial, partly wrong inputs —
   * the fastest way to make a ranking worth ignoring.
   */
  lead: { timing: string; monthsToReady: number | null; value: number; coBuyer: boolean };
}) {
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "working" | "unavailable">("idle");
  const [copied, setCopied] = useState(false);
  const assessmentId = useRef<string | null>(null);

  const makeLink = async (): Promise<string | null> => {
    if (link) return link;
    setState("working");
    try {
      /* The assessment id is not held on this page — it belongs to the run that
         produced these numbers. Reattaching by session keeps the snapshot tied
         to the right attempt without putting an id in a shareable URL. */
      const started = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId(), side, county: inputs.county }),
      }).then((x) => x.json());
      assessmentId.current = started?.id ?? null;

      const res = await fetch("/api/readout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: assessmentId.current ?? "", side, inputs, figures, matched }),
      }).then((x) => x.json());

      if (res?.shareToken) {
        const url = `${window.location.origin}/r/${res.shareToken}`;
        setLink(url);
        setState("idle");
        track({ name: "share_sent", side, meta: { via: "link" } });
        return url;
      }
      /* No token means the snapshot was not stored. Say so rather than hand
         over a link that will 404 for whoever it is sent to. */
      setState("unavailable");
      return null;
    } catch {
      setState("unavailable");
      return null;
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Clipboard blocked. The input below is selectable, which is the fallback. */
    }
  };

  return (
    <section className="sec">
      <h2 className="serif" style={{ fontSize: "clamp(20px,2.6vw,30px)", letterSpacing: "-0.02em" }}>
        Keep this
      </h2>
      <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 620, lineHeight: 1.6 }}>
        It is yours either way. Nothing below signs you up to anything.
      </p>

      <div className="g3 gap-3" style={{ marginTop: 18 }}>
        <div className="card p-4">
          <div className="t-sm w6">Send it to someone</div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            A partner, a parent helping with the deposit, or a lender. They see the numbers, not
            your contact details.
          </p>
          {link ? (
            <div style={{ marginTop: 12 }}>
              <input
        className="input"
        readOnly
        value={link}
        aria-label="Your share link"
        onFocus={(e) => e.currentTarget.select()}
      />
              <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={copy}>
                <Ico.share size={13} />{copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : state === "unavailable" ? (
            <p className="t-xs c-3 row gap-2" style={{ marginTop: 12 }}>
              <Ico.alert size={12} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
              Sharing is briefly unavailable. Your readout still works — this page stays at the
              same address.
            </p>
          ) : (
            <button className="btn btn-g" style={{ marginTop: 12 }} onClick={makeLink} disabled={state === "working"}>
              {state === "working" ? "Making a link…" : "Make a share link"}
            </button>
          )}
        </div>

        <div className="card p-4">
          <div className="t-sm w6">Send it to your inbox</div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            So it survives a closed tab and a new phone. No newsletter, no list, and one click
            unsubscribes.
          </p>
          <EmailIt
            side={side}
            county={inputs.county}
            cashToClose={Number(figures.cashToClose) || 0}
            gap={Number(figures.gap) || 0}
            ensureLink={makeLink}
            link={link}
            lead={lead}
            /* A ref rather than state: it is filled in by makeLink, and the
               capture reads whatever is there at the moment it runs. Empty is
               a legitimate answer — a share-link visitor has no assessment of
               their own. */
            assessmentRef={assessmentId}
          />
        </div>

        <div className="card p-4" style={{ background: "var(--sunk)" }}>
          <div className="t-sm w6">Talk it through</div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Twenty minutes about the one thing in the way. No obligation, and nothing to cancel.
          </p>
          <Link href={bookHref} className="btn btn-p" style={{ marginTop: 12 }}
            onClick={() => track({ name: "booking_start", side, meta: { from: "keep" } })}>
            Find a time<Ico.arrowR size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}


/**
 * Email capture on the readout.
 *
 * The address buys them a durable copy; it does not buy them the readout,
 * which they already have. That ordering is the whole product — asking for an
 * email to unlock what somebody is already looking at would turn a gift into a
 * toll booth, and people can tell.
 *
 * The consent note is shown before the field, not after the button. Consent
 * that appears once you have already typed is a formality.
 */
function EmailIt({ side, county, cashToClose, gap, ensureLink, link, lead, assessmentRef }: {
  side: "buy" | "sell";
  county: string;
  cashToClose: number;
  gap: number;
  ensureLink: () => Promise<string | null>;
  link: string | null;
  lead: { timing: string; monthsToReady: number | null; value: number; coBuyer: boolean };
  assessmentRef: { current: string | null };
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "unavailable" | "error">("idle");

  const submit = async () => {
    if (!email.trim()) return;
    setState("sending");
    try {
      const url = link ?? (await ensureLink()) ?? window.location.href;
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          /* Linked when there is an assessment to link to, and honestly
             unlinked when there is not. */
          assessmentId: assessmentRef.current ?? "",
          email: email.trim(),
          lead: { side, completion: 1, source: "readout", ...lead },
          deliver: { shareUrl: url, cashToClose, gap, county },
        }),
      }).then((x) => x.json());

      if (res?.error) { setState("error"); return; }
      track({ name: "email_capture", side, meta: { delivered: res?.delivery === "sent" } });
      /* Three outcomes, three messages. "Check your inbox" for a message that
         was never sent is the kind of small lie that costs more than the
         feature is worth — and "not switched on yet" for a send that actually
         failed is the same lie pointing the other way. */
      if (res?.delivery === "sent") setState("sent");
      else if (res?.delivery === "failed") setState("error");
      else setState("unavailable");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p className="t-sm c-3 row gap-2" style={{ marginTop: 12 }}>
        <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
        On its way. It has the link, so it works on any device.
      </p>
    );
  }

  if (state === "unavailable") {
    return (
      <p className="t-sm c-3 row gap-2" style={{ marginTop: 12 }}>
        <Ico.info size={14} className="c-4" style={{ flex: "none", marginTop: 2 }} />
        Noted, but email is not switched on yet — so nothing has been sent. Keep the link above;
        it is the same document.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="t-2xs c-4" style={{ marginBottom: 6, lineHeight: 1.5 }}>
        We email you this readout and tell you if something in it changes. Nothing else.
      </p>
      <input
        className="input"
        type="email"
        placeholder="you@example.com"
        /* The visible copy above explains what the field is for but is not a
           <label>, so a screen reader would announce this as an unlabelled
           text box. */
        aria-label="Your email address, to receive this readout"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      />
      <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} disabled={!email.trim() || state === "sending"} onClick={submit}>
        <Ico.mail size={13} />{state === "sending" ? "Sending…" : "Email it to me"}
      </button>
      {state === "error" ? (
        <p className="t-xs c-neg" style={{ marginTop: 8, lineHeight: 1.5 }}>
          We could not send that. Your readout is unaffected — keep the share link above, which
          is the same document.
        </p>
      ) : null}
    </div>
  );
}


/**
 * The trust ladder, with the door on it.
 *
 * The ladder describes four rungs; this is what lets somebody reach the second
 * one. Without it `pending-review` was a state the product explained and could
 * never enter, which is a path drawn on a wall.
 */
function AskReview({ what, claim }: { what: string; claim: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "unavailable">("idle");

  const ask = async () => {
    setState("sending");
    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "figure", what, claim }),
      }).then((x) => x.json());
      track({ name: "review_requested", side: "buy" });
      setState(r?.ok && !r?.skipped ? "sent" : "unavailable");
    } catch {
      setState("unavailable");
    }
  };

  return (
    <div className="col gap-3">
      <TrustLadder at="preliminary" />
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        {state === "sent" ? (
          <div className="row gap-2">
            <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
            <p className="t-xs c-3" style={{ lineHeight: 1.55 }}>
              It is with Kaleb. He aims to come back inside a day. Until he does, the number on
              this page is still an estimate — asking does not make it truer, it just gets a
              person looking at it.
            </p>
          </div>
        ) : state === "unavailable" ? (
          <p className="t-xs c-3" style={{ lineHeight: 1.55 }}>
            Requests are briefly unavailable, so nothing has been queued. Your readout is
            unaffected.
          </p>
        ) : (
          <div className="between wrap gap-2">
            <p className="t-xs c-3" style={{ lineHeight: 1.55, maxWidth: 380 }}>
              Want a person to go through it? No account, no obligation, and your answer comes
              back whether or not you ever work with him.
            </p>
            <button className="btn btn-g btn-sm" onClick={ask} disabled={state === "sending"}>
              <Ico.shield size={13} />{state === "sending" ? "Sending…" : "Ask Kaleb to check this"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * "Delete all of it."
 *
 * At the top of the retention panel rather than buried under it. A deletion
 * control that is harder to find than the policy explaining it is a policy
 * pretending to be a control — and this product's whole argument is that it
 * shows people the truth before asking them for anything.
 *
 * It clears the browser first and the server second, in that order, so that a
 * failed request still leaves nothing on the device the person is holding.
 */
function ForgetMe() {
  const [state, setState] = useState<"idle" | "working" | "done" | "partial">("idle");

  const forget = async () => {
    setState("working");
    const sid = sessionId();
    try {
      window.localStorage.removeItem("rift.buy.draft");
      window.sessionStorage.removeItem("rift.sid");
    } catch { /* storage already unavailable — nothing to clear */ }

    try {
      const r = await fetch("/api/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      }).then((x) => x.json());
      track({ name: "data_deleted", side: "buy" });
      setState(r?.ok && !r?.skipped ? "done" : "partial");
    } catch {
      setState("partial");
    }
  };

  if (state === "done") {
    return (
      <div className="card p-3" style={{ borderColor: "var(--pos, #2f7a52)" }}>
        <div className="row gap-2">
          <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
          <p className="t-xs c-3" style={{ lineHeight: 1.55 }}>
            Deleted. Nothing about this visit is left on this device or on our side. The numbers
            on this page are still on screen and will disappear when you close it.
          </p>
        </div>
      </div>
    );
  }

  if (state === "partial") {
    return (
      <div className="card p-3">
        <p className="t-xs c-3" style={{ lineHeight: 1.55 }}>
          Cleared from this device. Nothing was stored on our side to remove — or the request did
          not reach us, in which case the retention schedule below removes it on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-3" style={{ background: "var(--paper)" }}>
      <div className="between wrap gap-2">
        <p className="t-xs c-3" style={{ lineHeight: 1.55, maxWidth: 360 }}>
          Changed your mind? Remove everything now rather than waiting for the schedule.
        </p>
        <button className="btn btn-g btn-sm" onClick={forget} disabled={state === "working"}>
          <Ico.x size={12} />{state === "working" ? "Deleting…" : "Delete all of it"}
        </button>
      </div>
    </div>
  );
}


/**
 * The rate, with its date.
 *
 * Every monthly figure on this page depends on it and it is the only
 * assumption here that moves weekly. Shown beside the figures rather than in a
 * footnote, and stated as stale when it is — a rate that is quietly four
 * months old produces arithmetic that is correct and an answer that is wrong,
 * which is the one failure this product is built to prevent.
 */
function RateNote({ rate }: { rate: RateAssumption }) {
  const tone = rate.freshness === "fresh" ? "chip-pos" : rate.freshness === "ageing" ? "chip" : "chip-warn";
  return (
    <div className="card p-4" style={{ marginTop: 12 }}>
      <div className="between wrap gap-2">
        <div className="row gap-2">
          <Ico.chart size={14} className="c-3" />
          <span className="t-sm w6">Interest rate used: {rate.pct.toFixed(2)}%</span>
        </div>
        <span className={`chip ${tone}`}>
          {rate.freshness === "fresh" ? "Current" : rate.freshness === "ageing" ? "Ageing" : "Not recent"}
        </span>
      </div>
      <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>
        {rate.asOf ? `${rate.source}, as of ${rate.asOf}. ` : `${rate.source}. `}{rate.note}
      </p>
    </div>
  );
}
