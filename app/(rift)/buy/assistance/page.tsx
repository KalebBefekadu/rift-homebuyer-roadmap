import type { Metadata } from "next";
import Link from "next/link";
import { money } from "@/lib/core/compute";
import { firstTimeFrom, OWNERSHIP_CAVEAT, type Ownership } from "@/lib/core/funnel";
import { matchAssistance, KIND_LABEL, FUNDING_TEXT, CAUTION, type Occupation, type Check } from "@/lib/core/assistance";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { currentPrograms } from "@/lib/db/program-checks";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { AssistanceSteps } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";
import { showDay } from "@/lib/core/day";

export const metadata: Metadata = {
  title: "What Georgia programs might help me buy?",
  description: "Down payment assistance programs that may fit you in Georgia, checked against each program's own rules, with what still needs confirming.",
};

export const dynamic = "force-dynamic";

const MONTH = (iso: string) => showDay(iso, { month: "long", year: "numeric" });

/**
 * Value: assistance (Blueprint v5 §5.2 first, §6.3 to §6.7).
 *
 * The answers are checked against each program's rules in the assistance
 * engine (lib/core/assistance.ts): fits, needs checking, or does not fit.
 * Only potential matches are listed. Never "you qualify": lenders and program
 * administrators decide. Programs are added together only when both
 * programs' own rules allow it (§6.4), and the cash figures elsewhere still
 * count assistance as zero (MONEY-02).
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

  const own = String(a.ownership) as Ownership;
  const price = Number(a.price);
  const county = String(a.county);
  const [{ rules }, programs] = await Promise.all([rulesOrDefaults(await currentAgentId()), currentPrograms()]);
  const r = matchAssistance({
    county,
    firstTime: firstTimeFrom(own),
    price,
    income: Number(a.income),
    household: Number(a.household),
    occupation: String(a.occupation) as Occupation | "other",
  }, { today: new Date(), windowDays: rules.registryDays.value, programs });

  const best = r.best;
  const figure = r.combination ? `Up to ${money(r.combination.total)}` : best ? `Up to ${money(best.amount)}` : "None yet";
  const sentence = r.combination
    ? <>from {r.combination.programs[0].program.name} and {r.combination.programs[1].program.name} together, the best combination whose rules allow it, of {r.matches.length} programs that may fit you. Compatibility and current availability must be verified.</>
    : best
      ? <>from {best.program.name}, the largest of {r.matches.length} program{r.matches.length === 1 ? "" : "s"} that may fit a {money(price)} home in {county} County. Lenders and the programs decide; this is what is worth checking.</>
      : <>No program we have checked fits these answers in {county} County. That does not mean none exists, only that we will not show one we cannot stand behind.</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={sentence}
        art={<AssistanceSteps need={Math.max(price * 0.08, 1)} steps={r.matches.map((m) => ({ name: m.program.name, max: m.amount, open: m.program.funding === "open" }))} />}
      />
      <BasedOn def={def} answers={a} />
      {OWNERSHIP_CAVEAT[own] ? <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}><Ico.info size={12} /> {OWNERSHIP_CAVEAT[own]}</p> : null}

      {r.matches.length ? (
        <section className="sec-sm" aria-labelledby="matches-h">
          <h2 id="matches-h" className="t-xl serif">Potential matches</h2>
          <p className="t-sm c-3 mt-1"><span className="c-pos">✓</span> fits your answers · <span className="c-warn">△</span> the program or a lender has to confirm it</p>
          <div className="col gap-3 mt-3">
            {r.matches.map((m) => (
              <article key={m.program.slug} className="card p-5">
                <div className="between wrap gap-2" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, maxWidth: 560 }}>
                    <h3 className="t-lg w6">{m.program.name}</h3>
                    <div className="t-sm c-3" style={{ marginTop: 2 }}>{m.program.administrator} · {KIND_LABEL[m.program.kind]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="t-xs c-4">Potential assistance</div>
                    <div className="num" style={{ fontSize: 24 }}>{money(m.amount)}</div>
                    {m.amountNote ? <div className="t-xs c-4">{m.amountNote}</div> : null}
                  </div>
                </div>
                <ul className="g2 gap-2 mt-3">
                  {m.checks.map((c) => <CheckLine key={c.label + c.note} c={c} />)}
                </ul>
                {m.alsoNote ? <p className="t-sm c-2 mt-2">{m.alsoNote}</p> : null}
                <details className="mt-3">
                  <summary className="t-sm w55" style={{ cursor: "pointer" }}>How it works and what it asks of you</summary>
                  <p className="t-sm c-2 mt-2">{m.program.terms}</p>
                  <ul className="col gap-1 mt-2">
                    {m.program.conditions.map((c) => <li key={c} className="t-sm c-2">· {c}</li>)}
                  </ul>
                </details>
                <div className="between wrap gap-2 mt-3" style={{ paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
                  <span className="t-xs c-4">Last verified: {MONTH(m.program.checkedOn)} · {FUNDING_TEXT[m.program.funding]}</span>
                  <a href={m.program.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">View official program source<Ico.arrowUpR size={12} /></a>
                </div>
              </article>
            ))}
          </div>
          <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>
            Potentially eligible, based on the information provided. {CAUTION}{" "}
            {r.combination ? "" : "Whether programs can be used together depends on each one's rules; where a program does not say, they are not added up here."}
          </p>
        </section>
      ) : null}

      {r.withheld.length ? (
        <p className="t-xs c-4 mt-3">{r.withheld.length} program{r.withheld.length === 1 ? " is" : "s are"} not shown while {r.withheld.length === 1 ? "it is" : "they are"} checked again against the official source. That is not a sign {r.withheld.length === 1 ? "it has" : "they have"} closed; ask Kaleb if you want to know now.</p>
      ) : null}

      <section className="sec-sm">
        <div className="card p-5 between wrap gap-3">
          <div className="measure">
            <div className="t-md w6">Every Georgia program, in one table</div>
            <p className="t-sm c-3" style={{ marginTop: 4 }}>Filter and sort them yourself, each with its official source.</p>
          </div>
          <Link href="/buy/programs" className="btn btn-s">See Georgia programs</Link>
        </div>
      </section>

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: best ? `up to ${money(r.combination?.total ?? best.amount)}` : "none yet", href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}

function CheckLine({ c }: { c: Check }) {
  return (
    <li className="row-t gap-2 t-sm">
      {c.state === "fits"
        ? <span className="c-pos" aria-label="Fits" style={{ lineHeight: 1.4 }}>✓</span>
        : <span className="c-warn" aria-label="Needs checking" style={{ lineHeight: 1.4 }}>△</span>}
      <span><strong className="w55">{c.label}.</strong> <span className="c-2">{c.note}</span></span>
    </li>
  );
}
