import type { Metadata } from "next";
import { money, pct } from "@/lib/core/compute";
import { abroadReturns, statusById, ASSUMPTIONS, type StatusId, type Use } from "@/lib/core/abroad";
import { currentRate } from "@/lib/db/rates";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { CashStack } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What would buying a home in the United States cost me from abroad?",
  description: "The cash you would send to buy a home in Georgia from abroad, and what owning it costs each year, for your residency situation.",
};

export const dynamic = "force-dynamic";

/**
 * Value: cost to buy and own, from abroad (Blueprint v5 §5.4, D20 second).
 *
 * The same arithmetic the return value uses (lib/core/abroad.ts), without
 * the rent: what has to be sent, and what owning costs each year. Rent-side
 * costs (management, vacancy, repairs) are counted only when they would rent
 * it out, because they are costs of renting, not of owning.
 *
 * English only so far, and it says so on the Amharic path, for the same
 * reason /abroad/how does: this is written by a person who speaks it or not
 * at all.
 */
export default async function AbroadCost({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("abroad-cost")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;
  const am = one("lang") === "am";
  const englishOnly = am ? <p className="t-sm c-3 mt-3" lang="am">ይህ ገጽ እስካሁን በእንግሊዝኛ ብቻ ነው።</p> : null;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        {englishOnly}
        <ValueFlow tool={def.id} side="abroad" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const status = String(a.status) as StatusId;
  const use = String(a.use) as Use;
  const price = Number(a.price);
  const county = String(a.county);
  const rate = await currentRate();
  const r = abroadReturns({ price, county, status, use }, { ...ASSUMPTIONS, baseRatePct: rate.pct });
  const s = statusById(status);
  const yearly = [
    { label: "Loan payments", amount: r.monthly.pi * 12, note: `${pct(r.ratePct, 2)} on ${money(r.loan)} over ${ASSUMPTIONS.termYears} years` },
    { label: "Property tax", amount: r.monthly.tax * 12, note: `About ${pct(ASSUMPTIONS.taxPct)} of the price a year, with no homestead exemption` },
    { label: "Insurance", amount: r.monthly.insurance * 12, note: "A planning figure; the home decides it" },
    ...(use === "rent" ? [
      { label: "Property management", amount: r.operating.management * 12, note: `${ASSUMPTIONS.managementPct}% of rent, someone local` },
      { label: "Repairs and turnover", amount: r.operating.maintenance * 12, note: `${ASSUMPTIONS.maintenancePct}% of rent, set aside` },
    ] : []),
  ];
  const perYear = yearly.reduce((t, l) => t + l.amount, 0);

  return (
    <ValueLayout def={def}>
      {englishOnly}
      <AnswerHead
        def={def}
        figure={money(r.cashIn)}
        sentence={<>is what you would send to buy a {money(price)} home in {county} County: {s.down[use]}% down, the least a lender takes in your situation, plus closing costs. Owning it then costs about {money(perYear)} a year.</>}
        art={<CashStack lines={[{ label: "Down payment", amount: r.down }, { label: "Closing costs", amount: r.closing }]} total={r.cashIn} down={r.down} />}
      />
      <BasedOn def={def} answers={a} />
      <Lines
        title="What you would send"
        rows={[
          { label: "Down payment", note: `${r.downPct}% of the price`, amount: money(r.down) },
          { label: "Closing costs", note: `About ${ASSUMPTIONS.closingPct}%: attorney, title, recording and lender fees`, amount: money(r.closing) },
        ]}
        total={{ label: "Before you own it", amount: money(r.cashIn) }}
      />
      <Lines
        title="What owning costs each year"
        rows={yearly.map((l) => ({ label: l.label, note: l.note, amount: money(l.amount) }))}
        total={{ label: "Each year", amount: money(perYear) }}
      />
      <WorkedOut
        assumptions={[
          { label: "Interest rate", value: `${pct(rate.pct, 2)} (${rate.asOf ? `Freddie Mac, ${rate.asOf}` : "a starting assumption"}) plus ${pct(s.ratePremium, 2)} for your situation` },
          { label: "Minimum down payment", value: `${s.down[use]}%` },
          { label: "Closing costs", value: `${ASSUMPTIONS.closingPct}% of the price` },
          { label: "Property tax", value: `${pct(ASSUMPTIONS.taxPct)} a year, no homestead exemption` },
          { label: "Insurance", value: `${money(ASSUMPTIONS.insuranceYr)} a year` },
        ]}
        couldBeWrong="The rate depends on the lender and your file, and lenders who work with buyers abroad price that differently. Tax depends on the parcel, and insurance on the house. Money sent from abroad also has transfer costs your bank sets."
      />
      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: money(r.cashIn), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
