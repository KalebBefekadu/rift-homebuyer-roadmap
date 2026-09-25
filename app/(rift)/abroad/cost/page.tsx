import type { Metadata } from "next";
import { money } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { abroadReturns, statusById, ASSUMPTIONS, ABROAD_DEFAULTS, type StatusId, type Use } from "@/lib/core/abroad";
import { currentRate } from "@/lib/db/rates";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { CashStack } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What would buying and owning a U.S. home cost me?",
  description: "The cash you would send to buy a Georgia home from abroad, and what owning it costs each month, from your residency status and price.",
};

export const dynamic = "force-dynamic";

/**
 * Value: what buying and owning would cost (Blueprint v5 §5.4, D20 second).
 *
 * The cash to send (the lender's smallest down payment for their situation,
 * plus closing costs) and the monthly cost of owning. No rent here: that is
 * the return, the next value, and it is an estimate; this one is not. Same
 * arithmetic as the abroad readout (`abroadReturns`), at the recorded rate.
 */
export default async function AbroadCost({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("abroad-cost")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="abroad" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const rate = await currentRate();
  const status = a.status as StatusId;
  const use = a.use as Use;
  const price = Number(a.price);
  /* County changes only the rent, which this value does not show. */
  const r = abroadReturns({ price, county: ABROAD_DEFAULTS.county, status, use }, { ...ASSUMPTIONS, baseRatePct: rate.pct });
  const s = statusById(status);

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={money(r.cashIn)}
        sentence={<>is the cash you would send to buy a {money(price)} home: {r.downPct}% down, the least lenders usually take in your situation, plus closing costs. Owning it then costs about {money(r.monthly.total)} a month.</>}
        art={<CashStack
          lines={[{ label: "Down payment", amount: r.down }, { label: "Closing costs", amount: r.closing }]}
          total={r.cashIn} down={r.down} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="The cash you send"
        rows={[
          { label: "Down payment", note: `${r.downPct}% of the price, the usual floor for your situation`, amount: money(r.down) },
          { label: "Closing costs", note: `About ${ASSUMPTIONS.closingPct}% of the price: the closing attorney, lender and title`, amount: money(r.closing) },
        ]}
        total={{ label: "Cash to send", amount: money(r.cashIn) }}
      />
      <Lines
        title="Owning it, each month"
        rows={[
          { label: "Loan payment", note: `${money(r.loan)} over ${ASSUMPTIONS.termYears} years at ${r.ratePct.toFixed(2)}%`, amount: money(r.monthly.pi) },
          { label: "Property tax", note: `About ${ASSUMPTIONS.taxPct}% of the price a year, with no homestead exemption: that is for a home you live in as your main residence`, amount: money(r.monthly.tax) },
          { label: "Insurance", amount: money(r.monthly.insurance) },
        ]}
        total={{ label: "Each month", amount: money(r.monthly.total) }}
      />
      <WorkedOut
        assumptions={[
          { label: "Your situation", value: s.label },
          { label: "Rate", value: `${rate.pct.toFixed(2)}% (${rate.source}) plus ${s.ratePremium} for your situation` },
          { label: "Down payment", value: `${r.downPct}%, the usual floor` },
          { label: "Closing costs", value: `${ASSUMPTIONS.closingPct}% of the price` },
          { label: "Insurance", value: `${money(ASSUMPTIONS.insuranceYr)} a year` },
        ]}
        couldBeWrong="A lender's own terms decide the down payment and the rate, and some ask for more. Tax and insurance vary by county and by house. Money sent from abroad can take time to clear and may have transfer fees of its own."
      />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: money(r.cashIn), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
