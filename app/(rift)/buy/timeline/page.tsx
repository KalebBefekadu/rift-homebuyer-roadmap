import type { Metadata } from "next";
import { BUYER_DEFAULTS, cashGap, gapLevers, money } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { TimelinePath } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "When could I buy?",
  description: "How many months until you have the cash to buy in Georgia, and the two changes that shorten it most.",
};

export const dynamic = "force-dynamic";

/**
 * Value: timeline (Blueprint v5 §5.2, D20 fourth).
 *
 * The cash needed is the cash-to-close figure; the gap is what savings do not
 * cover yet. Assistance is not counted (MONEY-02): it is upside until a lender
 * says yes. An unknown saving rate never becomes "ready now": no monthly
 * saving means no date, said plainly.
 */
export default async function Timeline({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("timeline")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="buy" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const inputs = {
    ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct),
    savings: Number(a.savings), monthlySaving: Number(a.monthlySaving), assistance: 0,
  };
  const g = cashGap(inputs);
  const levers = gapLevers(inputs).slice(0, 2);
  const months = g.fullyCovered ? 0 : g.monthsToClose;

  const figure = g.fullyCovered ? "Now" : months === null ? "No date yet" : `${months} month${months === 1 ? "" : "s"}`;
  const sentence = g.fullyCovered
    ? <>Your {money(inputs.savings)} already covers the {money(g.cashNeeded)} you would need on a {money(inputs.price)} home. The next question is the monthly cost.</>
    : months === null
      ? <>You are {money(g.gap)} short of the {money(g.cashNeeded)} a {money(inputs.price)} home needs. With nothing set aside each month there is no date to give; any amount gives you one.</>
      : <>until you have the {money(g.cashNeeded)} a {money(inputs.price)} home needs, saving {money(inputs.monthlySaving)} a month towards the {money(g.gap)} still to find.</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={sentence}
        art={<TimelinePath months={months} faster={levers[0] ? { label: levers[0].label, months: levers[0].months } : null} />}
      />
      <BasedOn def={def} answers={a} />

      {levers.length ? (
        <Lines
          title="The two changes that shorten it most"
          rows={levers.map((l) => ({ label: l.label, note: l.detail, amount: `${l.saved} month${l.saved === 1 ? "" : "s"} sooner` }))}
        />
      ) : null}
      <Lines
        title="Where the months come from"
        rows={[
          { label: "Cash needed to buy", note: "The cash-to-close figure for this price and down payment", amount: money(g.cashNeeded) },
          { label: "Saved so far", amount: money(inputs.savings) },
          { label: "Still to find", amount: money(g.gap) },
          { label: "Set aside each month", amount: inputs.monthlySaving > 0 ? money(inputs.monthlySaving) : "Nothing yet" },
        ]}
      />
      <WorkedOut assumptions={g.assumptions} couldBeWrong={g.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
