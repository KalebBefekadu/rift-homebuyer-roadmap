"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "./icons";
import { Track } from "./Track";
import type { Readout, Status, Tension } from "@/lib/core/results";
import { EMAIL_NOTE, RETENTION, forgetMe, heldLocally } from "@/lib/prototype/privacy";
import { track } from "@/lib/prototype/telemetry";
import { Trust, TrustLadder } from "./Trust";

/**
 * The readout is a document, not a marketing page. It carries the product
 * identity and a way back, and deliberately not the landing page's nav — the
 * "Get my numbers" call to action is nonsense to someone who is holding them.
 */
export function ReadoutShell({ v, children, ask }: {
  v: "buy" | "sell";
  children: React.ReactNode;
  /** The headline figure, so the ladder can offer to have it checked. */
  ask?: { what: string; claim: string };
}) {
  return (
    <div className={v} style={{ minHeight: "100vh" }}>
      <Track />
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href={`/prototype/${v}`} className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">Your readout</span>
          </Link>
          <div className="row gap-1">
            <Link href={`/prototype/${v}/start`} className="btn btn-g btn-sm hide-sm">
              <Ico.refresh size={13} />Change my answers
            </Link>
            <Link href="/prototype/app" className="btn btn-g btn-sm">Sign in</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 40 }}>
        <div className="shell-w" style={{ padding: "26px 0 60px" }}>
          <div className="split-w" style={{ marginBottom: 24 }}>
            <TrustLadder at="preliminary" ask={ask} />
            <PrivacyPanel />
          </div>
          <p className="t-xs c-4" style={{ lineHeight: 1.6, maxWidth: 620 }}>
            Prepared by Rift, guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Every figure
            here is a planning estimate, not a lending commitment, approval, or valuation. Nothing
            on this page requires you to work with us, and none of it stops working if you don&apos;t.
          </p>
          <div className="row gap-3 wrap" style={{ marginTop: 14 }}>
            <Link href={`/prototype/${v}`} className="t-xs c-3">Back to Rift for {v === "buy" ? "buyers" : "sellers"}</Link>
            <Link href="/prototype/kaleb" className="t-xs c-3">About Kaleb</Link>
            <Link href={`/prototype/${v === "buy" ? "sell" : "buy"}`} className="t-xs c-3">
              {v === "buy" ? "Selling instead?" : "Buying instead?"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const TONE: Record<Status, string> = {
  ready: "chip-pos", close: "chip-brand", building: "chip-warn", exploring: "chip",
};

/** Numbered section. The number matters — it tells someone how far they are through. */
export function Sec({ n, title, sub, children, id }: {
  n: number; title: string; sub?: string; id?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="sec" style={{ scrollMarginTop: 80 }}>
      <div className="row gap-3" style={{ alignItems: "baseline", marginBottom: 18 }}>
        <span className="num t-sm c-4" style={{ minWidth: 22 }}>{String(n).padStart(2, "0")}</span>
        <div>
          <h2 className="serif" style={{ fontSize: "clamp(21px,2.4vw,29px)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>{title}</h2>
          {sub ? <p className="t-sm c-4" style={{ marginTop: 4 }}>{sub}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** The verdict block. One sentence, then the four numbers a skimmer needs. */
export function Verdict({ r, glance, used }: {
  r: Readout; glance: { label: string; value: string; note?: string }[]; used: string;
}) {
  return (
    <section className="shell-w" style={{ paddingTop: "clamp(28px,4vw,52px)" }}>
      <div className="row gap-2 wrap">
        <span className={`chip ${TONE[r.status]}`}>{r.statusLabel}</span>
        <Trust state="preliminary" />
        <span className="t-xs c-4">Prepared {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })} from your answers</span>
      </div>
      <h1 className="serif" style={{
        fontSize: "clamp(25px,3.6vw,44px)", lineHeight: 1.12, letterSpacing: "-0.025em",
        marginTop: 16, maxWidth: 820,
      }}>
        {r.verdict}
      </h1>
      {r.rider ? <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>{r.rider}</p> : null}
      <p className="t-xs c-4" style={{ marginTop: 16 }}>{used}</p>

      {r.tension ? <TensionNote t={r.tension} /> : null}

      <div className="card glance" style={{ marginTop: 26, overflow: "hidden" }}>
        {glance.map((g) => (
          <div key={g.label} style={{ padding: "16px 18px" }}>
            <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{g.label}</div>
            <div className="num" style={{ fontSize: "clamp(17px,2vw,24px)", marginTop: 5 }}>{g.value}</div>
            {g.note ? <div className="t-xs c-4" style={{ marginTop: 2 }}>{g.note}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Their stated timeline, put next to their computed one.
 *
 * It sits directly under the verdict rather than in a section further down,
 * because a person who said "in the next 3 months" and is 27 months out will
 * decide whether to keep reading in the first screen. Burying the collision
 * below the fold is the same as not showing it.
 *
 * Deliberately not styled as an error. Being further out than you hoped is the
 * normal case, not a failure, and a red panel would make an honest number feel
 * like a rejection.
 */
function TensionNote({ t }: { t: Tension }) {
  const behind = t.kind === "behind";
  return (
    <div className="card" style={{
      marginTop: 20, padding: "14px 16px", maxWidth: 680,
      background: "var(--sunk)",
      borderLeft: `3px solid ${behind ? "var(--warn, #b8791f)" : "var(--pos, #2f7a52)"}`,
    }}>
      <div className="row gap-2" style={{ alignItems: "flex-start" }}>
        {behind
          ? <Ico.scale size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
          : <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 3 }} />}
        <div>
          <p className="t-sm w6" style={{ lineHeight: 1.5 }}>{t.headline}</p>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{t.body}</p>
        </div>
      </div>
    </div>
  );
}

/** The number that changes how they think, stated against the number they were given. */
export function Reframe({ r }: { r: Readout }) {
  return (
    <div className="ans">
      <div className="ans-out">
        <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>The figure that actually matters</div>
        <div className="ans-num" style={{ marginTop: 8 }}>{r.reframe.headline.split(",")[0]}</div>
        <p style={{ marginTop: 16, color: "rgba(255,255,255,.75)", fontSize: 15.5, lineHeight: 1.65, maxWidth: 620 }}>
          {r.reframe.body}
        </p>
      </div>
    </div>
  );
}

export function BlockerCard({ r, onAsk }: { r: Readout; onAsk?: () => void }) {
  return (
    <div className="card p-5" style={{ borderColor: "var(--accent-line)", background: "var(--accent-wash)" }}>
      <div className="row gap-2">
        <Ico.alert size={17} className="c-acc" />
        <span className="kicker c-acc" style={{ margin: 0 }}>The one thing in your way</span>
      </div>
      <h3 className="t-xl w6" style={{ marginTop: 10 }}>{r.blocker.title}</h3>
      <p className="t-md c-2" style={{ marginTop: 10, maxWidth: 640, lineHeight: 1.65 }}>{r.blocker.body}</p>
      <div className="row gap-3 wrap" style={{ marginTop: 16 }}>
        <span className="chip"><Ico.users size={12} />Resolved by: {r.blocker.who}</span>
        {onAsk ? <button className="btn btn-a btn-sm" onClick={onAsk}>Ask Kaleb about this <Ico.arrowR size={14} /></button> : null}
      </div>
    </div>
  );
}

export function Steps({ r }: { r: Readout }) {
  const groups = Array.from(new Set(r.steps.map((s) => s.when)));
  return (
    <div className="col gap-3">
      {groups.map((w) => (
        <div key={w} className="card" style={{ overflow: "hidden" }}>
          <div className="between" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line-2)" }}>
            <span className="t-sm w6">{w}</span>
          </div>
          {r.steps.filter((s) => s.when === w).map((s) => (
            <div key={s.label} className="row gap-3" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start" }}>
              <span style={{ width: 15, height: 15, borderRadius: 5, flex: "none", marginTop: 3, border: "1.5px solid var(--ink-5)" }} />
              <div className="grow">
                <div className="t-md w55">{s.label}</div>
                <div className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>{s.detail}</div>
              </div>
              <span className="chip" style={{ flex: "none" }}>{s.owner}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The takeaway artifact. It has to be liftable — that is the whole point of it. */
export function Questions({ r, who }: { r: Readout; who: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(r.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="between wrap gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-2)" }}>
        <span className="t-sm w6">{r.questions.length} questions, written for your answers</span>
        <div className="row gap-1">
          <button className="btn btn-s btn-sm" onClick={copy}>
            {copied ? <><Ico.check size={13} />Copied</> : <><Ico.doc size={13} />Copy all</>}
          </button>
          <button className="btn btn-s btn-sm" onClick={() => window.print()}><Ico.share size={13} />Print</button>
        </div>
      </div>
      <ol style={{ listStyle: "none" }}>
        {r.questions.map((q, i) => (
          <li key={q} className="row gap-3" style={{ padding: "12px 18px", borderBottom: i === r.questions.length - 1 ? undefined : "1px solid var(--line-3)", alignItems: "flex-start" }}>
            <span className="num t-xs c-4" style={{ minWidth: 16, marginTop: 2 }}>{i + 1}</span>
            <span className="t-md" style={{ lineHeight: 1.55 }}>{q}</span>
          </li>
        ))}
      </ol>
      <p className="t-xs c-4" style={{ padding: "12px 18px", background: "var(--sunk)", lineHeight: 1.6 }}>
        Take these to anyone — including a lender {who} has never met. Nothing here asks
        them to work with us, and none of it stops working if you never speak to us again.
      </p>
    </div>
  );
}

/** Three rungs, because different people convert at different heights. */
export function Ladder({ v, coBuyer, bookHref, onKeep, onShare }: {
  v: "buy" | "sell"; coBuyer: string; bookHref: string; onKeep: () => void; onShare: () => void;
}) {
  const rungs = [
    {
      icon: Ico.mail, title: "Send this to me",
      body: "One email field. You get a link that stays live, and a message if a program you matched changes or runs out of funding.",
      cta: "Email me the readout", on: onKeep, kind: "s" as const,
    },
    coBuyer && coBuyer !== "none" ? {
      icon: Ico.users, title: `Send it to ${coBuyer}`,
      body: `${coBuyer} did not answer these questions, which usually means they are the one who slows the decision down. This sends them the same document, not a pitch.`,
      cta: `Share with ${coBuyer}`, on: onShare, kind: "s" as const,
    } : null,
    {
      icon: Ico.cal, title: "Fifteen minutes with Kaleb",
      body: v === "buy"
        ? "Not a sales call and not a lender referral. Fifteen minutes on the one thing above, and you keep everything on this page either way."
        : "Fifteen minutes on your numbers and your timing. No listing presentation, no valuation pitch, and nothing to sign.",
      cta: "See open times", href: bookHref, kind: "brand" as const,
    },
  ].filter(Boolean) as { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string; cta: string; on?: () => void; href?: string; kind: "s" | "brand" }[];

  return (
    <div className="g3 gap-3">
      {rungs.map((r) => {
        const I = r.icon;
        return (
          <div key={r.title} className="card p-5 col" style={{ justifyContent: "space-between" }}>
            <div>
              <I size={18} className="c-brand" />
              <div className="t-lg w6" style={{ marginTop: 12 }}>{r.title}</div>
              <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6 }}>{r.body}</p>
            </div>
            {r.href ? (
              <>
                <div className="tint p-3" style={{ marginTop: 14 }}>
                  <p className="t-xs c-2" style={{ lineHeight: 1.55, fontStyle: "italic" }}>
                    &ldquo;He told me not to buy the first house I loved. He was right, and it cost
                    him a commission that month.&rdquo;
                  </p>
                  <div className="t-2xs c-4" style={{ marginTop: 6 }}>Priya R. · DeKalb</div>
                </div>
                <Link href={r.href} className={`btn btn-${r.kind}`} style={{ marginTop: 12, width: "100%" }}>{r.cta}</Link>
              </>
            ) : (
              <button className={`btn btn-${r.kind}`} style={{ marginTop: 18, width: "100%" }} onClick={r.on}>{r.cta}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Always-present conversion surface. Nothing is gated behind it. */
export function ActionBar({ onKeep, saved, bookHref }: { onKeep: () => void; saved: boolean; bookHref: string }) {
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 30, marginTop: 40,
      background: "rgba(251,250,248,.9)", backdropFilter: "blur(14px)",
      borderTop: "1px solid var(--line-2)",
    }}>
      <div className="shell-w between wrap gap-3 actionbar" style={{ padding: "11px 0" }}>
        <div className="row gap-2">
          <Ico.checkCircle size={15} className="c-pos" />
          <span className="t-sm c-2">
            {saved ? "Saved. We'll tell you if anything here changes." : "This is yours already — nothing on this page is held back."}
          </span>
        </div>
        <div className="row gap-2">
          {!saved ? <button className="btn btn-s btn-sm" onClick={onKeep}><Ico.mail size={14} />Email it to me</button> : null}
          <Link href={bookHref} className="btn btn-brand btn-sm"><Ico.cal size={14} />15 min with Kaleb</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * What we keep, for how long, and a way out. Stated where the data was actually
 * given rather than behind a policy link, because a retention promise nobody
 * reads is not a promise.
 */
export function PrivacyPanel() {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const held = typeof window !== "undefined" ? heldLocally().filter((h) => h.present) : [];

  if (gone) return (
    <div className="card p-4 fade-in" style={{ borderColor: "var(--pos-line)", background: "var(--pos-wash)" }}>
      <div className="row gap-2">
        <Ico.checkCircle size={15} className="c-pos" />
        <span className="t-sm w55">Deleted. Nothing about this visit is left on this device.</span>
      </div>
    </div>
  );

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button className="between" style={{ width: "100%", padding: "13px 16px", background: "transparent", border: 0, textAlign: "left" }}
        onClick={() => setOpen(!open)}>
        <div className="row gap-2">
          <Ico.lock size={14} className="c-3" />
          <span className="t-sm w55">What we keep, and for how long</span>
        </div>
        <Ico.chevD size={14} className="c-4" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open ? (
        <div style={{ padding: "0 16px 16px" }}>
          <div className="col gap-2">
            {RETENTION.map((r) => (
              <div key={r.id} className="card p-3">
                <div className="between wrap gap-2">
                  <span className="t-sm w55 grow" style={{ minWidth: 200 }}>{r.what}</span>
                  <span className="chip">{r.keptFor}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>{r.why}</p>
                <p className="t-xs c-4" style={{ marginTop: 4 }}>Then: {r.thenWhat}</p>
              </div>
            ))}
          </div>
          <div className="hr" style={{ margin: "14px 0" }} />
          <div className="between wrap gap-3">
            <div>
              <div className="t-sm w55">On this device right now</div>
              <div className="t-xs c-4" style={{ marginTop: 3 }}>
                {held.length ? held.map((h) => h.label).join(" · ") : "Nothing"}
              </div>
            </div>
            <button className="btn btn-s btn-sm" disabled={!held.length}
              onClick={() => { track({ name: "data_deleted", side: "none" }); forgetMe(); setGone(true); }}>
              <Ico.x size={13} />Delete all of it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Capture. Email only, after the value, and it buys durability — not access. */
export function Keep({ v, onDone, onClose, coBuyer }: {
  v: "buy" | "sell"; onDone: () => void; onClose: () => void; coBuyer?: string;
}) {
  const [also, setAlso] = useState(false);
  return (
    <div className="cmdk-veil" style={{ alignItems: "center" }} onMouseDown={onClose}>
      <div className={`card fade-in ${v}`} style={{ maxWidth: 430, width: "100%", padding: 28 }} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="serif" style={{ fontSize: 27, letterSpacing: "-0.022em", lineHeight: 1.15 }}>
          Where should we send it?
        </h2>
        <p className="t-sm c-2" style={{ marginTop: 10, lineHeight: 1.6 }}>
          You already have everything on this page. An email address gets you a link that stays
          live, and a note if {v === "buy" ? "a program you matched changes or runs out of money" : "your county opens an appeal window"}.
        </p>
        <label className="field" style={{ marginTop: 18 }}>
          <input className="input input-lg" placeholder="you@example.com" autoFocus />
        </label>
        {coBuyer && coBuyer !== "none" ? (
          <label className="opt" data-on={also} style={{ marginTop: 10 }}>
            <input type="checkbox" checked={also} onChange={() => setAlso(!also)} />
            <span className="t-sm">Send a copy to {coBuyer} too</span>
          </label>
        ) : null}
        <button className="btn btn-brand btn-lg" style={{ width: "100%", marginTop: 16 }} onClick={onDone}>
          Send it
        </button>
        <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.55 }}>
          {EMAIL_NOTE} No password, no phone number, and no call unless you ask for one.
        </p>
      </div>
    </div>
  );
}
