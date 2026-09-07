"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { OFFERS } from "@/lib/prototype/fixtures";
import { money } from "@/lib/core/compute";

const GROUPS = ["Price", "Financing", "Deposits", "Dates", "Contingencies", "Concessions", "Documents", "Special Terms"];
const CONF = { high: { c: "chip-pos", l: "High" }, medium: { c: "chip-warn", l: "Medium" }, low: { c: "chip-neg", l: "Low" } };

export default function OfferDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const o = OFFERS.find((x) => x.id === id) ?? OFFERS[0];
  const router = useRouter();
  const [decision, setDecision] = useState<"pending" | "presented" | "held" | "declined">("pending");
  const [asking, setAsking] = useState<"held" | "declined" | null>(null);
  const [reason, setReason] = useState("");

  const META = {
    presented: { c: "chip-pos", i: Ico.checkCircle, l: "Presented to seller", d: "Released into the Decision Room with your context." },
    held: { c: "chip-warn", i: Ico.clock, l: "Held", d: "Submitter told it was received and is under review. Escalates in 4h." },
    declined: { c: "chip", i: Ico.pause, l: "Not presented", d: "Kept in the file permanently. Submitter told it was received." },
  } as const;

  return (
    <>
      <StudioHead
        title={o.submittedBy}
        sub={`${o.brokerage} · ${o.ref} · submitted ${o.submittedAt}`}
        back={{ href: "/prototype/studio/offers", label: "Offers" }}
        actions={
          decision === "pending" ? (
            <>
              <button className="btn btn-s btn-sm" onClick={() => setAsking("held")}>Hold</button>
              <button className="btn btn-s btn-sm" onClick={() => setAsking("declined")}>Decline</button>
              <button className="btn btn-a btn-sm" onClick={() => setDecision("presented")}>
                <Ico.send size={14} />Present to seller
              </button>
            </>
          ) : (
            <button className="btn btn-g btn-sm" onClick={() => { setDecision("pending"); setReason(""); }}>
              <Ico.refresh size={14} />Undo
            </button>
          )
        }
      />
      <StudioBody>
        {decision !== "pending" ? (
          <div className="card p-4 fade-in" style={{ marginBottom: 18 }}>
            <div className="row-t gap-3">
              {(() => { const M = META[decision]; return <M.i size={18} className={decision === "presented" ? "c-pos" : "c-3"} style={{ marginTop: 1 }} />; })()}
              <div className="grow">
                <div className="t-md w6">{META[decision].l}</div>
                <div className="t-sm c-3" style={{ marginTop: 2 }}>{META[decision].d}</div>
                <div className="tint p-3" style={{ marginTop: 12 }}>
                  <table className="tbl"><tbody>
                    <tr><td className="c-4" style={{ width: 130 }}>Decided by</td><td className="w55">Kaleb Befekadu</td></tr>
                    <tr><td className="c-4">At</td><td className="w55 num">6 Sep 2026, 10:14</td></tr>
                    {reason ? <tr><td className="c-4">Reason</td><td className="w55">{reason}</td></tr> : null}
                    <tr><td className="c-4">Documents</td><td className="w55">Preserved, unmodified</td></tr>
                  </tbody></table>
                </div>
                {decision === "presented" ? (
                  <button className="btn btn-s btn-sm" style={{ marginTop: 12 }} onClick={() => router.push("/prototype/studio/offers/room")}>
                    Open the Decision Room <Ico.arrowR size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {asking && decision === "pending" ? (
          <div className="card p-4 fade-in" style={{ marginBottom: 18 }}>
            <div className="t-md w6" style={{ marginBottom: 4 }}>
              {asking === "held" ? "Why are you holding this?" : "Why are you not presenting this?"}
            </div>
            <p className="t-sm c-4" style={{ marginBottom: 12 }}>Recorded permanently against the offer.</p>
            <textarea className="ta" style={{ minHeight: 76 }} value={reason} autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder={asking === "held" ? "What you're waiting for" : "The seller instruction this rests on"} />
            <div className="row gap-2" style={{ marginTop: 12 }}>
              <button className="btn btn-p btn-sm" disabled={!reason.trim()} onClick={() => { setDecision(asking); setAsking(null); }}>
                Record and {asking === "held" ? "hold" : "decline"}
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setAsking(null)}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div className="split">
          <div className="col gap-3">
            <div className="card p-5">
              <div className="g3 gap-4">
                {[
                  ["Offer price", money(o.price), null],
                  ["Estimated net to seller", money(o.netToSeller), o.netToSeller > 395_000 ? "Best net" : "Lower net"],
                  ["Earnest money", money(o.earnest), null],
                ].map(([l, v, n]) => (
                  <div key={l as string}>
                    <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                    <div className="num" style={{ fontSize: 26, marginTop: 5 }}>{v}</div>
                    {n ? <div className={`t-xs w55 ${n === "Best net" ? "c-pos" : "c-warn"}`} style={{ marginTop: 2 }}>{n}</div> : null}
                  </div>
                ))}
              </div>
              <div className="hr" style={{ margin: "18px 0 14px" }} />
              <div className="row gap-1 wrap">
                <span className={`chip ${o.preapproval ? "chip-pos" : "chip-neg"}`}>
                  {o.preapproval ? <Ico.check size={10} /> : <Ico.x size={10} />}Preapproval
                </span>
                <span className={`chip ${o.proofOfFunds ? "chip-pos" : "chip-neg"}`}>
                  {o.proofOfFunds ? <Ico.check size={10} /> : <Ico.x size={10} />}Proof of funds
                </span>
                {o.contingencies.map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>

            {o.flags.length ? (
              <div className="card p-4" style={{ borderColor: "#f2d3d0", background: "var(--neg-wash)" }}>
                <div className="row gap-2" style={{ marginBottom: 10 }}>
                  <Ico.alert size={15} className="c-neg" />
                  <span className="t-sm w6 c-neg">{o.flags.length} things to look at</span>
                </div>
                <ul className="col gap-2">
                  {o.flags.map((f) => (
                    <li key={f} className="row-t gap-2">
                      <span className="dot" style={{ background: "var(--neg)", marginTop: 7 }} />
                      <span className="t-sm c-2">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card" style={{ overflow: "hidden" }}>
              <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-sm w6">Terms as read from the document</span>
                <button className="btn btn-g btn-sm"><Ico.doc size={13} />Open PDF</button>
              </div>
              {GROUPS.map((g) => {
                const f = o.fields.filter((x) => x.group === g);
                if (!f.length) return null;
                return (
                  <div key={g}>
                    <div className="kicker" style={{ padding: "12px 16px 6px", background: "var(--canvas)", borderTop: "1px solid var(--line-3)" }}>{g}</div>
                    {f.map((x) => (
                      <div key={x.label} className="between" style={{ padding: "10px 16px", borderTop: "1px solid var(--line-3)", gap: 12 }}>
                        <span className="t-sm c-2 grow">{x.label}</span>
                        <span className="t-sm w55">{x.value}</span>
                        <span className={`chip ${CONF[x.confidence].c}`} style={{ flex: "none" }}>{CONF[x.confidence].l}</span>
                        <span className="t-2xs c-4 num" style={{ width: 26, textAlign: "right", flex: "none" }}>{x.page > 0 ? `p${x.page}` : "—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col gap-3">
            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 10 }}>Submitter</div>
              <div className="row gap-3" style={{ marginBottom: 12 }}>
                <div className="av av-lg" style={{ background: o.represented ? "#2f5480" : "#8a4a2e" }}>
                  {o.submittedBy.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="grow">
                  <div className="t-sm w55">{o.submittedBy}</div>
                  <div className="t-xs c-4">{o.brokerage}</div>
                </div>
              </div>
              {!o.represented ? (
                <div className="tint p-3">
                  <div className="t-xs w6 c-warn" style={{ marginBottom: 4 }}>Unrepresented buyer</div>
                  <p className="t-xs c-2" style={{ lineHeight: 1.55 }}>
                    Routed straight to you. No automated reply was sent and Rift gave no advice.
                  </p>
                  <div className="col gap-1" style={{ marginTop: 10 }}>
                    <button className="btn btn-s btn-sm" style={{ justifyContent: "flex-start" }}>Refer to another agent</button>
                    <button className="btn btn-s btn-sm" style={{ justifyContent: "flex-start" }}>Send disclosure and proceed</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-s btn-sm" style={{ width: "100%" }}><Ico.mail size={13} />Message agent</button>
              )}
            </div>

            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 10 }}>Activity</div>
              {[
                ["Submitted with 7-page PDF", o.submittedAt.split(" ")[1]],
                ["Terms prepared and corrected by submitter", o.submittedAt.split(" ")[1]],
                ["Reference issued", o.ref],
                ["Awaiting your decision", "now"],
              ].map(([t, m], i, a) => (
                <div key={t} className="row-t gap-3" style={{ paddingBottom: i === a.length - 1 ? 0 : 12 }}>
                  <div className="col" style={{ alignItems: "center", flex: "none", paddingTop: 4 }}>
                    <span className="dot" style={{ background: i === a.length - 1 ? "var(--accent)" : "var(--ink-5)" }} />
                    {i < a.length - 1 ? <span style={{ width: 1, flex: 1, background: "var(--line)", minHeight: 18, marginTop: 3 }} /> : null}
                  </div>
                  <div className="grow" style={{ marginTop: -2 }}>
                    <div className="t-sm">{t}</div>
                    <div className="t-2xs c-4 num">{m}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </StudioBody>
    </>
  );
}
