import Link from "next/link";
import { Layer } from "@/components/rift/Layer";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { ASK_SHORT, answerLabel, answersToQuery, type Answers } from "@/lib/core/asks";
import type { Assumption } from "@/lib/core/compute";
import type { InputKey, ValueDef } from "@/lib/core/values";

/**
 * The pieces every value page is built from, so the values look and behave
 * as one product (Blueprint v5 §4, §5.1).
 */

/** Header, the page, the one footer, in the side's colours. */
export function ValueLayout({ def, children }: { def: ValueDef; children: React.ReactNode }) {
  const tone = def.side === "sell" ? "sell" : def.side === "abroad" ? "abroad" : "buy";
  return (
    <div className={tone}>
      <SiteHeader side={def.side} current={def.href} />
      <main className="shell-w">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** The top of an answer: the question they asked, the figure, one sentence. */
export function AnswerHead({ def, figure, sentence, art, tone }: {
  def: ValueDef;
  figure: string;
  sentence: React.ReactNode;
  art: React.ReactNode;
  tone?: "neg" | "pos";
}) {
  return (
    <section className="sec-sm answer" aria-labelledby="answer-h">
      <div>
        <div className="kicker c-brand">{def.name}</div>
        <h1 id="answer-h" className="t-lg w55 c-2" style={{ marginTop: 10 }}>{def.question}</h1>
        <div className={`answer-fig mt-3 ${figure.includes("–") ? "is-range" : ""} ${tone === "neg" ? "c-neg" : ""}`}>{figure}</div>
        <p className="t-lg c-2 mt-3" style={{ lineHeight: 1.5, fontWeight: 450, maxWidth: 480 }}>{sentence}</p>
      </div>
      <figure className="art-box">{art}</figure>
    </section>
  );
}

/** What the answer used, each with a way to change it. */
export function BasedOn({ def, answers }: { def: ValueDef; answers: Answers }) {
  const q = answersToQuery(answers, def.asks);
  return (
    <div className="row wrap gap-2 mt-4" aria-label="Based on your answers">
      <span className="t-sm c-4">Based on</span>
      {def.asks.map((k: InputKey) => (
        <Link key={k} href={`${def.href}?${q}&ask=${k}`} className="chip"
          /* Wraps: a long answer ("I have an ITIN, not a Social Security
             number") pushed a fixed-height chip past the edge of a phone. */
          style={{ minHeight: 28, height: "auto", padding: "4px 10px", fontSize: 12.5, whiteSpace: "normal", maxWidth: "100%", lineHeight: 1.35 }}
          aria-label={`${ASK_SHORT[k]}: ${answerLabel(k, answers[k])}. Change it`}>
          <span className="c-4">{ASK_SHORT[k]}</span> {answerLabel(k, answers[k])}
          <Ico.chevD size={11} className="c-4" />
        </Link>
      ))}
    </div>
  );
}

/**
 * A plain table of the lines behind the figure.
 *
 * `layer`: one press away instead of on the page (Blueprint v5 §4.8), for a
 * breakdown the answer's picture already shows. The headline figure never
 * moves into a layer; only the lines behind it do, and the label carries how
 * many there are and what they add up to.
 */
export function Lines({ title, rows, total, layer }: {
  title: string;
  rows: { label: string; note?: string; amount: string; muted?: boolean }[];
  total?: { label: string; amount: string };
  layer?: boolean;
}) {
  const table = (
      <div className={`card ${layer ? "" : "mt-3"}`} style={{ overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.label} className="between" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start" }}>
            <div className="grow">
              <div className="t-md w55">{r.label}</div>
              {r.note ? <div className="t-xs c-4" style={{ marginTop: 2, lineHeight: 1.5 }}>{r.note}</div> : null}
            </div>
            <span className={`num t-md ${r.muted ? "c-4" : ""}`}>{r.amount}</span>
          </div>
        ))}
        {total ? (
          <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
            <span className="t-md w6">{total.label}</span>
            <span className="num" style={{ fontSize: 21 }}>{total.amount}</span>
          </div>
        ) : null}
      </div>
  );
  if (layer) {
    return (
      <Layer className="mt-4" title={title} meta={`${rows.length} lines${total ? `, ${total.amount}` : ""}`}>
        {table}
      </Layer>
    );
  }
  return (
    <section className="sec-sm" aria-labelledby="lines-h">
      <h2 id="lines-h" className="t-xl serif">{title}</h2>
      {table}
    </section>
  );
}

/** How the figure was worked out: a layer, closed by default (§4.8). */
export function WorkedOut({ assumptions, couldBeWrong, extra }: {
  assumptions: Assumption[];
  couldBeWrong: string;
  extra?: React.ReactNode;
}) {
  return (
    <Layer className="mt-4" title="How this was worked out" meta={`${assumptions.length} assumptions, and where it could be wrong`}>
      <dl className="g2 gap-2">
        {assumptions.map((a) => (
          <div key={a.label} className="between" style={{ borderBottom: "1px solid var(--line-3)", paddingBottom: 6 }}>
            <dt className="t-sm c-3">{a.label}</dt>
            <dd className="t-sm w55" style={{ margin: 0, textAlign: "right" }}>{a.value}</dd>
          </div>
        ))}
      </dl>
      <p className="t-sm c-3 mt-3" style={{ lineHeight: 1.6 }}><strong className="c-2">Where it could be wrong.</strong> {couldBeWrong}</p>
      {extra}
    </Layer>
  );
}
