"use client";

import Link from "next/link";
import { StudioHead, StudioBody, Tab } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { OFFERS } from "@/lib/prototype/fixtures";
import { money } from "@/lib/prototype/compute";

export default function Offers() {
  const best = Math.max(...OFFERS.map((o) => o.netToSeller));
  return (
    <>
      <StudioHead
        title="Offers"
        sub="1841 Ferncliff Road NE · deadline tomorrow 5:00pm"
        actions={<button className="btn btn-s btn-sm"><Ico.share size={14} />Share summary</button>}
        tabs={<><Tab href="/prototype/studio/offers" label="Awaiting you" count={2} on /><Tab href="/prototype/studio/offers" label="Presented" count={0} on={false} /><Tab href="/prototype/studio/offers" label="All" count={2} on={false} /></>}
      />
      <StudioBody>
        <div className="card" style={{ padding: 14, marginBottom: 18, borderColor: "var(--accent-line)", background: "var(--accent-wash)" }}>
          <div className="row-t gap-3">
            <Ico.lock size={16} className="c-acc" style={{ marginTop: 1, flex: "none" }} />
            <div className="grow">
              <div className="t-sm w6 c-acc">The seller has not seen either offer</div>
              <div className="t-xs c-2" style={{ marginTop: 2 }}>
                Nothing is released until you release it. Every decision is recorded.
              </div>
            </div>
          </div>
        </div>

        <div className="col gap-3">
          {OFFERS.map((o) => (
            <Link key={o.id} href={`/prototype/studio/offers/${o.id}`} className="card lift" style={{ padding: 18, display: "block" }}>
              <div className="between wrap gap-3" style={{ alignItems: "flex-start" }}>
                <div className="row-t gap-3" style={{ minWidth: 0 }}>
                  <div className="av av-lg" style={{ background: o.represented ? "#2f5480" : "#8a4a2e" }}>
                    {o.submittedBy.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-lg w6">{o.submittedBy}</div>
                    <div className="t-xs c-4" style={{ marginTop: 1 }}>{o.brokerage} · {o.ref}</div>
                    <div className="row gap-1 wrap" style={{ marginTop: 10 }}>
                      <span className="chip">{o.financing}</span>
                      <span className="chip">Closes {o.closeDate}</span>
                      <span className="chip">{o.contingencies.length} contingencies</span>
                      {!o.represented ? <span className="chip chip-warn"><Ico.alert size={10} />Unrepresented</span> : null}
                      {o.flags.length ? <span className="chip chip-neg"><Ico.alert size={10} />{o.flags.length} flags</span> : null}
                    </div>
                  </div>
                </div>

                <div className="row gap-5" style={{ flex: "none" }}>
                  <div style={{ textAlign: "right" }}>
                    <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>Offer</div>
                    <div className="num" style={{ fontSize: 20, marginTop: 3 }}>{money(o.price)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>Net to seller</div>
                    <div className="num" style={{ fontSize: 20, marginTop: 3, color: o.netToSeller === best ? "var(--pos)" : "var(--ink)" }}>
                      {money(o.netToSeller)}
                    </div>
                    {o.netToSeller === best ? <div className="t-2xs c-pos w55" style={{ marginTop: 2 }}>Best net</div> : null}
                  </div>
                  <Ico.chevR size={17} className="c-4" style={{ alignSelf: "center" }} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="card p-4" style={{ marginTop: 18 }}>
          <div className="between" style={{ marginBottom: 12 }}>
            <span className="t-sm w6">Price is not the comparison</span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th></th>{OFFERS.map((o) => <th key={o.id} className="num-c">{o.submittedBy.split(" ")[1]}</th>)}<th className="num-c">Difference</th></tr></thead>
              <tbody>
                {[
                  ["Offer price", (o: typeof OFFERS[0]) => money(o.price), money(13_000)],
                  ["Concessions", (o: typeof OFFERS[0]) => o.concessions === "None requested" ? "—" : o.concessions, money(12_000)],
                  ["Net to seller", (o: typeof OFFERS[0]) => money(o.netToSeller), `−${money(6_500)}`],
                  ["Earnest", (o: typeof OFFERS[0]) => money(o.earnest), money(6_000)],
                  ["Closing", (o: typeof OFFERS[0]) => o.closeDate, "28 days later"],
                ].map(([l, fn, diff]) => (
                  <tr key={l as string}>
                    <td className="w55">{l as string}</td>
                    {OFFERS.map((o) => <td key={o.id} className="num-c num">{(fn as (o: typeof OFFERS[0]) => string)(o)}</td>)}
                    <td className="num-c t-xs c-4">{diff as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-sm c-3" style={{ marginTop: 12, maxWidth: 620 }}>
            Deel is {money(13_000)} higher and nets {money(6_500)} less.
          </p>
        </div>
      </StudioBody>
    </>
  );
}
