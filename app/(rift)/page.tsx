import type { Metadata } from "next";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { AgentSchema } from "@/components/rift/Agent";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { ProceedsBar } from "@/components/rift/value/artifacts";
import { CashBreakdown } from "@/components/rift/value/CashBreakdown";
import { ValueArt } from "@/components/rift/value/ValueArt";
import { money, cashToClose, BUYER_DEFAULTS, SELLER_DEFAULTS } from "@/lib/core/compute";
import { sellerNet } from "@/lib/core/seller";
import { valueById, valuesFor } from "@/lib/core/values";

export const metadata: Metadata = {
  title: "Know the real number before you talk to anyone",
  description:
    "Buying or selling a home in Georgia: what it actually takes, worked out from your own numbers. Free, and yours to keep.",
};

/* Both figures are arithmetic on published Georgia rates, so a day is safe. */
export const revalidate = 86400;

/**
 * The front door (Blueprint v5 §5.7, Kaleb R1).
 *
 * Buying and selling side by side, each with its own drawing built from the
 * same engine the values use, so the number here cannot drift from the number
 * one click later. The three "trust points" are gone ("just useless"); what
 * replaces them is the list of questions each side can answer, which says
 * what this is by showing it. The footer note about cost and commission went
 * with the 5 October review (decision D3); /privacy still says how Kaleb is paid.
 */
export default function HomePage() {
  const buy = cashToClose({ ...BUYER_DEFAULTS, assistance: 0 });
  /* Commission left out, never set to a rate we chose (MONEY-06); the
     caption says so. Moving is not a cost of the sale. */
  const sell = sellerNet({ price: SELLER_DEFAULTS.price, payoff: SELLER_DEFAULTS.payoff, county: SELLER_DEFAULTS.county, commissionPct: null });
  const sellParts = [
    { label: "Loan payoff", amount: SELLER_DEFAULTS.payoff },
    { label: "Selling costs", amount: sell.costs.total },
  ];

  return (
    <div className="buy">
      <AgentSchema />
      <SiteHeader side="home" />

      <main className="shell-w">
        <section className="sec ctr">
          <h1 className="serif d1" style={{ maxWidth: 860, margin: "0 auto" }}>
            Know the real number before you talk to anyone.
          </h1>
          <p className="lede mt-4 measure">
            Most people find out what a move really costs three weeks before closing. Here you can
            work it out first, from your own numbers, in a couple of minutes.
          </p>
        </section>

        <section className="sec-sm pair" aria-label="Buying or selling">
          <Door
            tone="buy"
            kicker="I'm buying"
            title="The down payment is not the number."
            figure={money(buy.total)}
            caption={`Cash you need for a ${money(BUYER_DEFAULTS.price)} home: more than the ${money(buy.down)} down payment.`}
            art={<CashBreakdown lines={buy.lines} total={buy.total} down={buy.down} />}
            href="/buy"
            cta="See what buying will cost me"
            questions={valuesFor("buy").map((v) => ({ href: v.href, label: v.question }))}
          />
          <Door
            tone="sell"
            kicker="I'm selling"
            title="The sale price is not the number either."
            figure={money(sell.net)}
            caption={`What you keep from a ${money(SELLER_DEFAULTS.price)} sale after the loan and selling costs (before any commission).`}
            art={<ProceedsBar price={SELLER_DEFAULTS.price} parts={sellParts} net={sell.net} />}
            href="/sell"
            cta="See what I'd walk away with"
            questions={valuesFor("sell").map((v) => ({ href: v.href, label: v.question }))}
          />
        </section>

        <section className="sec" aria-labelledby="more-h">
          <h2 id="more-h" className="serif d3 ctr">More you can work out here</h2>
          <div className="trio mt-4">
            {MORE.map((c) => (
              <Link key={c.href} href={c.href} className={`card p-5 lift value-card ${c.tone}`}>
                <ValueArt id={c.art} style={{ margin: "0 auto 4px" }} />
                <div className="kicker c-brand">{c.kicker}</div>
                <div className="t-xl serif">{c.title}</div>
                <p className="t-sm c-3 grow" style={{ lineHeight: 1.6 }}>{c.body}</p>
                <span className="row gap-1 t-sm w6 c-brand">{c.cta}<Ico.arrowR size={14} /></span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/* Manual review WS3.7: two buyer values, two seller values, Equb and abroad,
   each with its own drawing. The links come from the value catalogue, so a
   card cannot point at a tool that was renamed or removed. */
const MORE = [
  { art: "cash", tone: "buy", kicker: "Buying", title: "Cash to close", body: "Everything you bring on closing day, not just the down payment.", href: valueById("cash")!.href, cta: "Work out my cash" },
  { art: "assistance", tone: "buy", kicker: "Buying", title: "Georgia down payment help", body: "Programs from the state, counties, cities and lenders that may help you buy.", href: valueById("assistance")!.href, cta: "Check what may help" },
  { art: "proceeds", tone: "sell", kicker: "Selling", title: "What you'd walk away with", body: "Your sale price, less the loan and the costs of selling.", href: valueById("proceeds")!.href, cta: "Work out what I keep" },
  { art: "unclaimed", tone: "sell", kicker: "Own a home", title: "Money you may be missing", body: "Homestead and senior exemptions and tax appeals, whether or not you ever move.", href: valueById("unclaimed")!.href, cta: "Check what I may be missing" },
  { art: "equb", tone: "equb", kicker: "Save together", title: "Equb for your down payment", body: "A group savings plan, the way families have always done it, aimed at a home.", href: "/equb", cta: "See how Equb works" },
  { art: "eligibility", tone: "abroad", kicker: "Living abroad", title: "Own a home in the United States", body: "You don't need citizenship, a green card or a visa, and you don't need to be here to close.", href: "/abroad", cta: "Check if I can buy" },
] as const;

function Door({ tone, kicker, title, figure, caption, art, href, cta, questions }: {
  tone: "buy" | "sell";
  kicker: string;
  title: string;
  figure: string;
  caption: string;
  art: React.ReactNode;
  href: string;
  cta: string;
  questions: { href: string; label: string }[];
}) {
  return (
    <article className={`card p-6 ${tone}`} style={{ display: "flex", flexDirection: "column" }}>
      <div className="kicker c-brand">{kicker}</div>
      <h2 className="serif t-xl mt-2" style={{ fontSize: 26, lineHeight: 1.15 }}>{title}</h2>
      <figure className="mt-4" style={{ aspectRatio: "360 / 300", display: "grid", alignItems: "center" }}>{art}</figure>
      <div className="num mt-3" style={{ fontSize: "clamp(30px,4vw,40px)", color: "var(--brand-2)" }}>{figure}</div>
      <p className="t-sm c-3 mt-1" style={{ lineHeight: 1.6 }}>{caption}</p>
      <ul className="col mt-4" style={{ flexGrow: 1 }}>
        {questions.map((q) => (
          <li key={q.href} style={{ borderTop: "1px solid var(--line-3)" }}>
            <Link href={q.href} className="between t-sm" style={{ padding: "10px 0" }}>
              <span className="c-2">{q.label}</span><Ico.chevR size={13} className="c-4" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="btn btn-brand btn-lg mt-4" style={{ width: "100%" }}>{cta}</Link>
    </article>
  );
}
