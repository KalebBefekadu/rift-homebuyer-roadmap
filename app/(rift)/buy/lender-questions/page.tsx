import type { Metadata } from "next";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { lenderQuestions } from "@/lib/core/lender-questions";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { QuestionSheet } from "@/components/rift/value/artifacts";
import { PrintButton } from "@/components/rift/PrintButton";

export const metadata: Metadata = {
  title: "What should I ask a lender?",
  description: "The questions to ask a mortgage lender in Georgia, written for your down payment, credit and first-time status. Print them for the call.",
};

export const dynamic = "force-dynamic";

/**
 * Value: what should I ask a lender (Blueprint v5 §5.2). Questions only:
 * the answers are the lender's to give, in writing (lib/core/lender-questions.ts).
 */
export default async function LenderQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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

  const qs = lenderQuestions(a);
  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={`${qs.length} questions`}
        sentence={<>to ask any lender before you apply, written for your situation. Ask for every answer in writing; the Loan Estimate is where the numbers become theirs.</>}
        art={<QuestionSheet count={qs.length} />}
      />
      <BasedOn def={def} answers={a} />

      <section className="sec-sm" aria-labelledby="qs-h">
        <div className="between wrap gap-2">
          <h2 id="qs-h" className="t-xl serif">Your questions</h2>
          <span className="no-print"><PrintButton /></span>
        </div>
        <ol className="card mt-3" style={{ padding: "6px 18px 6px 38px" }}>
          {qs.map((q) => (
            <li key={q.q} style={{ padding: "11px 0", borderBottom: "1px solid var(--line-3)" }}>
              <div className="t-md w55" style={{ lineHeight: 1.5 }}>{q.q}</div>
              <div className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.5 }}>{q.why}</div>
            </li>
          ))}
        </ol>
      </section>

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${qs.length} questions`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
