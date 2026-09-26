import type { Metadata } from "next";
import { BUYER_DEFAULTS, monthlyComputed, money } from "@/lib/core/compute";
import { currentRate } from "@/lib/db/rates";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { MonthlyHomes } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What would I pay each month?",
  description: "Your all-in monthly payment on a Georgia home, at this week's average rate, and how it moves across three prices.",
};

export const dynamic = "force-dynamic";

/**
 * Value: monthly cost (Blueprint v5 §5.2, D20 third).
 *
 * The rate is this week's Freddie Mac average (lib/db/rates.ts), the same
 * number printed in "How this was worked out", so what is shown and what is
 * computed cannot differ. Taxes, insurance and mortgage insurance are shown
 * as their own lines (MONEY-04).
 */
export default async function MonthlyCost({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("monthly")!;
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
  const inputs = { ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct), county: String(a.county), ratePct: rate.pct, assistance: 0 };
  const m = monthlyComputed(inputs);
  const step = inputs.price >= 600_000 ? 75_000 : 40_000;
  const band = [inputs.price - step, inputs.price, inputs.price + step].map((p) => ({ price: p, monthly: monthlyComputed({ ...inputs, price: p }).value }));
  const parts = [
    { label: "Principal and interest", amount: m.parts.pi, note: `${inputs.termYears}-year loan at ${rate.pct.toFixed(2)}%` },
    { label: "Property tax", amount: m.parts.tax, note: `About ${inputs.taxPct}% of the price a year, before any homestead exemption` },
    { label: "Home insurance", amount: m.parts.insurance, note: `${money(inputs.insuranceYr)} a year` },
    { label: "Mortgage insurance", amount: m.parts.pmi, note: inputs.downPct < 20 ? "Charged when less than 20% is put down" : "None at 20% down" },
    { label: "HOA", amount: m.parts.hoa, note: "None assumed; add it if the home has one" },
  ];

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={`${money(Math.round(m.value))}`}
        sentence={<>a month, all in, on a {money(inputs.price)} home with {inputs.downPct}% down. Principal and interest are {money(Math.round(m.parts.pi))} of it; taxes and insurance are the rest most people forget.</>}
        art={<MonthlyHomes band={band} focus={1} parts={parts.map((p) => ({ label: p.label, amount: p.amount }))} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="What the monthly payment is made of"
        layer
        rows={parts.map((p) => ({ label: p.label, note: p.note, amount: money(Math.round(p.amount)), muted: p.amount === 0 }))}
        total={{ label: "Each month", amount: money(Math.round(m.value)) }}
      />
      <Lines
        title="Across three prices"
        rows={band.map((b) => ({ label: money(b.price), note: b.price === inputs.price ? "The price you gave" : undefined, amount: `${money(Math.round(b.monthly))} a month` }))}
      />
      <WorkedOut
        assumptions={[...m.assumptions, { label: "Rate source", value: rate.label }]}
        couldBeWrong={m.couldBeWrong}
      />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${money(Math.round(m.value))} a month`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
