import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { valuesFor, type ValueSide } from "@/lib/core/values";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export interface HowStep {
  title: string;
  body: React.ReactNode;
  /** A word on the step's terms: "Free", "Only if you ask". */
  tag: string;
}

/**
 * The how-it-works pages (Blueprint v5 §5.8, Kaleb R1).
 *
 * They used to read "like a legal document or a privacy policy": sections on
 * what the product refuses to do, how the agent is paid and how long each
 * record is kept. The reader came to learn what happens and what they get.
 * So every side now tells the same shape of story: the steps from the first
 * question to the keys, the answers they can have today (read from the value
 * catalogue, so a value that is not built is never promised), and one line
 * about money.
 *
 * That line is fixed here rather than written per side, because Kaleb set it
 * as the only money message: you pay Rift nothing, and the only fees are the
 * ones any transaction has. A second paragraph on commission, lenders or who
 * pays whom is exactly what made these pages read as legal copy.
 *
 * What is kept and how to delete it lives on /privacy, one link away.
 */
export function HowItWorks({ side, kicker, title, lede, steps, notice, cta, transaction }: {
  side: ValueSide;
  kicker: string;
  title: string;
  lede: string;
  steps: HowStep[];
  /** Something the reader must see before the steps, such as a language notice. */
  notice?: React.ReactNode;
  cta: { href: string; label: string };
  /** "purchase" or "sale", for the money line. */
  transaction: "purchase" | "sale";
}) {
  const values = valuesFor(side);
  return (
    <div className={side}>
      <SiteHeader side={side} current={`/${side}/how`} action={{ href: `/book?v=${side}`, label: "Book a call" }} />

      <main className="shell-w">
        <section className="sec ctr">
          <div className="kicker c-brand">{kicker}</div>
          <h1 className="serif d2 mt-3" style={{ maxWidth: 820, margin: "16px auto 0" }}>{title}</h1>
          <p className="lede mt-4 measure">{lede}</p>
        </section>

        {notice ? <div className="narrow">{notice}</div> : null}

        <section className="sec-sm mid" aria-labelledby="steps-h">
          <h2 id="steps-h" className="serif d3 ctr">What happens, step by step</h2>
          <ol className="how-path mt-4">
            {steps.map((s, n) => (
              <li key={s.title} className="how-step">
                <span className="how-dot num" aria-hidden="true">{n + 1}</span>
                <div className="card p-5 grow">
                  <div className="between wrap gap-2">
                    <h3 className="t-lg w6 serif" style={{ letterSpacing: "-0.015em" }}>{s.title}</h3>
                    <span className="chip chip-brand" style={{ flex: "none" }}>{s.tag}</span>
                  </div>
                  <div className="t-md c-3 mt-2" style={{ lineHeight: 1.6 }}>{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {values.length ? (
          <section className="sec" aria-labelledby="values-h">
            <h2 id="values-h" className="serif d3 ctr">What you can find out today</h2>
            <p className="t-md c-3 ctr mt-2">Free, from your own numbers, with no account.</p>
            <div className={`${values.length === 3 ? "trio" : "pair"} mt-4`}>
              {values.map((v) => (
                <Link key={v.id} href={v.href} className="card p-5 lift value-card">
                  <div className="kicker c-brand">{v.name}</div>
                  <div className="t-lg w6 serif" style={{ letterSpacing: "-0.015em" }}>{v.question}</div>
                  <p className="t-sm c-3 grow" style={{ lineHeight: 1.55 }}>{v.gives}</p>
                  <span className="row gap-1 t-sm w6 c-brand">{v.cta}<Ico.arrowR size={14} /></span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="sec-sm narrow" aria-labelledby="cost-h">
          <div className="card p-6 ctr" style={{ background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
            <h2 id="cost-h" className="serif d3">You pay Rift nothing</h2>
            <p className="t-md c-2 mt-3" style={{ lineHeight: 1.6 }}>
              The only fees are the ones any {transaction} has, such as agent fees.
            </p>
          </div>
        </section>

        <section className="sec ctr">
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link href={cta.href} className="btn btn-brand btn-lg">{cta.label}<Ico.arrowR size={15} /></Link>
          </div>
          <p className="t-sm c-4 mt-4">
            <Link href="/privacy" className="u">What we keep, and how to delete it</Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
