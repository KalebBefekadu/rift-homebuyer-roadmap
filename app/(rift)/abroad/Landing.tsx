"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { useTrack, useCaptureTouch, track } from "@/lib/rift/track";
import { money } from "@/lib/core/compute";
import {
  abroadReturns, breakEvenDownPct, statusById, STATUSES, ASSUMPTIONS, ABROAD_DEFAULTS,
  type StatusId, type Use,
} from "@/lib/core/abroad";

/**
 * Buying Georgia property from abroad.
 *
 * The buyer page sells a number nobody gave you. This page sells a permission
 * nobody gave you: that you are allowed to do this at all. Ask anyone in Addis
 * or Dubai whether a foreign national can own a house in Georgia outright and
 * most will guess no, or guess there is a visa involved. There isn't. The
 * single most valuable thing this page does is say so in the first line.
 *
 * The second is to refuse the industry's slogan. "As little as 10% down" is
 * true for some readers and false for most, and a reader who sends documents
 * on the strength of it and is then asked for 30% has been wasted — which is
 * the specific injury this whole product exists to prevent. So the hero asks
 * which of four situations they are in and shows that situation's real number,
 * including the one that is bad news. Being the only page that tells them the
 * unflattering version is the reason they come back.
 */

const USES: { id: Use; label: string; note: string }[] = [
  { id: "rent", label: "Rent it out", note: "Income now, someone else paying the loan down" },
  { id: "live", label: "Live in it later", note: "A place to return to, or for family here now" },
];

export function Landing({ counties }: { counties: string[] }) {
  const [price, setPrice] = useState(ABROAD_DEFAULTS.price);
  const [county, setCounty] = useState(ABROAD_DEFAULTS.county);
  const [status, setStatus] = useState<StatusId>(ABROAD_DEFAULTS.status);
  const [use, setUse] = useState<Use>(ABROAD_DEFAULTS.use);
  /* Null means "the minimum for my situation", so changing status moves the
     slider with it instead of stranding a number that no longer applies. */
  const [extraDown, setExtraDown] = useState<number | null>(null);

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "buy", meta: { page: "abroad" } });

  const s = statusById(status);
  const minDown = s.down[use];
  const downPct = Math.max(extraDown ?? minDown, minDown);
  const input = { price, county, status, use, downPct };
  const r = useMemo(() => abroadReturns(input), [price, county, status, use, downPct]);
  const breakEven = useMemo(() => breakEvenDownPct(input), [price, county, status, use]);
  const answered = (qid: string) => track({ name: "hero_answer", side: "buy", meta: { qid, page: "abroad" } });

  const go = `/buy/start?c=${encodeURIComponent(county)}&o=none&from=abroad`;

  return (
    <div className="buy">
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/abroad" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">From abroad</span>
          </Link>
          <div className="row gap-3">
            <Link href="/buy" className="t-sm c-2 hide-sm">Buying to live here</Link>
            <Link href="/book?v=abroad" className="btn btn-p btn-sm">Talk to Kaleb</Link>
          </div>
        </div>
      </header>

      <main>
        {/* The permission, then the number. In that order, because most readers
            do not yet believe the first one. */}
        <section className="shell-w">
          <div style={{ paddingTop: "clamp(34px,5vw,64px)", maxWidth: 780 }}>
            <h1 className="serif" style={{ fontSize: "clamp(32px,4.6vw,56px)", lineHeight: 1.06, letterSpacing: "-0.028em" }}>
              You don&apos;t need a green card to own property in Georgia.
            </h1>
            <p className="lede" style={{ marginTop: 16, maxWidth: 560 }}>
              No citizenship, no visa, no U.S. address, and no requirement to have set foot
              here. What you do need is a real number before you send anyone a document —
              and the honest one depends on which of these you are.
            </p>
          </div>

          <div className="ans" style={{ marginTop: 28, maxWidth: 940 }}>
            <div className="ans-in">
              <div className="field" style={{ marginBottom: 18 }}>
                <span className="label">Where you stand today</span>
                <div className="col gap-2" style={{ marginTop: 8 }}>
                  {STATUSES.map((x) => (
                    <label key={x.id} className="opt" data-on={status === x.id}>
                      <input type="radio" name="status" checked={status === x.id}
                        onChange={() => { setStatus(x.id); answered("status"); }} />
                      <span>
                        <span className="t-sm w55">{x.label}</span>
                        <span className="t-xs c-4" style={{ display: "block", marginTop: 2, lineHeight: 1.5 }}>{x.note}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <span className="label">What you&apos;d do with it</span>
                <div className="g2 gap-2" style={{ marginTop: 8 }}>
                  {USES.map((u) => (
                    <label key={u.id} className="opt" data-on={use === u.id}>
                      <input type="radio" name="use" checked={use === u.id}
                        onChange={() => { setUse(u.id); answered("use"); }} />
                      <span>
                        <span className="t-sm w55">{u.label}</span>
                        <span className="t-xs c-4" style={{ display: "block", marginTop: 2, lineHeight: 1.5 }}>{u.note}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="g2 gap-4" style={{ alignItems: "end" }}>
                <label className="field">
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="label" style={{ margin: 0 }}>Purchase price</span>
                    <span className="num t-sm">{money(price)}</span>
                  </div>
                  <input className="rng" type="range" min={120_000} max={750_000} step={5_000}
                    value={price} onChange={(e) => { setPrice(Number(e.target.value)); answered("price"); }} />
                </label>
                <label className="field">
                  <span className="label">County</span>
                  <select className="select" value={county}
                    onChange={(e) => { setCounty(e.target.value); answered("county"); }}>
                    {counties.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <label className="field" style={{ marginTop: 16 }}>
                <div className="between" style={{ marginBottom: 5 }}>
                  <span className="label" style={{ margin: 0 }}>Down payment</span>
                  <span className="num t-sm">
                    {downPct}% · {money(r.down)}
                  </span>
                </div>
                <input className="rng" type="range" min={minDown} max={60} step={1}
                  value={downPct} onChange={(e) => { setExtraDown(Number(e.target.value)); answered("down"); }} />
                <span className="t-xs c-4" style={{ marginTop: 6, display: "block", lineHeight: 1.5 }}>
                  {minDown}% is the least a lender will take in your situation.
                  {breakEven !== null
                    ? ` At ${breakEven}% the rent covers everything and the house pays for itself.`
                    : use === "rent"
                      ? " At this price no down payment makes the rent cover the costs — a cheaper house or a different county will."
                      : ""}
                </span>
              </label>
            </div>

            <div className="ans-out">
              <div className="between wrap gap-4" style={{ alignItems: "flex-end" }}>
                <div>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                    What you&apos;d have to send, all in
                  </div>
                  <div className="ans-num" style={{ marginTop: 8 }}>{money(r.cashIn)}</div>
                  <div className="t-sm" style={{ marginTop: 12, color: "rgba(255,255,255,.6)" }}>
                    {r.downPct}% down · {money(r.closing)} closing · about {r.ratePct.toFixed(2)}% on {money(r.loan)}
                  </div>
                </div>
                <Link href={go} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                  Work this out properly <Ico.arrowR size={16} />
                </Link>
              </div>

              {use === "rent" ? (
                <div className="g3 gap-3" style={{ marginTop: 26, borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 20 }}>
                  {[
                    ["Rent, estimated", money(r.rent), `${county} County, at this price`],
                    [
                      r.cashFlow >= 0 ? "Left over each month" : "Short each month",
                      `${r.cashFlow < 0 ? "−" : ""}${money(Math.abs(r.cashFlow))}`,
                      "After the loan, tax, insurance, management and vacancy",
                    ],
                    ["Year one, all in", money(r.year1.total), `${r.returnPct.toFixed(1)}% of what you sent`],
                  ].map(([t, v, n]) => (
                    <div key={t}>
                      <div className="t-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t}</div>
                      <div className="num" style={{ fontSize: 24, color: "#fff", marginTop: 5 }}>{v}</div>
                      <div className="t-xs" style={{ color: "rgba(255,255,255,.45)", marginTop: 4, lineHeight: 1.5 }}>{n}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 22, borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 18 }}>
                  <div className="t-sm" style={{ color: "rgba(255,255,255,.72)", maxWidth: 560, lineHeight: 1.6 }}>
                    Held empty for your own use it costs {money(r.monthly.total)} a month and
                    earns nothing — but {money(r.year1.principal)} of the first year&apos;s
                    payments is principal, which is yours, not the bank&apos;s.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4" style={{ marginTop: 16, maxWidth: 940, background: "var(--sunk)" }}>
            <div className="row gap-2" style={{ alignItems: "flex-start" }}>
              <Ico.alert size={15} className="c-brand" style={{ flex: "none", marginTop: 2 }} />
              <div>
                <div className="t-sm w6">What a lender will ask you for</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.6 }}>{s.asks}</p>
              </div>
            </div>
          </div>

          <p className="t-xs c-4" style={{ marginTop: 14, maxWidth: 700, lineHeight: 1.6 }}>
            Planning estimates, not a loan approval or a rent guarantee. Down payments and
            rates come from what lenders in this market publish for each situation — your own
            lender&apos;s terms decide. Rent is estimated from county averages, not from a
            specific property.
          </p>
        </section>

        {/* Why here. Four reasons, and the first one is the real one. */}
        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <div className="kicker c-brand">Why Georgia, and why now</div>
              <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,36px)", letterSpacing: "-0.02em", maxWidth: 420, lineHeight: 1.14, marginTop: 12 }}>
                One asset, priced in dollars, that four things pay you at once.
              </h2>
              <p className="t-md c-3" style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 400 }}>
                Most people abroad hold everything in one currency and one country. A house in
                Georgia is neither — and unlike money moved into a foreign account, it works
                while it sits.
              </p>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {([
                [Ico.wallet, "A tenant pays the loan down",
                  `About ${money(r.year1.principal)} of the first year's payments is principal. You didn't pay it — the rent did — and it's yours.`],
                [Ico.chart, "Appreciation on the whole house, not your share",
                  `At ${ASSUMPTIONS.appreciationPct}% the house gains about ${money(r.year1.appreciation)} a year. You put in ${money(r.cashIn)}. The gain is on ${money(price)}.`],
                [Ico.spark, "Income in the currency you want to be paid in",
                  "Rent arrives monthly in dollars, into a U.S. account, whatever is happening to the currency where you live."],
                [Ico.doc, "A title that doesn't depend on who you know",
                  "Georgia deeds are public record and searchable. Ownership is a document, not a relationship you have to maintain from abroad."],
              ] as const).map(([Icon, t, b], i, arr) => (
                <div key={t} className="row gap-3" style={{
                  padding: "14px 18px", alignItems: "flex-start",
                  borderBottom: i === arr.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <Icon size={16} className="c-brand" style={{ marginTop: 2, flex: "none" }} />
                  <div>
                    <div className="t-md w55">{t}</div>
                    <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The objections, answered before they're raised. */}
        <section className="shell-w sec">
          <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em", maxWidth: 560 }}>
            The questions everyone asks, answered before you have to ask them.
          </h2>
          <div className="g2 gap-3" style={{ marginTop: 24 }}>
            {[
              ["Do I have to come to America to close?",
                "No. Closings are done remotely through a Georgia closing attorney, with documents notarised at a U.S. embassy or consulate, or by an approved remote notary. Plenty of owners have never seen the house."],
              ["Who looks after it when I'm 8,000 miles away?",
                `A licensed property manager, at about ${ASSUMPTIONS.managementPct}% of rent — already taken out of the figure above. They screen the tenant, collect the rent, and handle the 2 a.m. call.`],
              ["What about U.S. tax?",
                "You file a U.S. return on the rental income, and depreciation usually shelters most of it in the early years. When you sell, a withholding rule called FIRPTA applies. Neither is a reason not to do this, and both need a cross-border accountant, not an agent."],
              ["Can I get the money out again?",
                "Yes. There is no restriction on a foreign owner selling and repatriating the proceeds. The constraint is the market, the same as it is for anyone."],
              ["Is this the right time to buy?",
                "Sometimes the answer is no. Rates are high and the cash-flow maths is tighter than it was three years ago, which is exactly why the panel above shows you a negative number when it is one."],
              ["Why you?",
                "Kaleb is a licensed Georgia agent who works with buyers abroad and speaks Amharic. Everything on this page is free and yours whether or not you ever call."],
            ].map(([q, a]) => (
              <div key={q} className="card p-4">
                <div className="t-md w6">{q}</div>
                <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.65 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Three doors at three commitment levels. */}
        <section className="shell-w sec">
          <div className="card" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className="serif" style={{ fontSize: "clamp(23px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 560 }}>
              Nothing here is held back until you sign up.
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
              No account, no passport scan, and nothing sent to a lender until you decide to.
            </p>
            <div className="g3 gap-3" style={{ marginTop: 26 }}>
              {[
                { t: "Work out my numbers", b: "The full readout — cash needed, monthly cost, and what it would rent for.", cta: "Start", href: go, primary: true },
                { t: "Talk to someone who's done it", b: "Fifteen minutes with Kaleb, in English or Amharic, at a time that works where you are.", cta: "See open times", href: "/book?v=abroad", primary: false },
                { t: "I might live here instead", b: "If you'll be living in the house, the Georgia assistance programs may apply to you.", cta: "Buying to live here", href: "/buy", primary: false },
              ].map((d) => (
                <div key={d.t} className="col" style={{ justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="t-lg w6" style={{ color: "#fff" }}>{d.t}</div>
                    <p style={{ marginTop: 7, color: "rgba(255,255,255,.62)", fontSize: 14, lineHeight: 1.55 }}>{d.b}</p>
                  </div>
                  <Link href={d.href} className="btn" style={
                    d.primary
                      ? { background: "#fff", color: "var(--ink)", width: "100%" }
                      : { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.24)", width: "100%" }
                  }>{d.cta} <Ico.arrowR size={15} /></Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 48 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <div className="between wrap gap-4" style={{ alignItems: "flex-start" }}>
              <div style={{ maxWidth: 400 }}>
                <Link href="/abroad" className="row gap-2">
                  <Mark size={18} />
                  <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
                </Link>
                <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
                  Rift for buyers abroad. Guided by Kaleb Befekadu, a licensed agent in Georgia.
                  Every figure is a planning estimate, not a lending commitment, approval, or
                  valuation. We are not tax advisors or immigration attorneys, and we tell you
                  when a question belongs to one.
                </p>
              </div>
              <div className="row gap-4" style={{ alignItems: "flex-start" }}>
                <div className="col gap-2">
                  <div className="kicker c-4">This product</div>
                  <Link href="/buy/start" className="t-sm c-3">Start</Link>
                  <Link href="/buy/how" className="t-sm c-3">How it works</Link>
                  <Link href="/buy" className="t-sm c-3">Buying to live here</Link>
                </div>
                <div className="col gap-2">
                  <div className="kicker c-4">Rift</div>
                  <Link href="/book?v=abroad" className="t-sm c-3">Book fifteen minutes</Link>
                  <Link href="/sell" className="t-sm c-3">Selling instead?</Link>
                  <Link href="/studio" className="t-sm c-3">Sign in</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
