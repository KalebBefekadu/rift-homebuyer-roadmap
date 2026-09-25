import type { Metadata } from "next";
import Link from "next/link";
import { money, range, sellerNet, SELLER_DEFAULTS } from "@/lib/core/compute";
import { waysIn } from "@/lib/core/values";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { LandingTrack } from "@/components/rift/site/LandingTrack";
import { ProceedsFlow } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What would selling your Georgia home really leave you?",
  description:
    "The list price is not the number. See what you would keep after the loan payoff and every cost of selling, what selling costs line by line, and money you may be losing already.",
};

/* Nothing here depends on program data or a rate: arithmetic on published
   Georgia rates, so it can be cached hard. */
export const revalidate = 86400;

const ICON = { proceeds: Ico.wallet, unclaimed: Ico.gift, costs: Ico.scale, prepare: Ico.home } as const;

/**
 * The seller landing (Blueprint v5 §5.3, the same lens as §5.7).
 *
 * The mirror of the buyer thesis: the list price is not the number. It used
 * to be one set of sliders feeding one long questionnaire; now it offers each
 * seller value as its own way in, in D20 order, on the same grid and with the
 * same one header and footer as the buyer side.
 *
 * The example below leaves commission unagreed, so it shows a range: a
 * landing that picked one rate would be quoting a standard rate (MONEY-06).
 */
export default function SellLanding() {
  const values = waysIn("sell");
  const r = sellerNet(SELLER_DEFAULTS.price, SELLER_DEFAULTS.payoff, null);
  /* The example is fixed and positive today, but it reads the defaults, and
     a default changed to a sale below the payoff must not print a debt under
     words written for money arriving (lib/core/announce.test.ts). */
  const underwater = (r.netLow ?? r.net) < 0;

  return (
    <div className="sell">
      <LandingTrack side="sell" />
      <SiteHeader side="sell" current="/sell" action={{ href: "/book?v=sell", label: "Book a call" }} />

      <main className="shell-w">
        <section className="sec ctr">
          <div className="kicker c-brand">For sellers in Georgia</div>
          <h1 className="serif d1 mt-3" style={{ maxWidth: 900, margin: "16px auto 0" }}>
            What would selling really leave you?
          </h1>
          <p className="lede mt-4 measure">
            Start with the question you have. Each answer takes a minute and is worked out from your own
            numbers, not a list price.
          </p>
        </section>

        {/* Three values, three across: a 2 by 2 grid left the fourth cell empty (§4.1). */}
        <section className={`sec-sm ${values.length === 3 ? "trio" : "pair"}`} aria-label="Questions you can answer">
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
                <h2 className="serif" style={{ fontSize: 25, lineHeight: 1.15, letterSpacing: "-0.018em" }}>{v.question}</h2>
                <p className="t-md c-3 grow" style={{ lineHeight: 1.55 }}>{v.gives}</p>
                {/* One primary action per view (§4.4): the first value carries it. */}
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
            <h2 id="other-h" className="serif d3 mt-3">You&apos;ve been told a price. That&apos;s not what you keep.</h2>
            <p className="t-md c-2 mt-3" style={{ lineHeight: 1.65 }}>
              On a {money(SELLER_DEFAULTS.price)} sale with {money(SELLER_DEFAULTS.payoff)} still owed,{" "}
              {underwater
                ? <>the costs of selling take it below what is owed, and the difference is brought to closing.</>
                : <>what reaches you is {range(r.netLow ?? r.net, r.net)}.</>}{" "}
              Any range is the commission, which you negotiate: there is no standard rate.
            </p>
            <div className="cta-row mt-4">
              <Link href="/sell/proceeds" className="btn btn-brand btn-lg">See what I&apos;d keep<Ico.arrowR size={15} /></Link>
            </div>
          </div>
          <figure className="art-box">
            <ProceedsFlow price={SELLER_DEFAULTS.price} parts={[{ label: "Loan payoff", amount: SELLER_DEFAULTS.payoff }, { label: "Selling costs", amount: r.total }]} net={r.net} />
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
