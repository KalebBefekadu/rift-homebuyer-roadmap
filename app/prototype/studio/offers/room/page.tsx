"use client";

import { useState } from "react";
import Link from "next/link";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { OFFERS } from "@/lib/prototype/fixtures";
import { money } from "@/lib/prototype/compute";

const ROWS: [string, (o: typeof OFFERS[0]) => string][] = [
  ["Offer price", (o) => money(o.price)],
  ["Concessions requested", (o) => (o.concessions === "None requested" ? "None" : o.concessions)],
  ["Financing", (o) => o.financing],
  ["Earnest money", (o) => money(o.earnest)],
  ["Closing date", (o) => o.closeDate],
  ["Contingencies", (o) => o.contingencies.join(", ")],
  ["Preapproval", (o) => (o.preapproval ? "Attached" : "Not attached")],
  ["Proof of funds", (o) => (o.proofOfFunds ? "Attached" : "Not attached")],
];

const RISK: Record<string, { l: string; b: string; lv: "low" | "med" | "high" }[]> = {
  o1: [
    { l: "Financing", b: "Conventional, 20% down, preapproval attached.", lv: "low" },
    { l: "Appraisal", b: "Room at this price. Any shortfall would be small.", lv: "low" },
    { l: "Timeline", b: "17 October with a 10-day diligence window.", lv: "low" },
  ],
  o2: [
    { l: "Financing", b: "FHA at 3.5% down, no preapproval attached.", lv: "high" },
    { l: "Contingency", b: "They must sell their own home first — a second transaction you don't control.", lv: "high" },
    { l: "Timeline", b: "28 days later, 17-day diligence window.", lv: "med" },
  ],
};

const LV = { low: "chip-pos", med: "chip-warn", high: "chip-neg" };

export default function Decisions() {
  const [pick, setPick] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string[]>([]);

  return (
    <>
      <StudioHead
        title="Decision Room preview"
        sub="1841 Ferncliff · exactly what Nadia and Chris see"
        back={{ href: "/prototype/studio/offers", label: "Offers" }}
        actions={<Link href="/prototype/studio/clients/okafor" className="btn btn-s btn-sm">Open client</Link>}
      />
      <StudioBody>
      <div className="card p-3" style={{ marginBottom: 18, borderColor: "var(--line)", background: "var(--sunk)" }}>
        <div className="row gap-2">
          <Ico.users size={15} className="c-3" />
          <span className="t-sm c-2">Client view · they decide by tomorrow 5:00pm</span>
        </div>
      </div>

      <div className="g2 gap-3" style={{ marginBottom: 16 }}>
        {OFFERS.map((o) => {
          const on = pick === o.id;
          const best = o.netToSeller > 395_000;
          return (
            <button key={o.id} onClick={() => setPick(o.id)} className="card lift" style={{
              padding: 22, textAlign: "left", display: "block",
              borderColor: on ? "var(--ink)" : undefined,
              boxShadow: on ? "inset 0 0 0 1px var(--ink)" : undefined,
            }}>
              <div className="between" style={{ marginBottom: 14 }}>
                <div>
                  <div className="t-md w6">{o.submittedBy}</div>
                  <div className="t-xs c-4">{o.brokerage}</div>
                </div>
                {best ? <span className="chip chip-pos"><Ico.check size={10} />Higher net</span> : <span className="chip chip-warn">Higher price</span>}
              </div>
              <div className="kicker">You would receive</div>
              <div className="serif" style={{ fontSize: 42, letterSpacing: "-0.025em", marginTop: 5, color: best ? "var(--pos)" : "var(--ink)" }}>
                {money(o.netToSeller)}
              </div>
              <div className="t-sm c-3" style={{ marginTop: 6 }}>
                on a {money(o.price)} offer
              </div>
              <div className="row gap-2" style={{ marginTop: 16 }}>
                <span style={{
                  width: 17, height: 17, borderRadius: "50%", border: `1.5px solid ${on ? "var(--ink)" : "var(--ink-5)"}`,
                  background: on ? "var(--ink)" : "transparent", display: "grid", placeItems: "center", color: "#fff",
                }}>{on ? <Ico.check size={10} /> : null}</span>
                <span className="t-sm w55">{on ? "This is my choice" : "Choose this one"}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
        <div className="scroll-x">
          <table className="tbl">
            <thead><tr><th style={{ paddingLeft: 18 }}></th>{OFFERS.map((o) => <th key={o.id}>{o.submittedBy}</th>)}</tr></thead>
            <tbody>
              {ROWS.map(([l, fn]) => (
                <tr key={l}>
                  <td className="w55 c-3" style={{ paddingLeft: 18, width: 190 }}>{l}</td>
                  {OFFERS.map((o) => <td key={o.id} className="w5">{fn(o)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="g2 gap-3" style={{ marginBottom: 16 }}>
        {OFFERS.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 12 }}>Risk — {o.submittedBy.split(" ")[1]}</div>
            {RISK[o.id].map((r) => (
              <div key={r.l} style={{ padding: "9px 0", borderTop: "1px solid var(--line-3)" }}>
                <div className="row gap-2" style={{ marginBottom: 3 }}>
                  <span className={`chip ${LV[r.lv]}`}>{r.lv}</span>
                  <span className="t-sm w55">{r.l}</span>
                </div>
                <p className="t-sm c-3">{r.b}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="split-w">
        <div className="card p-5">
          <div className="row gap-3" style={{ marginBottom: 14 }}>
            <div className="av" style={{ background: "var(--accent)" }}>K</div>
            <div><div className="t-sm w6">Kaleb&apos;s take</div><div className="t-xs c-4">Added 6 Sep, 10:20</div></div>
          </div>
          <p className="t-md c-2" style={{ lineHeight: 1.65, marginBottom: 12 }}>
            The {money(13_000)} higher price on Deel is the thing your eye goes to, and it&apos;s
            the wrong thing to look at. After the {money(12_000)} concession you net about{" "}
            {money(6_500)} less, and you take on a buyer who has to sell their own house first.
          </p>
          <p className="t-md c-2" style={{ lineHeight: 1.65, marginBottom: 12 }}>
            I&apos;d take Whitfield. If you want, I&apos;ll go back to Deel and ask him to drop the
            home-sale contingency and attach a preapproval — but I wouldn&apos;t hold Whitfield
            waiting while we find out.
          </p>
          <p className="t-sm c-4">
            Marcus Deel is unrepresented. I&apos;ve told him plainly that I represent you, not
            him, and offered to refer him to an agent.
          </p>
        </div>

        <div className="col gap-3">
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 10 }}>Ask before you decide</div>
            <textarea className="ta" style={{ minHeight: 74 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Anything you want to understand" />
            <button className="btn btn-s btn-sm" style={{ marginTop: 9 }} disabled={!q.trim()}
              onClick={() => { setAsked([...asked, q]); setQ(""); }}>
              <Ico.send size={13} />Send to Kaleb
            </button>
            {asked.map((a, i) => (
              <div key={i} className="tint p-3" style={{ marginTop: 9 }}>
                <div className="t-2xs c-4" style={{ marginBottom: 3 }}>You asked · just now</div>
                <p className="t-sm">{a}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            {pick ? (
              <>
                <div className="t-sm w6" style={{ marginBottom: 6 }}>Ready to proceed</div>
                <p className="t-sm c-3" style={{ marginBottom: 12 }}>
                  You&apos;re choosing {OFFERS.find((o) => o.id === pick)!.submittedBy}.
                </p>
                <button className="btn btn-p" style={{ width: "100%" }}>Confirm and tell Kaleb</button>
                <p className="t-xs c-4" style={{ marginTop: 9, lineHeight: 1.5 }}>
                  Your decision and the numbers you saw are recorded together.
                </p>
              </>
            ) : (
              <>
                <div className="t-sm w6" style={{ marginBottom: 6 }}>No decision yet</div>
                <p className="t-sm c-4">Pick an offer above when you&apos;re ready.</p>
              </>
            )}
          </div>
        </div>
      </div>
      </StudioBody>
    </>
  );
}
