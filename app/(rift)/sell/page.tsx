import type { Metadata } from "next";
import Link from "next/link";
import { money, SELLER_DEFAULTS } from "@/lib/core/compute";
import { sellerNet } from "@/lib/core/seller";
import { valuesFor } from "@/lib/core/values";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { LandingTrack } from "@/components/rift/site/LandingTrack";
import { ProceedsBar } from "@/components/rift/value/artifacts";
import { ValueArt } from "@/components/rift/value/ValueArt";

export const metadata: Metadata = {
  title: "Know what selling actually leaves you",
  description:
    "The list price is not the number. See what reaches you after your loan, commission and every Georgia cost of selling, what you may be missing already, and what to fix first. Free, before you talk to anyone.",
};

/* Nothing here depends on program data or a rate. */
export const revalidate = 86400;

const ICON = { proceeds: Ico.wallet, unclaimed: Ico.spark, costs: Ico.chart, prepare: Ico.home } as const;

/**
 * The seller landing (Blueprint v5 §5.3: the same lens as the buyer side).
 *
 * The values as separate ways in, in D20 order, instead of one slider panel
 * leading into one long questionnaire. The example is computed, and its
 * commission is left out rather than set to a rate we chose (MONEY-06): the
 * sentence says so.
 */
export default function SellLanding() {
  const values = valuesFor("sell");
  const r = sellerNet({ price: SELLER_DEFAULTS.price, payoff: SELLER_DEFAULTS.payoff, county: SELLER_DEFAULTS.county, commissionPct: null });
  /* The example is fixed and positive, but the wording is still guarded: a
     shortfall must never be described as money arriving (announce.test.ts). */
  const underwater = r.net < 0;

  return (
    <div className="sell">
      <LandingTrack side="sell" />
      <SiteHeader side="sell" current="/sell" action={{ href: "/book?v=sell", label: "Book a call" }} />

      <main className="shell-w">
        <section className="sec ctr">
          <div className="kicker c-brand">For sellers in Georgia</div>
          <h1 className="serif d1 mt-3" style={{ maxWidth: 900, margin: "16px auto 0" }}>
            What would selling actually leave you?
          </h1>
          <p className="lede mt-4 measure">
            Start with the question you have. Each answer takes a minute and is worked out from your own numbers.
          </p>
        </section>

        <section className="sec-sm pair" aria-label="Questions you can answer">
          {values.map((v, k) => {
            const Icon = ICON[v.id as keyof typeof ICON] ?? Ico.spark;
            return (
              <Link key={v.id} href={v.href} className="card p-6 lift value-card"
                style={k === 0 ? { borderColor: "var(--brand-line)", background: "var(--brand-wash)" } : undefined}>
                <div className="row gap-2">
                  <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: k === 0 ? "var(--paper)" : "var(--brand-wash)" }}>
                    <Icon size={17} className="c-brand" />
                  </span>
                  <span className="kicker c-brand">{v.name}</span>
                </div>
                <ValueArt id={v.id} style={{ maxWidth: 180 }} />
                <h2 className="serif" style={{ fontSize: 25, lineHeight: 1.15, letterSpacing: "-0.018em" }}>{v.question}</h2>
                <p className="t-md c-3 grow" style={{ lineHeight: 1.55 }}>{v.gives}</p>
                {k === 0
                  ? <span className="btn btn-brand" style={{ alignSelf: "flex-start" }}>{v.cta}<Ico.arrowR size={15} /></span>
                  : <span className="row gap-1 t-md w6 c-brand">{v.cta}<Ico.arrowR size={15} /></span>}
              </Link>
            );
          })}
        </section>

        <section className="sec pair" style={{ alignItems: "center" }} aria-labelledby="other-h">
          <div>
            <div className="kicker c-brand">The other number</div>
            <h2 id="other-h" className="serif d3 mt-3">The list price is not what you keep.</h2>
            <p className="t-md c-2 mt-3" style={{ lineHeight: 1.65 }}>
              On a {money(SELLER_DEFAULTS.price)} sale with {money(SELLER_DEFAULTS.payoff)} still owed, the loan and the
              Georgia costs of selling come to {money(SELLER_DEFAULTS.payoff + r.costs.total)}
              {underwater ? `, which is more than the price.` : `, leaving ${money(r.net)} before commission.`}{" "}
              Commission is yours to agree, and each 1% is {money(r.costs.perPoint)}.
            </p>
            <div className="cta-row mt-4">
              <Link href="/sell/proceeds" className="btn btn-brand btn-lg">See what I&apos;d keep<Ico.arrowR size={15} /></Link>
            </div>
          </div>
          <figure className="art-box">
            {/* One bar, two cuts (manual review WS3.3, WS5.3). The cost lines
                one by one are in the selling-costs value. */}
            <ProceedsBar price={SELLER_DEFAULTS.price} net={r.net} parts={[{ label: "Loan payoff", amount: SELLER_DEFAULTS.payoff }, { label: "Selling costs", amount: r.costs.total }]} />
          </figure>
        </section>

        <section className="sec ctr">
          <h2 className="serif d3">Rather talk it through?</h2>
          <p className="lede mt-3 measure">A short call with Kaleb, at a time that suits you. No obligation, and it costs you nothing.</p>
          <div className="cta-row mt-4"><Link href="/book?v=sell" className="btn btn-s btn-lg">Book a call</Link></div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
