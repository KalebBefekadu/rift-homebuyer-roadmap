import type { Metadata } from "next";
import { BUYER_DEFAULTS, LOAN_NAME, PMI_TERMINATION_LTV, loanTerms, loanWords, monthlyComputed, owningDetail, money, type BuyerLoan } from "@/lib/core/compute";
import { Ico } from "@/components/rift/icons";
import { taxFor } from "@/lib/core/county-data";
import { currentRate } from "@/lib/db/rates";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
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
 * as their own lines (MONEY-04). Past the total: how much of it is principal,
 * when mortgage insurance comes off on schedule, and how the payment moves
 * with the rate (owningDetail, docs/audit/value-depth-2026-10.md §4.3).
 */
export default async function MonthlyCost({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("monthly")!;
  /* The published words (D37), or the code's when they cannot be read in time. */
  const words = await valueWording(def);
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow defs={words.defs} tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const rate = await currentRate();
  /* The county's verified tax rate when there is one (V1), the planning rate otherwise. */
  const tax = taxFor(String(a.county), BUYER_DEFAULTS.taxPct);
  const inputs = { ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct), county: String(a.county), ratePct: rate.pct, assistance: 0, loanType: a.loanType as BuyerLoan, taxPct: tax.pct };
  const terms = loanTerms(inputs);
  const lw = loanWords(terms);
  const m = monthlyComputed(inputs);
  const own = owningDetail(inputs);
  const step = inputs.price >= 600_000 ? 75_000 : 40_000;
  const band = [inputs.price - step, inputs.price, inputs.price + step].map((p) => ({ price: p, monthly: monthlyComputed({ ...inputs, price: p }).value }));
  const parts = [
    { label: "Principal and interest", amount: m.parts.pi, note: `${inputs.termYears}-year loan of ${money(Math.round(terms.loan))} at ${rate.pct.toFixed(2)}%${lw.fee && terms.upfront > 0 ? `, including the ${lw.fee}` : ""}` },
    { label: "Property tax", amount: m.parts.tax, note: tax.note },
    { label: "Home insurance", amount: m.parts.insurance, note: `${money(inputs.insuranceYr)} a year` },
    { label: lw.mi.label, amount: m.parts.pmi, note: lw.mi.note },
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
      <BasedOn def={def} answers={a} defs={words.defs} />
      {lw.minimum ? (
        <p className="t-sm c-2 mt-3 measure row-t gap-2" style={{ lineHeight: 1.6 }}>
          <Ico.info size={14} className="c-warn" style={{ flex: "none", marginTop: 3 }} />
          <span>{lw.minimum} The figures use the {inputs.downPct}% you chose.</span>
        </p>
      ) : null}

      <Lines
        title="What the monthly payment is made of"
        rows={parts.map((p) => ({ label: p.label, note: p.note, amount: money(Math.round(p.amount)), muted: p.amount === 0 }))}
        total={{ label: "Each month", amount: money(Math.round(m.value)) }}
      />
      <Lines
        title="What your payment does"
        rows={[
          { label: "Principal in your first payment", note: "The part that pays down the loan and stays yours; the rest is interest, tax and insurance", amount: money(Math.round(own.principalFirst)) },
          { label: "Principal in your first year", amount: money(Math.round(own.principalYear)) },
          ...(own.pmiEnds ? [{
            label: `${lw.mi.label} comes off`,
            note: terms.miEnds === "11 years"
              ? "After eleven years, by FHA's rules at 10% down or more."
              : `Around year ${Math.ceil(own.pmiEnds.month / 12)}, when the scheduled balance reaches ${PMI_TERMINATION_LTV}% of the price. Sooner if the home gains value or you pay extra.`,
            amount: `Month ${own.pmiEnds.month}: ${money(Math.round(own.pmiEnds.monthly))} a month less`,
          }] : []),
          ...(own.miForLife ? [{
            label: `${lw.mi.label} stays`,
            note: "For the life of the loan on these terms. Refinancing into a conventional loan once you have 20% equity is the usual way out.",
            amount: `${money(Math.round(terms.miMonthly))} a month`,
          }] : []),
        ]}
      />
      <Lines
        title="If the rate is different when you lock"
        rows={own.byRate.map((r) => ({
          label: `${r.ratePct.toFixed(2)}%`,
          note: Math.abs(r.ratePct - rate.pct) < 0.005 ? "This week's average" : undefined,
          amount: `${money(Math.round(r.total))} a month`,
        }))}
      />
      <Lines
        title="Across three prices"
        rows={band.map((b) => ({ label: money(b.price), note: b.price === inputs.price ? "The price you gave" : undefined, amount: `${money(Math.round(b.monthly))} a month` }))}
      />
      <WorkedOut
        assumptions={[...m.assumptions, { label: "Loan", value: LOAN_NAME[terms.kind] }, { label: "Rate source", value: rate.label }]}
        couldBeWrong={m.couldBeWrong}
      />

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${money(Math.round(m.value))} a month`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
