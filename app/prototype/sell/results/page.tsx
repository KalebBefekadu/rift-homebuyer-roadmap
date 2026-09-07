"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { Verdict, Sec, Reframe, BlockerCard, Steps, Questions, Ladder, ActionBar, Keep, ReadoutShell } from "@/components/rift/Readout";
import { sellerReadout } from "@/lib/core/results";
import {
  SELLER_DEFAULTS, money, netProceeds, repairTriage, unclaimedValue, type SellerInputs,
} from "@/lib/core/compute";

const V: Record<string, { c: string; l: string }> = {
  "pays-back": { c: "chip-pos", l: "Worth doing" },
  photographs: { c: "chip-warn", l: "Photos only" },
  skip: { c: "chip", l: "Don't bother" },
};

function Results() {
  const q = useSearchParams();
  const [keep, setKeep] = useState(false);
  const [saved, setSaved] = useState(false);

  const s: SellerInputs = useMemo(() => ({
    ...SELLER_DEFAULTS,
    price: Number(q.get("p")) || SELLER_DEFAULTS.price,
    payoff: Number(q.get("o")) || SELLER_DEFAULTS.payoff,
    county: q.get("c") || SELLER_DEFAULTS.county,
    yearsOwned: Number(q.get("y")) || SELLER_DEFAULTS.yearsOwned,
    homesteadFiled: q.get("h") === "1",
  }), [q]);

  const timing = q.get("t") || "3 to 9 months";
  const who = q.get("w") || "none";

  const r = useMemo(() => netProceeds(s), [s]);
  const read = useMemo(() => sellerReadout(s, timing), [s, timing]);
  /* The call is about their actual blocker, not a generic slot. */
  const bookHref = `/prototype/book?v=sell&topic=${encodeURIComponent(read.blocker.title)}`;

  useTrack({ name: "readout_view", side: "sell", meta: { status: read.status } });
  const unclaimed = useMemo(() => unclaimedValue(s), [s]);
  const repairs = useMemo(() => repairTriage(s.price), [s.price]);
  const payback = repairs.filter((x) => x.verdict === "pays-back");
  const equityPct = Math.round((r.net / s.price) * 100);

  return (
    <ReadoutShell v="sell" ask={{ what: "Net proceeds at this price", claim: money(r.net) }}>
      <Verdict
        r={read}
        used={`Built from ${money(s.price)} likely price · ${money(s.payoff)} still owed · ${s.county} County · about ${s.yearsOwned} years owned`}
        glance={[
          { label: "You keep", value: money(r.net), note: `${equityPct}% of the price` },
          { label: "Cost of selling", value: money(r.totalCosts - s.payoff), note: "excluding your payoff" },
          { label: "Worth fixing", value: money(payback.reduce((a, x) => a + x.cost, 0)), note: `${payback.length} of ${repairs.length} items` },
          { label: "Possibly unclaimed", value: `${unclaimed.length} things`, note: "worth a phone call each" },
        ]}
      />

      <div className="shell-w">
        <Sec n={1} title="What actually reaches you" sub="Every valuation you have been given is a list price. This is the other end of it.">
          <Reframe r={read} />
          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            <div className="between" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-2)" }}>
              <span className="t-md w6">Sale price</span>
              <span className="num t-lg">{money(s.price)}</span>
            </div>
            {r.costs.map((c) => (
              <div key={c.label} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                <div className="grow">
                  <div className="t-sm w5">{c.label}</div>
                  <div className="t-xs c-4" style={{ marginTop: 1 }}>{c.note}</div>
                </div>
                <span className="num t-sm c-neg">−{money(c.amount)}</span>
              </div>
            ))}
            <div className="between" style={{ padding: "16px 18px", background: "var(--brand-wash)" }}>
              <span className="t-md w6">Yours</span>
              <span className="num" style={{ fontSize: 25, color: "var(--brand-2)" }}>{money(r.net)}</span>
            </div>
          </div>
          <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>{r.couldBeWrong}</p>
        </Sec>

        <Sec n={2} title={`${unclaimed.length} things you may already be losing`}
          sub="These have nothing to do with selling. They are worth a call whether or not you ever list.">
          <div className="col gap-2">
            {unclaimed.map((u) => (
              <div key={u.title} className="card p-4">
                <div className="between wrap gap-2">
                  <span className="t-md w6 grow" style={{ minWidth: 220 }}>{u.title}</span>
                  <span className="num t-md c-brand" style={{ flex: "none" }}>{u.estimate}</span>
                </div>
                <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 640 }}>{u.detail}</p>
                <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                  <span className="chip"><Ico.users size={12} />Decided by {u.decidedBy}</span>
                  {u.urgency ? <span className="chip chip-warn"><Ico.clock size={12} />{u.urgency}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="t-xs c-4" style={{ marginTop: 14, lineHeight: 1.6, maxWidth: 640 }}>
            We are not tax advisors or attorneys, and nothing here is advice. We notice the
            question is worth asking and tell you exactly who is allowed to answer it.
          </p>
        </Sec>

        <Sec n={3} title="What to fix, and what to leave alone"
          sub={`Of ${repairs.length} things sellers commonly do, ${payback.length} tend to come back in the price.`}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr>
                  <th style={{ paddingLeft: 20 }}>Work</th><th className="num-c">Typical cost</th>
                  <th>Verdict</th><th style={{ paddingRight: 20 }}>Why</th>
                </tr></thead>
                <tbody>
                  {repairs.map((x) => (
                    <tr key={x.item}>
                      <td className="w55" style={{ paddingLeft: 20 }}>{x.item}</td>
                      <td className="num-c num">{money(x.cost)}</td>
                      <td><span className={`chip ${V[x.verdict].c}`}>{V[x.verdict].l}</span></td>
                      <td className="t-sm c-3" style={{ paddingRight: 20 }}>{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Sec>

        <Sec n={4} title="The one thing in your way">
          <BlockerCard r={read} onAsk={() => setKeep(true)} />
        </Sec>

        <Sec n={5} title="What to do, in order" sub="Most of this costs nothing and none of it commits you to selling.">
          <Steps r={read} />
        </Sec>

        <Sec n={6} title="Questions for any agent" sub="Including agents we have never met. If the answers are vague, that is the answer.">
          <Questions r={read} who="Kaleb" />
        </Sec>

        <Sec n={7} title="If you want anything more" sub="You already have all of it. Each of these is optional.">
          <Ladder v="sell" coBuyer={who} bookHref={bookHref} onKeep={() => setKeep(true)} onShare={() => setKeep(true)} />
        </Sec>
      </div>

      <ActionBar saved={saved} onKeep={() => setKeep(true)} bookHref={bookHref} />
      {keep ? (
        <Keep v="sell" coBuyer={who} onClose={() => setKeep(false)}
          onDone={() => { track({ name: "email_capture", side: "sell" }); setSaved(true); setKeep(false); }} />
      ) : null}
    </ReadoutShell>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="shell-w sec"><p className="t-sm c-4">Working out your numbers…</p></div>}><Results /></Suspense>;
}
