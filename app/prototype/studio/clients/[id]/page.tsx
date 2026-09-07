"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { findClient, REP_CHIP, STATE_CHIP } from "@/lib/prototype/clients";

const TABS = ["Overview", "Plan", "Documents", "Activity"] as const;

export default function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = findClient(id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  if (!c) notFound();

  return (
    <>
      <StudioHead
        title={c.name}
        sub={`${c.role} · ${c.county} County · client since ${c.since}`}
        back={{ href: "/prototype/studio/clients", label: "Clients" }}
        actions={
          <>
            <button className="btn btn-s btn-sm"><Ico.mail size={14} />Message</button>
            <Link href="/prototype/app" className="btn btn-s btn-sm">View as client</Link>
            <button className="btn btn-p btn-sm"><Ico.plus size={14} />Add task</button>
          </>
        }
        tabs={TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="row" style={{
            height: 36, padding: "0 11px", fontSize: 13,
            fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--ink)" : "var(--ink-3)",
            borderBottom: `2px solid ${tab === t ? "var(--ink)" : "transparent"}`, marginBottom: -1,
          }}>{t}</button>
        ))}
      />
      <StudioBody>
        {c.flag ? (
          <div className="card p-3" style={{ marginBottom: 16, borderColor: "var(--accent-line)", background: "var(--accent-wash)" }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-acc" />
              <span className="t-sm w55 c-acc">{c.flag}</span>
            </div>
          </div>
        ) : null}

        <div className="split">
          <div className="col gap-3">
            {tab === "Overview" ? (
              <>
                <div className="card p-5">
                  <div className="g4 gap-4">
                    {c.numbers.map(([l, v]) => (
                      <div key={l}>
                        <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                        <div className="num" style={{ fontSize: 21, marginTop: 5 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                    <span className="t-sm w6">Open work</span>
                    <button className="btn btn-g btn-sm" onClick={() => setTab("Plan")}>All <Ico.chevR size={12} /></button>
                  </div>
                  {c.tasks.map((t) => (
                    <div key={t.t} className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                      <span className="t-sm grow">{t.t}</span>
                      <span className="t-xs c-4">{t.owner}</span>
                      <span className="t-xs c-4 num">{t.due}</span>
                      <span className={`chip ${STATE_CHIP[t.state]}`}>{t.state}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {tab === "Plan" ? (
              <div className="card" style={{ overflow: "hidden" }}>
                <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Plan</span>
                  <button className="btn btn-s btn-sm"><Ico.plus size={13} />Task</button>
                </div>
                {c.tasks.map((t) => (
                  <div key={t.t} className="between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                    <div className="grow">
                      <div className="t-md w5">{t.t}</div>
                      <div className="t-xs c-4" style={{ marginTop: 2 }}>Owner: {t.owner} · due {t.due}</div>
                    </div>
                    <span className={`chip ${STATE_CHIP[t.state]}`}>{t.state}</span>
                    <button className="btn btn-g btn-ico" style={{ width: 28, height: 28 }}><Ico.more size={15} /></button>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "Documents" ? (
              <div className="card" style={{ overflow: "hidden" }}>
                <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Documents</span>
                  <button className="btn btn-s btn-sm"><Ico.plus size={13} />Upload</button>
                </div>
                {[
                  ["Buyer agency agreement", "Prepared, not sent", "Kaleb"],
                  ["Assessment summary", "13 Aug", "Rift"],
                  ["Lender question sheet", "Shared with Brookhaven", "Rift"],
                  ["Meeting recap — 2 Sep", "Awaiting your review", "Rift"],
                ].map(([n, m, w]) => (
                  <div key={n} className="between link-row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                    <div className="row gap-3 grow">
                      <Ico.doc size={16} className="c-4" />
                      <div><div className="t-sm w55">{n}</div><div className="t-xs c-4">{m}</div></div>
                    </div>
                    <span className="t-xs c-4">{w}</span>
                    <Ico.chevR size={14} className="c-4" />
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "Activity" ? (
              <div className="card p-5">
                {c.timeline.map((e, i, a) => (
                  <div key={e.t} className="row-t gap-3" style={{ paddingBottom: i === a.length - 1 ? 0 : 16 }}>
                    <div className="col" style={{ alignItems: "center", flex: "none", paddingTop: 4 }}>
                      <span className="dot" style={{ background: i === 0 ? "var(--accent)" : "var(--ink-5)" }} />
                      {i < a.length - 1 ? <span style={{ width: 1, flex: 1, background: "var(--line)", minHeight: 24, marginTop: 4 }} /> : null}
                    </div>
                    <div className="grow" style={{ marginTop: -3 }}>
                      <div className="t-md w5">{e.t}</div>
                      <div className="t-xs c-4" style={{ marginTop: 1 }}>{e.who} · {e.d} ago</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="col gap-3">
            <div className="card p-4">
              <div className="row gap-3" style={{ marginBottom: 14 }}>
                <div className="av av-lg" style={{ background: c.color }}>{c.av}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-md w6">{c.name}</div>
                  <div className="t-xs c-4">{c.journey}</div>
                </div>
              </div>
              <table className="tbl"><tbody>
                <tr><td className="c-4" style={{ padding: "7px 0", width: 96 }}>Stage</td><td className="w55" style={{ padding: "7px 0" }}>{c.stage}</td></tr>
                <tr><td className="c-4" style={{ padding: "7px 0" }}>Representation</td><td style={{ padding: "7px 0" }}><span className={`chip ${REP_CHIP[c.rep]}`}>{c.rep}</span></td></tr>
                <tr><td className="c-4" style={{ padding: "7px 0" }}>Source</td><td className="w55" style={{ padding: "7px 0" }}>{c.source}{c.via ? <div className="t-xs c-4">via {c.via}</div> : null}</td></tr>
                <tr><td className="c-4" style={{ padding: "7px 0" }}>Email</td><td className="w55 t-sm" style={{ padding: "7px 0" }}>{c.email}</td></tr>
                <tr><td className="c-4" style={{ padding: "7px 0" }}>Phone</td><td className="w55 num t-sm" style={{ padding: "7px 0" }}>{c.phone}</td></tr>
              </tbody></table>
            </div>

            {c.household ? (
              <div className="card p-4">
                <div className="t-sm w6" style={{ marginBottom: 10 }}>Household</div>
                {c.household.map((h) => (
                  <div key={h.name} className="row gap-3" style={{ padding: "7px 0" }}>
                    <div className="av av-sm" style={{ background: h.state === "Active" ? c.color : "var(--line)", color: h.state === "Active" ? "#fff" : "var(--ink-4)" }}>
                      {h.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="grow"><div className="t-sm w55">{h.name}</div><div className="t-xs c-4">{h.role}</div></div>
                    <span className="t-xs c-4">{h.state}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 10 }}>Quick actions</div>
              <div className="col gap-1">
                {[
                  [Ico.send, "Send agency agreement"],
                  [Ico.cal, "Book a call"],
                  [Ico.doc, "Request a document"],
                  [Ico.gift, "Trigger a playbook"],
                ].map(([I, l], i) => {
                  const Icon = I as React.ComponentType<{ size?: number }>;
                  return (
                    <button key={i} className="btn btn-s btn-sm" style={{ justifyContent: "flex-start", width: "100%" }}>
                      <Icon size={14} />{l as string}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </StudioBody>
    </>
  );
}
