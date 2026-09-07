"use client";

import { useState } from "react";
import Link from "next/link";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";

type Kind = "offer" | "deadline" | "reply" | "approve" | "lead" | "blocked" | "failed";

const KIND: Record<Kind, { label: string; tone: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  offer:    { label: "Offer",     tone: "chip-acc",  icon: Ico.scale },
  deadline: { label: "Deadline",  tone: "chip-neg",  icon: Ico.clock },
  reply:    { label: "Reply",     tone: "chip-warn", icon: Ico.mail },
  approve:  { label: "Approve",   tone: "chip",      icon: Ico.check },
  lead:     { label: "New",       tone: "chip-pos",  icon: Ico.spark },
  blocked:  { label: "Blocked",   tone: "chip-warn", icon: Ico.pause },
  failed:   { label: "Failed",    tone: "chip-neg",  icon: Ico.alert },
};

interface Item {
  id: string; kind: Kind; who: string; av: string; color: string;
  title: string; meta: string; age: string; href?: string;
}

const ITEMS: Item[] = [
  { id: "1", kind: "offer", who: "Okafor", av: "NO", color: "#8a4a2e", title: "Two offers on 1841 Ferncliff need a decision", meta: "Neither released to the seller · deadline tomorrow 5:00pm", age: "3h", href: "/prototype/studio/offers" },
  { id: "2", kind: "deadline", who: "Vance", av: "HV", color: "#3f6f5f", title: "Assessment appeal window closes in 19 days", meta: "Est. $1,100–$1,800/yr · no decision recorded", age: "2d" },
  { id: "3", kind: "approve", who: "Ellison", av: "ME", color: "#2f5480", title: "Meeting recap ready — 11 plan changes", meta: "From Tuesday's planning session", age: "1d" },
  { id: "4", kind: "deadline", who: "Ellison", av: "ME", color: "#2f5480", title: "Buyer agency agreement prepared, not sent", meta: "Journey blocked at Ready to shop until signed", age: "2d" },
  { id: "5", kind: "lead", who: "Pike", av: "JP", color: "#6b4a7a", title: "New referral from Priya Raman", meta: "Started the assessment, stopped at question 9", age: "22m", href: "/prototype/studio/queue" },
  { id: "9", kind: "approve", who: "Ellison", av: "ME", color: "#2f5480", title: "Maya asked you to check her cash-to-close figure", meta: "Waiting 19h of the 24h you promise · 3 in the review queue", age: "19h", href: "/prototype/studio/queue" },
  { id: "10", kind: "reply", who: "Reyes", av: "TR", color: "#4a6b7a", title: "4 follow-up touches are due today", meta: "2 go out on their own · 2 need you", age: "now", href: "/prototype/studio/queue" },
  { id: "6", kind: "reply", who: "Vance", av: "HV", color: "#3f6f5f", title: "Ruth asked if the painter quote is reasonable", meta: "$2,400 for main living areas", age: "16h" },
  { id: "7", kind: "blocked", who: "Ellison", av: "ME", color: "#2f5480", title: "Brookhaven Lending hasn't replied", meta: "Georgia Dream eligibility requested 3 Sep", age: "3d" },
  { id: "8", kind: "failed", who: "Raman", av: "PR", color: "#7a5c2e", title: "Artist gift email bounced", meta: "Vendor mailbox rejected · fallback task created", age: "6h" },
];

const DONE = [
  { t: "Corrected Tomás Beltrán's cash gap after Gwinnett funding closed", m: "and told him why", age: "4h" },
  { t: "Prepared Maya's lender question sheet", m: "shared with Brookhaven on her instruction", age: "1d" },
  { t: "Suppressed 1 stale assistance program from matching", m: "Legacy county pilot · 157 days unverified", age: "6h" },
];

const SCHEDULE = [
  { t: "9:30", w: "Maya + Devon Ellison", d: "Planning session", tone: "var(--accent)" },
  { t: "11:00", w: "1841 Ferncliff", d: "Photography", tone: "var(--ink-5)" },
  { t: "2:00", w: "Harold & Ruth Vance", d: "Repair walkthrough", tone: "var(--ink-5)" },
  { t: "5:00", w: "1841 Ferncliff", d: "Offer deadline", tone: "var(--neg)" },
];

export default function Today() {
  const [done, setDone] = useState<string[]>([]);
  const open = ITEMS.filter((i) => !done.includes(i.id));

  return (
    <>
      <StudioHead
        title="Today"
        sub="Saturday, 6 September"
        actions={
          <>
            <button className="btn btn-s btn-sm"><Ico.filter size={14} />Filter</button>
            <button className="btn btn-p btn-sm"><Ico.plus size={14} />New client</button>
          </>
        }
      />
      <StudioBody>
        <div className="split">
          <div>
            {/* counters */}
            <div className="row gap-4" style={{ marginBottom: 20 }}>
              {[
                ["Needs you", `${open.length}`, null],
                ["Rift handled", "3", "overnight"],
                ["Active", "6", "clients"],
                ["This month", "$31", "of $48 budget"],
              ].map(([l, v, n]) => (
                <div key={l as string} style={{ paddingRight: 22, borderRight: "1px solid var(--line-2)" }}>
                  <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                  <div className="row gap-1" style={{ alignItems: "baseline", marginTop: 4 }}>
                    <span className="num" style={{ fontSize: 22 }}>{v}</span>
                    {n ? <span className="t-xs c-4">{n}</span> : null}
                  </div>
                </div>
              ))}
            </div>

            {/* queue */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-sm w6">Attention queue</span>
                {done.length ? (
                  <button className="btn btn-g btn-sm" onClick={() => setDone([])}><Ico.refresh size={13} />Reset</button>
                ) : <span className="t-xs c-4">Ranked by consequence</span>}
              </div>

              {open.length === 0 ? (
                <div className="center" style={{ padding: "56px 24px" }}>
                  <Ico.checkCircle size={26} className="c-pos" />
                  <p className="t-lg w55" style={{ marginTop: 12 }}>Queue clear</p>
                  <p className="t-sm c-4" style={{ marginTop: 4 }}>Nothing is waiting on you.</p>
                </div>
              ) : open.map((i) => {
                const k = KIND[i.kind];
                return (
                  <div key={i.id} className="between" style={{
                    padding: "13px 16px", borderBottom: "1px solid var(--line-3)", gap: 14,
                  }}>
                    <div className="row-t gap-3 grow" style={{ minWidth: 0 }}>
                      <div className="av av-sm" style={{ background: i.color, marginTop: 1 }}>{i.av}</div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="row gap-2" style={{ marginBottom: 3 }}>
                          <span className={`chip ${k.tone}`}><k.icon size={11} />{k.label}</span>
                          <span className="t-xs c-4">{i.who}</span>
                        </div>
                        <div className="t-md w55" style={{ lineHeight: 1.4 }}>{i.title}</div>
                        <div className="t-xs c-4" style={{ marginTop: 3 }}>{i.meta}</div>
                      </div>
                    </div>
                    <div className="row gap-2" style={{ flex: "none" }}>
                      <span className="t-xs c-4 num">{i.age}</span>
                      {i.href ? (
                        <Link href={i.href} className="btn btn-s btn-sm">Open</Link>
                      ) : (
                        <button className="btn btn-s btn-sm">Open</button>
                      )}
                      <button className="btn btn-g btn-ico" style={{ width: 28, height: 28 }}
                        onClick={() => setDone((d) => [...d, i.id])} aria-label="Mark handled">
                        <Ico.check size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* right rail */}
          <div className="col gap-3">
            <div className="card">
              <div className="t-sm w6" style={{ padding: "12px 14px 8px" }}>Schedule</div>
              {SCHEDULE.map((s) => (
                <div key={s.t} className="row-t gap-3" style={{ padding: "9px 14px", borderTop: "1px solid var(--line-3)" }}>
                  <span className="num t-xs c-4" style={{ width: 34, flex: "none", paddingTop: 1 }}>{s.t}</span>
                  <span style={{ width: 2, alignSelf: "stretch", background: s.tone, borderRadius: 2, flex: "none" }} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="t-sm w55 trunc">{s.w}</div>
                    <div className="t-xs c-4">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="between" style={{ padding: "12px 14px 8px" }}>
                <span className="t-sm w6">Rift handled</span>
                <span className="chip chip-pos"><Ico.check size={10} />3</span>
              </div>
              {DONE.map((d) => (
                <div key={d.t} style={{ padding: "10px 14px", borderTop: "1px solid var(--line-3)" }}>
                  <div className="t-sm" style={{ lineHeight: 1.45 }}>{d.t}</div>
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>{d.m} · {d.age}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="row gap-2" style={{ marginBottom: 8 }}>
                <Ico.shield size={14} className="c-4" />
                <span className="t-sm w6">Registry</span>
              </div>
              <div className="between" style={{ marginBottom: 6 }}>
                <span className="t-xs c-3">7 of 8 verified</span>
                <span className="t-xs c-warn w55">1 suppressed</span>
              </div>
              <div className="meter"><i style={{ width: "87.5%" }} /></div>
            </div>
          </div>
        </div>
      </StudioBody>
    </>
  );
}
