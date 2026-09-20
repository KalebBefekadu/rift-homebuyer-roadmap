"use client";

import { useRef, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { useTrack, track } from "@/lib/rift/track";
import {
  ReadoutShell, Verdict, Sec, Reframe, BlockerCard, Steps, Questions, Ladder, ActionBar, Keep,
} from "@/components/rift/Readout";
import { TrustLadder } from "@/components/rift/Trust";
import { money, type SellerInputs, type RepairItem, type UnclaimedItem } from "@/lib/core/compute";
import type { Readout as ReadoutModel } from "@/lib/core/results";

const VERDICT: Record<RepairItem["verdict"], { c: string; l: string }> = {
  "pays-back": { c: "chip-pos", l: "Worth doing" },
  photographs: { c: "chip-warn", l: "Photos only" },
  skip: { c: "chip", l: "Don't bother" },
};

/**
 * The seller readout.
 *
 * Renders numbers computed on the server. The one piece of real work here is
 * the capture, which reports what actually happened rather than assuming a
 * send succeeded.
 */
export function Readout({
  inputs, timing, readout: r, proceeds, repairs, unclaimed, coDecider, substituted,
}: {
  inputs: SellerInputs;
  timing: string;
  readout: ReadoutModel;
  proceeds: ReturnType<typeof import("@/lib/core/compute").netProceeds>;
  repairs: RepairItem[];
  unclaimed: UnclaimedItem[];
  coDecider: boolean;
  substituted: string[];
}) {
  const [keep, setKeep] = useState(false);
  const [saved, setSaved] = useState(false);
  const linkRef = useRef<string | null>(null);

  useTrack({ name: "readout_view", side: "sell", meta: { band: r.status } });

  const bookHref = `/book?v=sell&topic=${encodeURIComponent(r.blocker.title)}`;
  const payback = repairs.filter((x) => x.verdict === "pays-back");
  const paybackCost = payback.reduce((a, x) => a + x.cost, 0);
  const equityPct = inputs.price > 0 ? Math.round((proceeds.net / inputs.price) * 100) : 0;

  /* Persisted so the emailed link survives this tab. Best effort: the readout
     is already on screen and complete, so a failure here costs the share link,
     not the product. */
  const ensureLink = async (): Promise<string> => {
    if (linkRef.current) return linkRef.current;
    try {
      const res = await fetch("/api/readout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side: "sell", county: inputs.county, params: window.location.search }),
      }).then((x) => x.json());
      if (res?.url) { linkRef.current = res.url as string; return res.url as string; }
    } catch { /* fall through to the address bar */ }
    return window.location.href;
  };

  const capture = async (email: string): Promise<"sent" | "unavailable" | "error"> => {
    try {
      const url = await ensureLink();
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: "",
          email,
          lead: {
            side: "sell",
            completion: 1,
            source: "readout",
            county: inputs.county,
            timing,
            coBuyer: coDecider,
            contactable: true,
          },
          deliver: { shareUrl: url, county: inputs.county, netProceeds: proceeds.net },
        }),
      }).then((x) => x.json());

      if (res?.error) return "error";
      track({ name: "email_capture", side: "sell", meta: { delivered: res?.delivery === "sent" } });
      setSaved(true);
      if (res?.delivery === "sent") return "sent";
      if (res?.delivery === "failed") return "error";
      return "unavailable";
    } catch {
      return "error";
    }
  };

  return (
    <ReadoutShell v="sell" ask={{ what: "Net proceeds at this price", claim: money(proceeds.net) }}>
      <Verdict
        r={r}
        used={`Built from ${money(inputs.price)} likely price · ${money(inputs.payoff)} still owed · ${inputs.county} County · about ${inputs.yearsOwned} years owned`}
        glance={[
          { label: "You keep", value: money(proceeds.net), note: `${equityPct}% of the price` },
          { label: "Cost of selling", value: money(proceeds.totalCosts - inputs.payoff), note: "excluding your payoff" },
          { label: "Worth fixing", value: money(paybackCost), note: `${payback.length} of ${repairs.length} items` },
          { label: "Possibly unclaimed", value: `${unclaimed.length} things`, note: "worth a phone call each" },
        ]}
      />

      {substituted.length > 0 ? (
        <div className="shell-w" style={{ marginTop: 18 }}>
          <div className="card p-4" style={{ borderColor: "var(--warn)" }}>
            <div className="t-sm w6">We substituted {substituted.join(", ")}.</div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              The link you followed carried a value we could not use, so this readout uses a
              typical Georgia figure instead. Answer the questions yourself and every number
              here becomes yours.
            </p>
          </div>
        </div>
      ) : null}

      <div className="shell-w">
        <Sec n={1} title="What actually reaches you" sub="Every valuation you have been given is a list price. This is the other end of it.">
          <Reframe r={r} />
          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            <div className="between" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-2)" }}>
              <span className="t-md w6">Sale price</span>
              <span className="num t-lg">{money(inputs.price)}</span>
            </div>
            {proceeds.costs.map((c) => (
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
              <span className="num" style={{ fontSize: 25, color: proceeds.net < 0 ? "var(--neg)" : "var(--brand-2)" }}>
                {money(proceeds.net)}
              </span>
            </div>
          </div>
          {proceeds.net < 0 ? (
            <div className="card p-4" style={{ marginTop: 12, borderColor: "var(--neg)" }}>
              <div className="t-sm w6">At this price, selling costs you money.</div>
              <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                The payoff and the cost of selling come to more than the price. That is worth
                knowing now rather than three weeks before closing — and it is a solvable
                problem more often than it looks. It is the first thing to talk through.
              </p>
            </div>
          ) : null}
          <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>{proceeds.couldBeWrong}</p>
        </Sec>

        <Sec
          n={2}
          title={`${unclaimed.length} things you may already be losing`}
          sub="These have nothing to do with selling. They are worth a call whether or not you ever list."
        >
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

        <Sec
          n={3}
          title="What to fix, and what to leave alone"
          sub={`Of ${repairs.length} things sellers commonly do, ${payback.length} tend to come back in the price.`}
        >
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20 }}>Work</th>
                    <th className="num-c">Typical cost</th>
                    <th>Verdict</th>
                    <th style={{ paddingRight: 20 }}>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((x) => (
                    <tr key={x.item}>
                      <td className="w55" style={{ paddingLeft: 20 }}>{x.item}</td>
                      <td className="num-c num">{money(x.cost)}</td>
                      <td><span className={`chip ${VERDICT[x.verdict].c}`}>{VERDICT[x.verdict].l}</span></td>
                      <td className="t-sm c-3" style={{ paddingRight: 20 }}>{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Sec>

        <Sec n={4} title="The one thing in your way">
          <BlockerCard r={r} onAsk={() => setKeep(true)} />
        </Sec>

        <Sec n={5} title="What to do, in order" sub="Most of this costs nothing and none of it commits you to selling.">
          <Steps r={r} />
        </Sec>

        <Sec n={6} title="Questions for any agent" sub="Including agents we have never met. If the answers are vague, that is the answer.">
          <Questions r={r} who="Kaleb" />
        </Sec>

        <Sec n={7} title="If you want anything more" sub="You already have all of it. Each of these is optional.">
          <Ladder v="sell" coBuyer={coDecider ? "them" : "none"} bookHref={bookHref} onKeep={() => setKeep(true)} onShare={() => setKeep(true)} />
          <div style={{ marginTop: 20 }}><TrustLadder at="preliminary" /></div>
        </Sec>
      </div>

      <ActionBar saved={saved} onKeep={() => setKeep(true)} bookHref={bookHref} />
      {keep ? (
        <Keep
          v="sell"
          coBuyer={coDecider ? "them" : undefined}
          onClose={() => setKeep(false)}
          onDone={capture}
        />
      ) : null}
    </ReadoutShell>
  );
}
