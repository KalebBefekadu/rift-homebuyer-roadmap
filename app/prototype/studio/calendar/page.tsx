"use client";

import { useState } from "react";
import Link from "next/link";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";

const DAYS = ["Sat 6", "Sun 7", "Mon 8", "Tue 9", "Wed 10", "Thu 11", "Fri 12"];
type Ev = { d: number; t: string; dur: string; title: string; who: string; kind: "meet" | "deadline" | "vendor" };

const EVENTS: Ev[] = [
  { d: 0, t: "9:30", dur: "45m", title: "Planning session", who: "Maya + Devon Ellison", kind: "meet" },
  { d: 0, t: "11:00", dur: "1h", title: "Photography", who: "1841 Ferncliff", kind: "vendor" },
  { d: 0, t: "14:00", dur: "45m", title: "Repair walkthrough", who: "Harold & Ruth Vance", kind: "meet" },
  { d: 1, t: "17:00", dur: "", title: "Offer deadline", who: "1841 Ferncliff", kind: "deadline" },
  { d: 2, t: "10:00", dur: "30m", title: "Lender call", who: "Brookhaven Lending", kind: "meet" },
  { d: 3, t: "9:00", dur: "", title: "Earnest money due", who: "Okafor purchase", kind: "deadline" },
  { d: 3, t: "13:00", dur: "1h", title: "Listing consultation", who: "Jordan Pike", kind: "meet" },
  { d: 5, t: "11:00", dur: "", title: "Savings account confirmation", who: "Maya Ellison", kind: "deadline" },
  { d: 5, t: "15:00", dur: "30m", title: "Painter quote review", who: "Vance property", kind: "vendor" },
];

const KIND = {
  meet: { bg: "var(--accent-wash)", bd: "var(--accent-line)", c: "var(--accent-2)" },
  deadline: { bg: "var(--neg-wash)", bd: "#f2d3d0", c: "var(--neg)" },
  vendor: { bg: "var(--sunk)", bd: "var(--line)", c: "var(--ink-2)" },
};

export default function Calendar() {
  const [sel, setSel] = useState(0);
  const dayEvents = EVENTS.filter((e) => e.d === sel);

  return (
    <>
      <StudioHead
        title="Calendar"
        sub="Week of 6 September"
        actions={
          <>
            <div className="row gap-1">
              <button className="btn btn-s btn-ico"><Ico.chevL size={15} /></button>
              <button className="btn btn-s btn-sm">Today</button>
              <button className="btn btn-s btn-ico"><Ico.chevR size={15} /></button>
            </div>
            <button className="btn btn-p btn-sm"><Ico.plus size={14} />Event</button>
          </>
        }
      />
      <StudioBody>
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div className="scroll-x">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(122px,1fr))", minWidth: 760 }}>
              {DAYS.map((d, i) => {
                const evs = EVENTS.filter((e) => e.d === i);
                return (
                  <button key={d} onClick={() => setSel(i)} style={{
                    borderRight: i < 6 ? "1px solid var(--line-2)" : "none", padding: "11px 10px 13px",
                    textAlign: "left", background: sel === i ? "var(--canvas)" : "transparent", minHeight: 168,
                  }}>
                    <div className="between" style={{ marginBottom: 9 }}>
                      <span className={`t-xs ${i === 0 ? "w6" : "c-3"}`}>{d}</span>
                      {i === 0 ? <span className="dot" style={{ background: "var(--accent)" }} /> : null}
                    </div>
                    <div className="col gap-1">
                      {evs.map((e) => (
                        <div key={e.title} style={{
                          background: KIND[e.kind].bg, border: `1px solid ${KIND[e.kind].bd}`,
                          borderRadius: 6, padding: "5px 7px",
                        }}>
                          <div className="t-2xs num" style={{ color: KIND[e.kind].c }}>{e.t}</div>
                          <div className="t-xs w55 trunc" style={{ color: KIND[e.kind].c }}>{e.title}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="split">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
              <span className="t-sm w6">{DAYS[sel]} September</span>
              <span className="t-xs c-4">{dayEvents.length} items</span>
            </div>
            {dayEvents.length === 0 ? (
              <div className="center" style={{ padding: "44px 20px" }}>
                <Ico.cal size={22} className="c-4" />
                <p className="t-md w55" style={{ marginTop: 10 }}>Nothing scheduled</p>
                <button className="btn btn-s btn-sm" style={{ marginTop: 10 }}><Ico.plus size={13} />Add event</button>
              </div>
            ) : dayEvents.map((e) => (
              <div key={e.title} className="between link-row" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                <div className="row-t gap-3 grow">
                  <div style={{ width: 46, flex: "none" }}>
                    <div className="num t-sm w55">{e.t}</div>
                    {e.dur ? <div className="t-2xs c-4">{e.dur}</div> : null}
                  </div>
                  <span style={{ width: 2, alignSelf: "stretch", background: KIND[e.kind].c, borderRadius: 2, flex: "none" }} />
                  <div className="grow">
                    <div className="t-md w55">{e.title}</div>
                    <div className="t-xs c-4">{e.who}</div>
                  </div>
                </div>
                <button className="btn btn-g btn-ico" style={{ width: 28, height: 28 }}><Ico.more size={15} /></button>
              </div>
            ))}
          </div>

          <div className="col gap-3">
            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 10 }}>Deadlines this week</div>
              {EVENTS.filter((e) => e.kind === "deadline").map((e) => (
                <div key={e.title} className="row-t gap-2" style={{ padding: "8px 0", borderTop: "1px solid var(--line-3)" }}>
                  <Ico.clock size={14} className="c-neg" style={{ marginTop: 2 }} />
                  <div className="grow">
                    <div className="t-sm w55">{e.title}</div>
                    <div className="t-xs c-4">{e.who} · {DAYS[e.d]}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 8 }}>Booking link</div>
              <p className="t-xs c-3" style={{ marginBottom: 10, lineHeight: 1.55 }}>
                Clients pick from your real availability inside their snapshot.
              </p>
              <div className="tint p-2 row gap-2" style={{ marginBottom: 10 }}>
                <span className="t-xs mono c-3 grow trunc">rift.co/kaleb</span>
                <button className="btn btn-g btn-sm">Copy</button>
              </div>
              <Link href="/prototype/app" className="btn btn-s btn-sm" style={{ width: "100%" }}>See how clients book</Link>
            </div>
          </div>
        </div>
      </StudioBody>
    </>
  );
}
