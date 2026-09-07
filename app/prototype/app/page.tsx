"use client";

import Link from "next/link";
import { money } from "@/lib/prototype/compute";
import { Ico } from "@/components/rift/icons";
import { MOMENTS } from "@/lib/prototype/referral";

const STAGES = ["Exploring", "Building readiness", "Financing", "Ready to shop", "Searching", "Offer", "Under contract", "Closing"];
const AT = 1;

type Owner = "you" | "kaleb" | "rift" | "pro";
const OWNER: Record<Owner, { l: string; c: string }> = {
  you: { l: "You", c: "#2f5480" }, kaleb: { l: "Kaleb", c: "#e8442a" },
  rift: { l: "Rift", c: "#157a5b" }, pro: { l: "Brookhaven", c: "#6a6f79" },
};

const TASKS: { t: string; o: Owner; due?: string; state: "now" | "wait" | "late" | "done" | "next"; note?: string }[] = [
  { t: "Open a dedicated savings account", o: "you", due: "Thu", state: "now", note: "Keeps your emergency fund separate" },
  { t: "Confirm Georgia Dream eligibility", o: "pro", due: "15 Sep", state: "wait", note: "Requested 3 Sep, no reply yet" },
  { t: "Send the buyer agency agreement", o: "kaleb", due: "4 Sep", state: "late" },
  { t: "Watching DeKalb assistance funding", o: "rift", state: "now" },
  { t: "Complete homebuyer education", o: "you", due: "20 Oct", state: "next", note: "Required by two of your programs" },
  { t: "Gather two months of pay stubs", o: "you", due: "1 Oct", state: "next" },
  { t: "Readiness assessment", o: "you", state: "done" },
  { t: "Review and publish your plan", o: "kaleb", state: "done" },
];

const STATE: Record<string, { l: string; c: string }> = {
  now: { l: "Now", c: "chip-ink" }, wait: { l: "Waiting", c: "chip-warn" },
  late: { l: "Overdue", c: "chip-neg" }, next: { l: "Upcoming", c: "chip" }, done: { l: "Done", c: "chip-pos" },
};

export default function ClientHome() {
  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 22 }}>
        <div>
          <p className="t-sm c-4">Good morning, Maya</p>
          <h1 className="serif d3" style={{ marginTop: 4 }}>You&apos;re 11 months out.</h1>
        </div>
        <Link href="/prototype/app/plan" className="btn btn-s">View full plan <Ico.arrowR size={15} /></Link>
      </div>

      {/* active decision — surfaced only when there is one */}
      <Link href="/prototype/app/decisions" className="card lift" style={{
        display: "block", padding: 18, marginBottom: 16,
        borderColor: "var(--accent-line)", background: "var(--accent-wash)",
      }}>
        <div className="between wrap gap-3">
          <div className="row-t gap-3">
            <Ico.scale size={17} className="c-acc" style={{ marginTop: 2, flex: "none" }} />
            <div>
              <div className="t-md w6 c-acc">Kaleb prepared a decision for you</div>
              <div className="t-sm c-2" style={{ marginTop: 2 }}>
                Which price to actually target — three options, costed out.
              </div>
            </div>
          </div>
          <span className="btn btn-a btn-sm">Open <Ico.arrowR size={14} /></span>
        </div>
      </Link>

      {/* The referral moment for where Maya actually is. Her plan was just
          published, so the correct ask is sharing — not a name, and not a
          review she has nothing to review yet. */}
      <div className="card p-4" style={{ marginBottom: 16 }}>
        <div className="between wrap gap-3">
          <div className="row-t gap-3">
            <Ico.gift size={16} className="c-3" style={{ marginTop: 2, flex: "none" }} />
            <div>
              <div className="t-md w6">{MOMENTS.find((m) => m.id === "plan_published")!.ask}</div>
              <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.55, maxWidth: 520 }}>
                Devon and anyone helping with the gift can see the parts they need — the cash
                figure and what a gift letter requires — and none of your income or savings.
              </p>
            </div>
          </div>
          <Link href="/prototype/app/share" className="btn btn-s btn-sm" style={{ flex: "none" }}>
            Choose who <Ico.arrowR size={13} />
          </Link>
        </div>
      </div>

      {/* stage rail */}
      <div className="card p-4" style={{ marginBottom: 16 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <span className="t-sm w6">Building readiness</span>
          <span className="t-xs c-4">Stage {AT + 1} of {STAGES.length}</span>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {STAGES.map((s, i) => (
            <div key={s} className="grow" title={s}>
              <div style={{
                height: 3, borderRadius: 2,
                background: i < AT ? "var(--pos)" : i === AT ? "var(--ink)" : "var(--line-2)",
              }} />
              <div className="t-2xs trunc" style={{ marginTop: 6, color: i <= AT ? "var(--ink-3)" : "var(--ink-5)" }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* next + numbers */}
      <div className="split-w" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 20, borderColor: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--ink)" }}>
          <div className="kicker">Do this next</div>
          <h2 className="t-xl w6" style={{ marginTop: 9 }}>Open a dedicated savings account for closing funds</h2>
          <p className="t-sm c-3" style={{ marginTop: 7 }}>
            So your emergency fund stays untouched, the way you asked.
          </p>
          <div className="row gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-p">Mark done</button>
            <button className="btn btn-g">Remind me Thursday</button>
          </div>
        </div>

        <div className="card p-4">
          <div className="between" style={{ marginBottom: 14 }}>
            <span className="t-sm w6">Your gap</span>
            <span className="chip"><Ico.check size={10} />Reviewed 2 Sep</span>
          </div>
          <div className="num" style={{ fontSize: 34, letterSpacing: "-0.03em" }}>{money(20_400)}</div>
          <div className="meter" style={{ marginTop: 12 }}><i className="pos" style={{ width: "35%" }} /></div>
          <div className="between" style={{ marginTop: 7 }}>
            <span className="t-xs c-4">{money(10_790)} covered</span>
            <span className="t-xs c-4">{money(31_190)} needed</span>
          </div>
          <Link href="/prototype/app/money" className="btn btn-g btn-sm" style={{ marginTop: 12, paddingLeft: 0 }}>
            See the breakdown <Ico.chevR size={13} />
          </Link>
        </div>
      </div>

      {/* tasks */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
          <span className="t-sm w6">Your plan</span>
          <span className="t-xs c-4">6 open · 2 done</span>
        </div>
        {TASKS.map((t) => {
          const o = OWNER[t.o]; const s = STATE[t.state];
          return (
            <div key={t.t} className="between" style={{
              padding: "12px 16px", borderBottom: "1px solid var(--line-3)", gap: 12,
              opacity: t.state === "done" ? 0.5 : 1,
            }}>
              <div className="row-t gap-3 grow" style={{ minWidth: 0 }}>
                <div className="av av-sm" style={{ background: o.c, marginTop: 1 }}>{o.l[0]}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-md w5" style={{ textDecoration: t.state === "done" ? "line-through" : undefined }}>{t.t}</div>
                  {t.note ? <div className="t-xs c-4" style={{ marginTop: 2 }}>{t.note}</div> : null}
                </div>
              </div>
              <div className="row gap-2" style={{ flex: "none" }}>
                <span className="t-xs c-4">{o.l}</span>
                {t.due ? <span className="t-xs c-4 num">{t.due}</span> : null}
                <span className={`chip ${s.c}`}>{s.l}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* updates */}
      <div className="g2 gap-3">
        <div className="card p-4">
          <div className="between" style={{ marginBottom: 12 }}>
            <span className="t-sm w6">What changed</span>
            <span className="t-xs c-4">2 this month</span>
          </div>
          {[
            { h: "A DeKalb program reopened funding", m: `Your gap dropped by about ${money(7_500)}.`, d: "6 Sep", tone: "var(--pos)" },
            { h: "Rates moved", m: "Monthly estimate went from $2,412 to $2,357.", d: "19 Aug", tone: "var(--ink-5)" },
          ].map((u) => (
            <div key={u.h} className="row-t gap-3" style={{ padding: "10px 0", borderTop: "1px solid var(--line-3)" }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: u.tone, marginTop: 6, flex: "none" }} />
              <div className="grow">
                <div className="t-sm w55">{u.h}</div>
                <div className="t-xs c-4" style={{ marginTop: 2 }}>{u.m}</div>
              </div>
              <span className="t-xs c-4" style={{ flex: "none" }}>{u.d}</span>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="t-sm w6" style={{ marginBottom: 12 }}>Household</div>
          <div className="row gap-3" style={{ padding: "8px 0" }}>
            <div className="av" style={{ background: "#2f5480" }}>ME</div>
            <div className="grow"><div className="t-sm w55">Maya Ellison</div><div className="t-xs c-4">You</div></div>
          </div>
          <div className="row gap-3" style={{ padding: "8px 0", borderTop: "1px solid var(--line-3)" }}>
            <div className="av" style={{ background: "var(--line)", color: "var(--ink-4)" }}>DE</div>
            <div className="grow"><div className="t-sm w55">Devon Ellison</div><div className="t-xs c-4">Invited 2 Sep</div></div>
            <button className="btn btn-s btn-sm">Resend</button>
          </div>
          <div className="row gap-3" style={{ padding: "8px 0", borderTop: "1px solid var(--line-3)" }}>
            <div className="av" style={{ background: "var(--accent)" }}>K</div>
            <div className="grow"><div className="t-sm w55">Kaleb Befekadu</div><div className="t-xs c-4">Your agent</div></div>
            <button className="btn btn-s btn-sm"><Ico.mail size={13} />Message</button>
          </div>
        </div>
      </div>
    </>
  );
}
