import type { Metadata } from "next";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { AgentSchema } from "@/components/rift/Agent";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { CashStack, ProceedsFlow } from "@/components/rift/value/artifacts";
import { money, cashToClose, netProceeds, BUYER_DEFAULTS, SELLER_DEFAULTS } from "@/lib/core/compute";
import { valuesFor } from "@/lib/core/values";

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
 * what this is by showing it. "No account" is said once, quietly (principle 2).
 */
export default function HomePage() {
  const buy = cashToClose({ ...BUYER_DEFAULTS, assistance: 0 });
  const sell = netProceeds(SELLER_DEFAULTS);
  const sellParts = [
    { label: "Loan payoff", amount: SELLER_DEFAULTS.payoff },
    { label: "Selling costs", amount: sell.totalCosts - SELLER_DEFAULTS.payoff },
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
            caption={`is the cash a ${money(BUYER_DEFAULTS.price)} home in Georgia takes, not the ${money(buy.down)} down payment.`}
            art={<CashStack lines={buy.lines} total={buy.total} down={buy.down} />}
            href="/buy"
            cta="Start with buying"
            questions={valuesFor("buy").map((v) => ({ href: v.href, label: v.question }))}
          />
          <Door
            tone="sell"
            kicker="I'm selling"
            title="The sale price is not the number either."
            figure={money(sell.net)}
            caption={`is what reaches you from a ${money(SELLER_DEFAULTS.price)} sale, after the loan payoff and the cost of selling.`}
            art={<ProceedsFlow price={SELLER_DEFAULTS.price} parts={sellParts} net={sell.net} />}
            href="/sell"
            cta="Start with selling"
            questions={valuesFor("sell").map((v) => ({ href: v.href, label: v.question }))}
          />
        </section>

        <section className="sec pair" aria-label="Also here">
          <Link href="/sell/unclaimed" className="card p-5 lift value-card sell">
            <div className="kicker c-brand">Own a home in Georgia?</div>
            <div className="t-xl serif">You may be paying more tax than you need to.</div>
            <p className="t-sm c-3 grow" style={{ lineHeight: 1.6 }}>
              Homestead and senior exemptions, and assessment appeals, whether or not you ever move.
            </p>
            <span className="row gap-1 t-sm w6 c-brand">Check what I may be missing<Ico.arrowR size={14} /></span>
          </Link>
          <Link href="/abroad" className="card p-5 lift value-card abroad">
            <div className="kicker c-brand">Living outside the United States?</div>
            <div className="t-xl serif">You can own a home in the United States.</div>
            <p className="t-sm c-3 grow" style={{ lineHeight: 1.6 }}>
              You don&apos;t need citizenship, a green card, or a visa to own property in the United
              States, and you don&apos;t need to be here to close.
            </p>
            <span className="row gap-1 t-sm w6 c-brand">Check if I can buy<Ico.arrowR size={14} /></span>
          </Link>
        </section>

        <p className="t-sm c-4 ctr sec-sm">Free to use, with nothing to sign up for. Kaleb is paid a commission only if you buy or sell with him.</p>
      </main>

      <SiteFooter />
    </div>
  );
}

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
