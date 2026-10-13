import type { Metadata } from "next";
import { money, pct } from "@/lib/core/compute";
import { controllableCosts } from "@/lib/core/seller";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { CostBlocks } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What will selling my home cost?",
  description: "Each cost of selling a home in Georgia by what you can do about it, with commission as your own number, and what each month on the market costs you.",
};

export const dynamic = "force-dynamic";

/**
 * Value: selling costs (Blueprint v5 §5.3, D20 third for sellers; MONEY-06).
 *
 * The costs alone, without the loan, for somebody who is not ready to say
 * what they owe. Commission is an answer, never a rate we assume.
 *
 * It used to be What you'd keep without one input. Now it answers the
 * question people actually have about cost: which of these can I do
 * anything about, and what does waiting cost (V4, Kaleb 13 Oct 2026;
 * docs/audit/value-depth-2026-10.md §4.9).
 */
export default async function Costs({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("costs")!;
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

  const price = Number(a.salePrice);
  const commissionPct = a.commission === "none" ? null : Number(a.commission);
  /* The loan is not a cost of selling; it is left out here, so the payoff fee
     is too. What you owe belongs to the net proceeds value. */
  const cc = controllableCosts({ price, payoff: 0, county: String(a.county), commissionPct }, Number(a.carrying));
  const c = cc.costs;
  const months = (n: number) => `${n.toFixed(1).replace(/\.0$/, "")} month${n === 1 ? "" : "s"}`;
  const share = (c.total / price) * 100;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={money(c.total)}
        sentence={<>
          is what selling a {money(price)} home in {String(a.county)} County costs{c.commissionKnown ? `, ${pct(share)} of the price` : " before commission"}.
          {c.commissionKnown ? ` ${money(cc.negotiable)} of it is yours to negotiate.` : ` Each 1% of commission you agree adds ${money(c.perPoint)}.`}
        </>}
        art={<CostBlocks parts={c.lines.map((l) => ({ label: l.short, amount: l.amount }))} total={c.total} />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />
      {cc.groups.map((g) => (
        <Lines
          key={g.kind}
          title={g.label}
          rows={g.lines.map((l) => ({ label: l.label, note: l.note, amount: money(l.amount) }))}
          total={{ label: g.kind === "negotiable" ? "Yours to negotiate" : g.kind === "law" ? "Fixed" : "Moves with the date", amount: money(g.total) }}
        />
      ))}

      <Lines
        title="The cost nobody lists: time"
        rows={[
          { label: "Each month on the market", note: "What the home costs you now, all in, from your answer", amount: money(cc.perMonth) },
          ...(cc.concessionMonths !== null ? [{
            label: "A 1% price cut or concession",
            note: `${money(c.perPoint)} on this price: the same as ${months(cc.concessionMonths)} on the market. Worth weighing when an offer asks for one`,
            amount: months(cc.concessionMonths),
          }] : []),
          ...(c.commissionKnown ? [{ label: "Half a point of commission", note: "What each half point you negotiate is worth on this price", amount: money(cc.halfPoint) }] : []),
        ]}
      />
      <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}>
        Not counted: your loan (see what you would keep for that), moving, and anything a buyer asks for until you agree it.
      </p>
      <WorkedOut
        assumptions={[
          { label: "Sale price", value: money(price) },
          { label: "Commission", value: c.commissionKnown ? pct(commissionPct!) : "Not agreed yet, so not included" },
          { label: "Transfer tax", value: "$1.00 per $1,000 of price (Georgia)" },
        ]}
        couldBeWrong="Commission is whatever you agree. The attorney's fee varies by firm, and your share of the property tax depends on the closing date and your exemptions."
      />
      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: money(c.total), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
