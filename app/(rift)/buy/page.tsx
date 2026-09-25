import type { Metadata } from "next";
import Link from "next/link";
import { matchForVisitor } from "@/lib/db/match";
import { money, cashToClose, BUYER_DEFAULTS } from "@/lib/core/compute";
import { valuesFor } from "@/lib/core/values";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { LandingTrack } from "@/components/rift/site/LandingTrack";
import { CashStack } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What will buying a home in Georgia really take?",
  description:
    "The down payment is not the number. Check the Georgia programs that may help you, your real cash to close, your monthly cost and when you could buy, from your own numbers.",
};

/* The program count below is live registry data; an hour is short enough to
   be honest and long enough to be cheap. */
export const revalidate = 3600;

const ICON = { assistance: Ico.spark, cash: Ico.wallet, monthly: Ico.cal, timeline: Ico.clock } as const;

/**
 * The buyer landing (Blueprint v5 §5.7, Kaleb R1).
 *
 * Several ways in, one per value, instead of one hero leading with assistance
 * alone. Every block is centred on the same grid, and the two-column section
 * uses `.pair`, whose columns stretch to the same height, so the short side
 * never leaves the empty space the old "Seven minutes" section had (D3).
 * Moving is gone from "what you bring" (D4): it is not paid at closing.
 */
export default async function BuyLanding() {
  const { match } = await matchForVisitor("DeKalb", true);
  const cash = cashToClose({ ...BUYER_DEFAULTS, assistance: 0 });
  const values = valuesFor("buy");

  return (
    <div className="buy">
      <LandingTrack side="buy" meta={{ matched: match.matched.length }} />
      <SiteHeader side="buy" current="/buy" action={{ href: "/book?v=buy", label: "Book a call" }} />

      <main className="shell-w">
        <section className="sec ctr">
          <div className="kicker c-brand">For buyers in Georgia</div>
          <h1 className="serif d1 mt-3" style={{ maxWidth: 900, margin: "16px auto 0" }}>
            What will buying a home really take?
          </h1>
          <p className="lede mt-4 measure">
            Start with the question you have. Each answer takes a minute or two and is worked out from
            your own numbers.
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
            <h2 id="other-h" className="serif d3 mt-3">You&apos;ve been told the down payment. That&apos;s not what you need.</h2>
            <p className="t-md c-2 mt-3" style={{ lineHeight: 1.65 }}>
              On a {money(BUYER_DEFAULTS.price)} home the down payment at 3.5% is {money(cash.down)}. The
              cash you actually bring is {money(cash.total)}, and that difference is what breaks most
              purchases in the last three weeks.
            </p>
            <div className="cta-row mt-4">
              <Link href="/buy/cash-to-close" className="btn btn-brand btn-lg">See my cash to close<Ico.arrowR size={15} /></Link>
            </div>
          </div>
          <figure className="art-box"><CashStack lines={cash.lines} total={cash.total} down={cash.down} /></figure>
        </section>

        <section className="sec">
          <div className="card p-6 between wrap gap-4">
            <div className="measure">
              <div className="kicker c-brand">Georgia programs</div>
              <h2 className="t-xl serif mt-2">{match.matched.length > 0 ? `${match.matched.length} programs may apply in DeKalb County alone.` : "Every program we check, in one table."}</h2>
              <p className="t-md c-3 mt-2" style={{ lineHeight: 1.6 }}>
                Down payment help from the state, counties, cities and lenders, each with its official source
                and the date it was last checked. Filter and sort them yourself.
              </p>
            </div>
            <Link href="/buy/programs" className="btn btn-s btn-lg">See Georgia programs</Link>
          </div>
        </section>

        <section className="sec ctr">
          <h2 className="serif d3">Rather talk it through?</h2>
          <p className="lede mt-3 measure">A short call with Kaleb, at a time that suits you. No obligation, and it costs you nothing.</p>
          <div className="cta-row mt-4"><Link href="/book?v=buy" className="btn btn-s btn-lg">Book a call</Link></div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
