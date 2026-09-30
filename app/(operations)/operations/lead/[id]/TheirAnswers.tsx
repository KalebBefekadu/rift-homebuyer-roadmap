import Link from "next/link";
import type { LeadQuestions } from "@/lib/db/questions";
import { showDay } from "@/lib/core/day";
import { Notice } from "../../ui";

/**
 * Their answers to your own questions (D37), in the words they were asked,
 * and which wording of the values' questions they saw. A read that failed
 * says so; it is never shown as "they answered nothing".
 */
export function TheirAnswers({ data, unavailable }: { data: LeadQuestions | null; unavailable: string | null }) {
  if (unavailable) {
    return (
      <section style={{ marginTop: 24 }} aria-labelledby="their-answers-h">
        <h2 id="their-answers-h" className="t-lg w6">Your questions</h2>
        <div style={{ marginTop: 10 }}><Notice tone="warn" title="Their answers did not load">{unavailable}</Notice></div>
      </section>
    );
  }
  if (!data || (!data.answers.length && data.version === null)) return null;
  return (
    <section style={{ marginTop: 24 }} aria-labelledby="their-answers-h">
      <h2 id="their-answers-h" className="t-lg w6">Your questions</h2>
      <div className="card p-4" style={{ marginTop: 10 }}>
        {data.answers.length ? (
          <dl className="col gap-2">
            {data.answers.map((a) => (
              <div key={a.question} style={{ borderBottom: "1px solid var(--line-3)", paddingBottom: 8 }}>
                <dt className="t-xs c-3">{a.question}</dt>
                <dd className="t-sm w55" style={{ margin: "2px 0 0" }}>{a.answer}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="t-sm c-3">They did not answer your questions. Answering is optional.</p>}
        <p className="t-xs c-4" style={{ marginTop: 10 }}>
          {data.version !== null
            ? <>Asked in <Link className="u" href={`/operations/questions?v=${data.version}`}>wording version {data.version}</Link>{data.answers[0] ? `, answered ${showDay(data.answers[0].at, { month: "short", day: "numeric", year: "numeric" })}` : ""}.</>
            : "Asked in the built-in wording."}
        </p>
      </div>
    </section>
  );
}
