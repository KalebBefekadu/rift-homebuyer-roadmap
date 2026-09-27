import type { Metadata } from "next";
import { matchAssistance, type Occupation } from "@/lib/core/assistance";
import { lenderQuestions } from "@/lib/core/lender-questions";
import { firstTimeFrom, type Ownership } from "@/lib/core/funnel";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { currentPrograms } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { PrintButton } from "@/components/rift/PrintButton";

export const metadata: Metadata = {
  title: "What should I ask a lender?",
  description: "Questions to take to a mortgage lender in Georgia, written for your price, down payment and the programs you may fit, and why each one matters.",
};

export const dynamic = "force-dynamic";

/**
 * Value: lender questions (Blueprint v5 §5.2). No figure: a sheet of
 * questions built from the person's answers (lib/core/lender-questions.ts),
 * including the programs they may fit when they have checked them.
 */
export default async function LenderQuestions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("lender")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const firstTime = firstTimeFrom(String(a.ownership) as Ownership);
  /* Programs only when the assistance answers are there: a question about a
     program nobody checked would be a guess on their behalf. */
  let matches: ReturnType<typeof matchAssistance> | null = null;
  if (hasAll(a, ["county", "income", "household", "occupation"])) {
    const [{ rules }, programs] = await Promise.all([rulesOrDefaults(await currentAgentId()), currentPrograms()]);
    matches = matchAssistance({
      county: String(a.county), firstTime, price: Number(a.price), income: Number(a.income),
      household: Number(a.household), occupation: String(a.occupation) as Occupation | "other",
    }, { today: new Date(), windowDays: rules.registryDays.value, programs });
  }
  const groups = lenderQuestions({
    price: Number(a.price), downPct: Number(a.downPct), firstTime,
    matches: matches?.matches ?? [], combination: matches?.combination ? matches.combination.programs : null,
  });
  const count = groups.reduce((n, g) => n + g.questions.length, 0);

  return (
    <ValueLayout def={def}>
      <section className="sec-sm">
        <div className="between wrap gap-3">
          <div>
            <div className="kicker c-brand">{def.name}</div>
            <h1 className="serif d2 mt-2">{count} questions for your lender</h1>
            <p className="lede mt-3 measure">Written for your answers. Take them into two lender conversations: the second is where the first one&apos;s answers get tested.</p>
          </div>
          <span className="no-print"><PrintButton /></span>
        </div>
      </section>
      <BasedOn def={def} answers={a} />
      {!matches ? (
        <p className="t-sm c-3 mt-3 measure">Check which Georgia programs may fit you and this sheet adds the questions about them.</p>
      ) : null}
      <div className="col gap-3 mt-4">
        {groups.map((g) => (
          <section key={g.title} className="card p-5">
            <h2 className="t-lg w6">{g.title}</h2>
            <ol className="mt-2" style={{ paddingLeft: 20 }}>
              {g.questions.map((q) => (
                <li key={q.q} style={{ marginTop: 8 }}>
                  <div className="t-md w55">{q.q}</div>
                  <div className="t-sm c-3" style={{ marginTop: 2 }}>{q.why}</div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${count} questions`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
