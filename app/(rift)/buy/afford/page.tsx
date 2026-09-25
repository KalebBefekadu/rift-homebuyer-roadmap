import type { Metadata } from "next";
import { money } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { affordability, RATIOS } from "@/lib/core/afford";
import { currentRate } from "@/lib/db/rates";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { AffordBand } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "How much home fits my budget?",
  description: "A comfortable price and a stretch price for a Georgia home, from your income and debts. A planning range, not a lending decision.",
};

export const dynamic = "force-dynamic";

/**
 * Value: how much home fits (Blueprint v5 §5.2, MONEY-05). A planning range
 * from two named scenarios; see lib/core/afford.ts for the bounds and why.
 */
export default async function AffordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("afford")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const rate = await currentRate();
  const r = affordability({ income: Number(a.income), debts: Number(a.debts), downPct: Number(a.downPct), ratePct: rate.pct });
  const c = r.comfortable.price, s = r.stretch.price;
  const figure = c !== null && s !== null ? `${money(c)} – ${money(s)}` : s !== null ? `Up to ${money(s)}` : "No price yet";
  const sentence = s === null
    ? <>fits these ratios: your monthly debts of {money(r.debts)} already use up the {RATIOS.stretchTotal}% of income a stretch allows. Paying some down, or more income, changes that.</>
    : c === null
      ? <>is a stretch: your debts leave no room at the comfortable ratios, so only the stretch scenario has a price. Treat it as the top, not the target.</>
      : <>is a comfortable to stretch planning range, at {money(r.comfortable.monthly)} to {money(r.stretch.monthly)} a month all in. It is not a lending decision: a lender&apos;s pre-approval is.</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead def={def} figure={figure} sentence={sentence} art={<AffordBand comfortable={c} stretch={s} />} />
      <BasedOn def={def} answers={a} />

      <Lines
        title="The two scenarios"
        rows={[
          { label: "Comfortable", note: `Housing at most ${RATIOS.comfortHousing}% of your gross income, and all debts at most ${RATIOS.comfortTotal}%`, amount: c === null ? "No price" : `${money(c)} · ${money(r.comfortable.monthly)}/mo` },
          { label: "Stretch", note: `All debts, housing included, at most ${RATIOS.stretchTotal}% of your gross income`, amount: s === null ? "No price" : `${money(s)} · ${money(r.stretch.monthly)}/mo` },
        ]}
      />
      <p className="t-sm c-3 mt-3" style={{ lineHeight: 1.6 }}>
        These ratios are common guidelines, not any lender&apos;s rule: lenders set their own, and FHA and other loans can allow more.
        A price that fits the monthly budget may still need more cash than you have; cash to close is the next thing to check.
      </p>
      <WorkedOut assumptions={r.assumptions} couldBeWrong={r.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
