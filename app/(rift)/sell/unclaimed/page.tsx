import type { Metadata } from "next";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { unclaimedChecks, type UnclaimedAnswers, type UnclaimedCheck } from "@/lib/core/unclaimed";
import { showDay } from "@/lib/core/day";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { DeadlineSheet } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "Money you may already be losing",
  description:
    "Homestead and senior exemptions, assessment appeals, and the home-sale exclusion, with the deadlines that apply. Worth checking whether or not you ever sell. Free, and no account.",
};

export const dynamic = "force-dynamic";

/**
 * Value: money you may be losing (Blueprint v5 §5.3, D20 second;
 * docs/audit/value-depth-2026-10.md §4.8).
 *
 * The lowest-commitment door on the seller side. None of it has anything to
 * do with selling: a homeowner overpaying because homestead was never filed
 * loses money every year whether they list or not, and being told so with
 * nothing asked in return is the most credible thing this product does.
 *
 * It used to be a standalone page of sliders that started from defaults and
 * quoted them as the visitor's own facts. It now asks three questions, on the
 * same pattern as every other value, answers only from what they said, and
 * can be saved and followed like the rest (lib/core/unclaimed.ts).
 */
export default async function Unclaimed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("unclaimed")!;
  /* The published words (D37), or the code's when they cannot be read in time. */
  const words = await valueWording(def);
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow defs={words.defs} tool={def.id} side="sell" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const answers: UnclaimedAnswers = {
    homestead: a.homestead as UnclaimedAnswers["homestead"],
    age65: a.age65 as UnclaimedAnswers["age65"],
    yearsOwned: Number(a.yearsOwned),
  };
  const checks = unclaimedChecks(answers, new Date());
  const april = checks.find((c) => c.deadline?.day)?.deadline ?? null;
  const n = checks.length;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={`${n} worth checking`}
        sentence={april
          ? <>and the first has a date: {showDay(april.day!, { month: "long", day: "numeric", year: "numeric" })}, {april.days === 0 ? "today" : `${april.days} days away`}. Each one says who decides it, so you know exactly who to call.</>
          : <>Nothing here has a filing date this year, but each one is worth a phone call, and each says exactly who to call.</>}
        art={<DeadlineSheet days={april?.days ?? null} checks={n} />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />

      <section className="sec-sm col gap-3">
        {checks.map((c) => <CheckCard key={c.id} c={c} />)}
      </section>

      <p className="t-xs c-4 measure" style={{ lineHeight: 1.6 }}>
        We are not tax advisers or attorneys, and nothing here is advice. We notice the question is worth asking and tell you who is allowed to answer it.
        The only dollar figures are the ones set in law; what an exemption saves you depends on your county&apos;s rates, and the tax commissioner can tell you.
      </p>

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${n} worth checking`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}

function CheckCard({ c }: { c: UnclaimedCheck }) {
  return (
    <article className="card p-5">
      <div className="between wrap gap-2" style={{ alignItems: "flex-start" }}>
        <h2 className="t-lg w6 grow" style={{ minWidth: 0, flexBasis: 260 }}>{c.title}</h2>
        {/* Statutory figures can be long ("Up to $250,000 single, ..."): let them wrap rather than push the card wider than a phone. */}
        {c.figure ? <span className="num t-md c-brand" style={{ minWidth: 0, maxWidth: "100%" }}>{c.figure}</span> : null}
      </div>
      <p className="t-sm c-2 mt-2" style={{ lineHeight: 1.6 }}>{c.detail}</p>
      <div className="row gap-2 wrap mt-3">
        <span className="chip"><Ico.users size={12} />Decided by {c.decidedBy}</span>
        {c.deadline ? (
          <span className="chip chip-warn"><Ico.clock size={12} />
            {c.deadline.day ? `${c.deadline.label}: ${showDay(c.deadline.day, { month: "short", day: "numeric", year: "numeric" })}` : c.deadline.label}
          </span>
        ) : null}
      </div>
    </article>
  );
}
