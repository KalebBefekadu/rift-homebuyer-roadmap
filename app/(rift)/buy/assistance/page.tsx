import type { Metadata } from "next";
import Link from "next/link";
import { BUYER_DEFAULTS, cashToClose, money } from "@/lib/core/compute";
import { matchForVisitor } from "@/lib/db/match";
import { firstTimeFrom, OWNERSHIP_CAVEAT, type Ownership } from "@/lib/core/funnel";
import { FUNDING_LABEL, TYPE_LABEL } from "@/lib/core/registry";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { AssistanceSteps } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "What Georgia programs might help me buy?",
  description: "Down payment assistance programs that may fit you in Georgia, what each one checks, and the most they could add up to.",
};

export const dynamic = "force-dynamic";

/**
 * Value: assistance (Blueprint v5 §5.2, D20 first; §6.3 to §6.7).
 *
 * Potential matches, never "you qualify": each program shows what fits the
 * answers and what still has to be checked. Programs are not added together:
 * whether two can be combined is part of each program's own rules, and until
 * the assistance engine records that (§6.4), the honest best figure is the
 * largest single program. The public cash figure still counts assistance as
 * zero (MONEY-02).
 */
export default async function Assistance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("assistance")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const county = String(a.county);
  const own = String(a.ownership) as Ownership;
  const price = Number(a.price);
  const { match, windowDays } = await matchForVisitor(county, firstTimeFrom(own));
  const need = cashToClose({ ...BUYER_DEFAULTS, price, county, assistance: 0 }).total;

  const programs = [...match.matched].sort((x, y) =>
    Number(y.funding === "open") - Number(x.funding === "open") || y.max - x.max);
  const open = programs.filter((p) => p.funding === "open");
  const best = open[0] ?? null;
  const verifiedAgo = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const figure = best ? `Up to ${money(best.max)}` : "None verified yet";
  const sentence = best
    ? <>from {best.name}, the largest of {programs.length} program{programs.length === 1 ? "" : "s"} that may fit a {money(price)} home in {county} County. Lenders and the programs decide; this is what is worth checking.</>
    : <>No program we have checked in the last {windowDays} days fits these answers in {county} County. That does not mean none exists, only that we will not show one we cannot stand behind.</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={sentence}
        art={<AssistanceSteps need={need} steps={programs.map((p) => ({ name: p.name, max: p.max, open: p.funding === "open" }))} />}
      />
      <BasedOn def={def} answers={a} />
      {OWNERSHIP_CAVEAT[own] ? <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}><Ico.info size={12} /> {OWNERSHIP_CAVEAT[own]}</p> : null}

      {programs.length ? (
        <section className="sec-sm" aria-labelledby="matches-h">
          <h2 id="matches-h" className="t-xl serif">Potential matches</h2>
          <p className="t-sm c-3 mt-1">What your answers fit, and what the program or a lender still has to confirm.</p>
          <div className="col gap-3 mt-3">
            {programs.map((p) => (
              <article key={p.id} className="card p-5">
                <div className="between wrap gap-2" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="t-lg w6">{p.name}</h3>
                    <div className="t-sm c-3" style={{ marginTop: 2 }}>{p.administrator} · {TYPE_LABEL[p.type]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontSize: 22 }}>{p.min === p.max ? money(p.max) : `${money(p.min)} to ${money(p.max)}`}</div>
                    <span className={`chip ${p.funding === "open" ? "chip-pos" : "chip-warn"}`}>{FUNDING_LABEL[p.funding]}</span>
                  </div>
                </div>
                <ul className="g2 gap-2 mt-3">
                  <li className="row gap-2 t-sm"><Ico.check size={14} className="c-pos" />Location: {p.county ? `${p.county} County` : "statewide"}</li>
                  <li className="row gap-2 t-sm">
                    {p.firstTimeOnly ? <><Ico.check size={14} className="c-pos" />First-time buyer</> : <><Ico.check size={14} className="c-pos" />Open to repeat buyers</>}
                  </li>
                  <li className="row-t gap-2 t-sm"><span className="c-warn" aria-hidden style={{ lineHeight: 1.3 }}>△</span><span>Income: {p.incomeLimitNote}</span></li>
                  <li className="row-t gap-2 t-sm"><span className="c-warn" aria-hidden style={{ lineHeight: 1.3 }}>△</span><span>Price: {p.priceCapNote}</span></li>
                  {p.funding !== "open" ? (
                    <li className="row-t gap-2 t-sm"><span className="c-warn" aria-hidden style={{ lineHeight: 1.3 }}>△</span><span>Funding: {FUNDING_LABEL[p.funding].toLowerCase()}{p.reopens ? `, expected to reopen ${p.reopens}` : ""}</span></li>
                  ) : null}
                </ul>
                {p.conditions.length ? (
                  <details className="mt-3">
                    <summary className="t-sm w55" style={{ cursor: "pointer" }}>What it asks of you</summary>
                    <ul className="col gap-1 mt-2">
                      {p.conditions.map((c) => <li key={c} className="t-sm c-2">· {c}</li>)}
                    </ul>
                  </details>
                ) : null}
                <div className="between wrap gap-2 mt-3" style={{ paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
                  <span className="t-xs c-4">Last verified: {verifiedAgo(p.verifiedOn)} · Source: {p.source}</span>
                </div>
              </article>
            ))}
          </div>
          <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>
            Potentially eligible, based on the information provided. Program terms and funding availability may
            change; confirm current eligibility with the program administrator or a participating lender before
            relying on this. Whether two programs can be used together depends on each program&apos;s rules, so
            they are not added up here.
          </p>
        </section>
      ) : null}

      <section className="sec-sm">
        <div className="card p-5 between wrap gap-3">
          <div className="measure">
            <div className="t-md w6">Every Georgia program, in one table</div>
            <p className="t-sm c-3" style={{ marginTop: 4 }}>Filter and sort them yourself, with each one&apos;s official source.</p>
          </div>
          <Link href="/buy/programs" className="btn btn-s">See all Georgia programs</Link>
        </div>
      </section>

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: best ? `up to ${money(best.max)}` : "none verified yet", href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
