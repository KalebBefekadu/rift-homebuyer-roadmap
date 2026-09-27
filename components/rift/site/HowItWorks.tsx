import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * "How it works", one layout for all three sides (Blueprint v5 §5.8, Kaleb
 * R1: "they read like a legal document or a privacy policy").
 *
 * The page explains the process and what Rift gives, in the order a person
 * lives it. One money message and no other (Kaleb R1): you pay Rift nothing,
 * and the only fees are the ones any purchase or sale has. What we keep and
 * how to delete it lives on /privacy, one link away, rather than here.
 */
export function HowItWorks({ side, title, lede, steps, gives, start, fees, extra }: {
  side: "buy" | "sell" | "abroad";
  title: string;
  lede: string;
  steps: { title: string; body: string }[];
  gives: { title: string; body: string }[];
  start: { href: string; label: string };
  /** The fees any transaction on this side has, in the person's words. */
  fees: string;
  /** Anything particular to the side, placed after what Rift gives. */
  extra?: React.ReactNode;
}) {
  const book = `/book?v=${side}`;
  return (
    <div className={side === "sell" ? "sell" : "buy"}>
      <SiteHeader side={side} current={`/${side}/how`} action={{ href: book, label: "Book a call" }} />
      <main className="shell-w">
        <section className="sec ctr">
          <div className="kicker c-brand">How it works</div>
          <h1 className="serif d2 mt-3" style={{ maxWidth: 820, margin: "16px auto 0" }}>{title}</h1>
          <p className="lede mt-4 measure">{lede}</p>
        </section>

        <section className="sec-sm" aria-labelledby="steps-h">
          <h2 id="steps-h" className="sr-only">The steps</h2>
          <ol className="col gap-3" style={{ maxWidth: 760, margin: "0 auto", listStyle: "none", padding: 0 }}>
            {steps.map((s, k) => (
              <li key={s.title} className="card p-5 row-t gap-4">
                <span className="num" aria-hidden="true" style={{ flex: "none", width: 36, height: 36, borderRadius: 18, display: "grid", placeItems: "center", background: k === 0 ? "var(--brand)" : "var(--brand-wash)", color: k === 0 ? "#fff" : "var(--brand-2)", fontSize: 16 }}>{k + 1}</span>
                <div>
                  <h3 className="t-lg w6">{s.title}</h3>
                  <p className="t-md c-3 mt-1" style={{ lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="sec" aria-labelledby="gives-h">
          <h2 id="gives-h" className="serif d3 ctr">What you get</h2>
          <div className="pair mt-4">
            {gives.map((g) => (
              <div key={g.title} className="card p-5">
                <div className="row gap-2"><Ico.check size={15} className="c-brand" /><h3 className="t-md w6">{g.title}</h3></div>
                <p className="t-sm c-3 mt-2" style={{ lineHeight: 1.6 }}>{g.body}</p>
              </div>
            ))}
          </div>
        </section>

        {extra}

        <section className="sec-sm">
          <div className="card p-6 between wrap gap-4" style={{ maxWidth: 760, margin: "0 auto", background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
            <div className="measure">
              <h2 className="t-xl serif">You pay Rift nothing.</h2>
              <p className="t-md c-2 mt-2" style={{ lineHeight: 1.6 }}>{fees}</p>
              <p className="t-sm c-3 mt-2" style={{ lineHeight: 1.6 }}>
                What you tell us stays private. <Link href="/privacy" className="c-brand">See what we keep</Link>, and delete it whenever you like.
              </p>
            </div>
          </div>
        </section>

        <section className="sec ctr">
          <h2 className="serif d3">Start with your question</h2>
          <div className="cta-row mt-4" style={{ justifyContent: "center" }}>
            <Link href={start.href} className="btn btn-brand btn-lg">{start.label}<Ico.arrowR size={15} /></Link>
            <Link href={book} className="btn btn-s btn-lg">Book a call</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
