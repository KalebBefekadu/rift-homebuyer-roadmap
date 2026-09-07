"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { Trust } from "@/components/rift/Trust";
import { Verdict, Sec, Reframe, BlockerCard, Steps, Questions, Ladder, ActionBar, Keep, ReadoutShell } from "@/components/rift/Readout";
import { matchPrograms, FUNDING_LABEL, TYPE_LABEL } from "@/lib/core/registry";
import { buyerReadout } from "@/lib/core/results";
import { OWN_LABEL, type Ownership } from "@/lib/core/funnel";
import {
  BUYER_DEFAULTS, cashGap, cashToClose, gapLevers, money, monthlyComputed, range, type BuyerInputs,
} from "@/lib/core/compute";

function Results() {
  const q = useSearchParams();
  const [keep, setKeep] = useState(false);
  const [saved, setSaved] = useState(false);

  const county = q.get("c") || "DeKalb";
  const first = q.get("f") !== "0";
  const own = (q.get("o") || (first ? "none" : "primary")) as Ownership;
  const price = Number(q.get("p")) || 325_000;
  const savings = Number(q.get("s")) || 14_000;
  const monthlySaving = Number(q.get("r")) || 700;
  const timing = q.get("t") || "3 to 9 months";
  const who = q.get("w") || "none";

  const m = useMemo(() => matchPrograms({ county, firstTimeBuyer: first }), [county, first]);
  /* Assistance is deliberately NOT applied to the headline figures. It is
     shown as upside, conditional on a lender, because telling someone they
     are ready on money nobody has approved is the worst thing we could do. */
  const i: BuyerInputs = useMemo(() => ({
    ...BUYER_DEFAULTS, county, price, savings, monthlySaving, assistance: 0,
  }), [county, price, savings, monthlySaving]);

  const help = Math.round((m.openMin + m.openMax) / 2);
  const cash = useMemo(() => cashToClose(i), [i]);
  const gap = useMemo(() => cashGap(i), [i]);
  const withHelp = useMemo(() => cashGap({ ...i, assistance: help }), [i, help]);
  const levers = useMemo(() => gapLevers(i), [i]);
  const r = useMemo(() => buyerReadout(i, m, timing), [i, m, timing]);
  /* The call is about their actual blocker, not a generic slot. */
  const bookHref = `/prototype/book?v=buy&topic=${encodeURIComponent(r.blocker.title)}`;

  useTrack({ name: "readout_view", side: "buy", meta: { status: r.status } });

  const band = useMemo(
    () => [price - 40_000, price, price + 40_000].map((p) => ({ p, mo: monthlyComputed({ ...i, price: p }) })),
    [i, price],
  );

  return (
    <ReadoutShell v="buy" ask={{ what: "Cash to close, and the gap it leaves", claim: money(cash.total) }}>
      <Verdict
        r={r}
        used={`Built from ${county} County · ${OWN_LABEL[own] ?? OWN_LABEL.none} · ${money(price)} target · ${money(savings)} saved · ${money(monthlySaving)} a month`}
        glance={[
          { label: "Cash to close", value: money(cash.total), note: `not ${money(cash.down)}` },
          { label: "All-in monthly", value: money(band[1].mo.value) },
          { label: gap.gap > 0 ? "Still to find" : "Covered", value: money(gap.gap), note: gap.monthsToClose ? `~${gap.monthsToClose} months on your own` : "on your savings alone" },
          { label: "Assistance, if approved", value: m.matched.length ? range(m.usableMin, m.usableMax) : "None matched", note: m.matched.length ? (withHelp.gap <= 0 ? "would close the gap" : `would make it ~${withHelp.monthsToClose ?? 0} months`) : "on these answers" },
        ]}
      />

      <div className="shell-w">
        <Sec n={1} title="The number nobody gave you" sub="Down payment is the figure people quote. It is not the figure that has to exist.">
          <Reframe r={r} />
          <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
            {cash.lines.map((l) => (
              <div key={l.label} className="between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                <div className="row gap-2 grow">
                  <span className="t-sm w5">{l.label}</span>
                  {l.credited ? <span className="chip chip-brand">back at closing</span> : null}
                </div>
                <span className="num t-sm" style={{ opacity: l.credited ? 0.4 : 1 }}>{money(l.amount)}</span>
              </div>
            ))}
            <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
              <span className="t-md w6">What you bring</span>
              <span className="num" style={{ fontSize: 22 }}>{money(cash.total)}</span>
            </div>
          </div>
        </Sec>

        <Sec n={2}
          title={m.matched.length ? `${m.matched.length} Georgia programs may fit your answers` : "No verified program matches these answers today"}
          sub={m.matched.length ? "Named, with what each one asks of you. Estimated ranges, never approvals." : "That is not the same as nothing existing — only that we will not show you a number we cannot stand behind."}>
          {m.matched.length ? (
            <div className="col gap-2">
              {m.matched.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <div className="grow" style={{ minWidth: 220 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w6">{p.name}</span>
                        <span className={`chip ${p.funding === "open" ? "chip-pos" : p.funding === "waitlist" ? "chip-warn" : "chip-neg"}`}>
                          {FUNDING_LABEL[p.funding]}
                        </span>
                        <span className="chip">{TYPE_LABEL[p.type]}</span>
                      </div>
                      <div className="t-xs c-4" style={{ marginTop: 4 }}>{p.administrator}</div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div className="num t-lg c-brand">{range(p.min, p.max)}</div>
                      <div className="t-2xs c-4">estimated range</div>
                    </div>
                  </div>
                  <div className="col gap-1" style={{ marginTop: 12 }}>
                    {[p.incomeLimitNote, p.priceCapNote, ...p.conditions.slice(0, 2)].map((c) => (
                      <div key={c} className="row gap-2" style={{ alignItems: "flex-start" }}>
                        <Ico.check size={12} className="c-4" />
                        <span className="t-xs c-3" style={{ lineHeight: 1.5 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="row gap-2 wrap" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                    <Trust state="verified" short />
                    <span className="t-2xs c-4">
                      The programme terms were confirmed with {p.verifiedBy} on {p.verifiedOn}. Whether
                      <em> you</em> qualify is still preliminary until a lender checks your income.
                    </span>
                  </div>
                </div>
              ))}
              {m.suppressed.length ? (
                <p className="t-xs c-4" style={{ lineHeight: 1.6 }}>
                  {m.suppressed.length} further program{m.suppressed.length === 1 ? " was" : "s were"} withheld
                  because we have not re-verified {m.suppressed.length === 1 ? "it" : "them"} in 90 days. We would
                  rather show you less than show you something that has quietly changed.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="card p-5">
              <p className="t-md c-2" style={{ lineHeight: 1.6, maxWidth: 560 }}>
                Everything else on this page still holds. Your cash figure, your timeline and your
                lender questions do not depend on assistance existing.
              </p>
              <Link href="/prototype/buy/assistance" className="btn btn-s" style={{ marginTop: 14 }}>
                See every program we track <Ico.arrowR size={14} />
              </Link>
            </div>
          )}
        </Sec>

        {gap.gap > 0 ? (
          <Sec n={3} title={`${money(gap.gap)} between you and the table`} sub="And the changes that move the date most, ranked.">
            <div className="split-w">
              <div className="card p-5">
                <div className="between">
                  <span className="t-sm c-4">Needed</span><span className="num t-sm">{money(gap.cashNeeded)}</span>
                </div>
                <div className="between" style={{ marginTop: 8 }}>
                  <span className="t-sm c-4">Your savings</span><span className="num t-sm">{money(savings)}</span>
                </div>
                <div className="hr" />
                <div className="between">
                  <span className="t-md w6">Still to find</span>
                  <span className="num" style={{ fontSize: 24 }}>{money(gap.gap)}</span>
                </div>
                <div className="meter" style={{ marginTop: 14 }}>
                  <i style={{ width: `${Math.min((gap.covered / gap.cashNeeded) * 100, 100)}%`, background: "var(--brand)" }} />
                </div>
                <div className="t-xs c-4" style={{ marginTop: 8 }}>
                  {gap.monthsToClose ? `About ${gap.monthsToClose} months at ${money(monthlySaving)} a month, on your savings alone.` : "Set a monthly figure to put a date on this."}
                </div>
                {help > 0 ? (
                  <div className="tint p-3" style={{ marginTop: 14 }}>
                    <div className="between">
                      <span className="t-xs c-4">If assistance is approved</span>
                      <span className="chip chip-brand">not counted above</span>
                    </div>
                    <div className="row gap-2" style={{ alignItems: "baseline", marginTop: 5 }}>
                      <span className="num t-lg c-brand">{money(withHelp.gap)}</span>
                      <span className="t-xs c-4">
                        {withHelp.gap <= 0 ? "nothing left to find" : `left · about ${withHelp.monthsToClose ?? 0} months`}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="col gap-2">
                {levers.length ? levers.map((l, ix) => (
                  <div key={l.label} className="card p-4 between gap-3">
                    <div className="grow">
                      <div className="row gap-2">
                        {ix === 0 ? <span className="chip chip-brand">Biggest</span> : null}
                        <span className="t-md w55">{l.label}</span>
                      </div>
                      <p className="t-xs c-3" style={{ marginTop: 5, lineHeight: 1.55 }}>{l.detail}</p>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div className="num t-lg c-pos">−{l.saved}</div>
                      <div className="t-2xs c-4">months</div>
                    </div>
                  </div>
                )) : (
                  <div className="card p-4"><p className="t-sm c-3">Steady saving is the shortest path from here.</p></div>
                )}
              </div>
            </div>
          </Sec>
        ) : null}

        <Sec n={gap.gap > 0 ? 4 : 3} title="What it costs each month, across the band" sub="Three price points, all-in, so you can see the shape of the trade rather than one number.">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr>
                  <th style={{ paddingLeft: 20 }}>Price</th><th className="num-c">Principal + interest</th>
                  <th className="num-c">Taxes + insurance</th><th className="num-c">Mortgage insurance</th>
                  <th className="num-c" style={{ paddingRight: 20 }}>All in</th>
                </tr></thead>
                <tbody>
                  {band.map(({ p, mo }) => (
                    <tr key={p} style={p === price ? { background: "var(--brand-wash)" } : undefined}>
                      <td className="w55" style={{ paddingLeft: 20 }}>
                        {money(p)} {p === price ? <span className="chip chip-brand" style={{ marginLeft: 6 }}>Yours</span> : null}
                      </td>
                      <td className="num-c num">{money(mo.parts.pi)}</td>
                      <td className="num-c num">{money(mo.parts.tax + mo.parts.insurance)}</td>
                      <td className="num-c num">{money(mo.parts.pmi)}</td>
                      <td className="num-c num w6" style={{ paddingRight: 20 }}>{money(mo.parts.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 640 }}>
            {band[1].mo.couldBeWrong}
          </p>
        </Sec>

        <Sec n={gap.gap > 0 ? 5 : 4} title="The one thing in your way">
          <BlockerCard r={r} onAsk={() => setKeep(true)} />
        </Sec>

        <Sec n={gap.gap > 0 ? 6 : 5} title="What to do, in order" sub="Nothing here requires us. Most of it does not even require money.">
          <Steps r={r} />
        </Sec>

        <Sec n={gap.gap > 0 ? 7 : 6} title="Questions for any lender" sub="Take them to two lenders, not one. The second conversation is where the first one gets tested.">
          <Questions r={r} who="Kaleb" />
        </Sec>

        <Sec n={gap.gap > 0 ? 8 : 7} title="If you want anything more" sub="You are already done. Each of these is optional and none of them takes anything back.">
          <Ladder v="buy" coBuyer={who} bookHref={bookHref} onKeep={() => setKeep(true)} onShare={() => setKeep(true)} />
        </Sec>
      </div>

      <ActionBar saved={saved} onKeep={() => setKeep(true)} bookHref={bookHref} />

      {keep ? (
        <Keep v="buy" coBuyer={who} onClose={() => setKeep(false)}
          onDone={() => { track({ name: "email_capture", side: "buy" }); setSaved(true); setKeep(false); }} />
      ) : null}
    </ReadoutShell>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="shell-w sec"><p className="t-sm c-4">Working out your numbers…</p></div>}><Results /></Suspense>;
}
