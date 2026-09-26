import type { Metadata } from "next";
import { BUYER_DEFAULTS, cashToClose, money } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { CashStack } from "@/components/rift/value/artifacts";
import type { InputKey } from "@/lib/core/values";

export const metadata: Metadata = {
  title: "How much cash do I really need?",
  description: "Every line you pay before you get the keys in Georgia, not just the down payment. Worked out from your answers.",
};

export const dynamic = "force-dynamic";

/**
 * Value: cash to close (Blueprint v5 §5.2, D20 second).
 *
 * The site's core idea: the down payment is not the number. Asks the price,
 * the down payment and the county, then shows only this answer.
 */
export default async function CashToClose({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("cash")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const inputs = { ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct), county: String(a.county), assistance: 0 };
  const cash = cashToClose(inputs);
  const extra = cash.total - cash.down;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={money(cash.total)}
        sentence={<>is the cash you would need on a {money(inputs.price)} home in {inputs.county} County. The down payment is only {money(cash.down)} of it; the other {money(extra)} is what surprises most buyers.</>}
        art={<CashStack lines={cash.lines} total={cash.total} down={cash.down} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="Line by line"
        layer
        rows={cash.lines.map((l) => ({
          label: l.credited ? `${l.label}, back at closing` : l.label,
          note: l.note,
          amount: money(l.amount),
          muted: l.credited,
        }))}
        total={{ label: "Cash you bring", amount: money(cash.total) }}
      />
      <WorkedOut assumptions={cash.assumptions} couldBeWrong={cash.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: money(cash.total), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
