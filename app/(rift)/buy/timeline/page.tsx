import type { Metadata } from "next";
import { BUYER_DEFAULTS, cashGap, gapLevers, money } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { TimelinePath } from "@/components/rift/value/artifacts";
import { timelinePlan } from "@/lib/core/timeline";

export const metadata: Metadata = {
  title: "When could I buy?",
  description: "How many months until you have the cash to buy in Georgia, against when you want to buy, and the smallest change that closes the gap.",
};

export const dynamic = "force-dynamic";

/**
 * Value: timeline (Blueprint v5 §5.2, D20 fourth).
 *
 * The cash needed is the cash-to-close figure; the gap is what savings do not
 * cover yet. Assistance is not counted (MONEY-02): it is upside until a lender
 * says yes. An unknown saving rate never becomes "ready now": no monthly
 * saving means no date, said plainly.
 *
 * Their own date is asked and compared (rule 11, handoff §4.15), and for a
 * date they miss each lever is solved for it (lib/core/timeline.ts). The
 * moving target sits beside the headline, never in it: it is an assumption
 * about prices, not their numbers.
 */
export default async function Timeline({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("timeline")!;
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

  const inputs = {
    ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct),
    savings: Number(a.savings), monthlySaving: Number(a.monthlySaving), assistance: 0,
  };
  const g = cashGap(inputs);
  const levers = gapLevers(inputs).slice(0, 2);
  const months = g.fullyCovered ? 0 : g.monthsToClose;
  const plan = timelinePlan(inputs, a.target === "exploring" ? "exploring" : Number(a.target));
  const stated = plan.stated;
  const wanted = stated ? (stated.months === 12 ? "within a year" : stated.months % 12 === 0 ? `within ${["", "one", "two", "three"][stated.months / 12]} years` : `within ${stated.months} months`) : null;
  const span = (m: number) => `${m} month${m === 1 ? "" : "s"}`;

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
      <BasedOn def={def} answers={a} defs={words.defs} />

      {stated ? (
        <section className="sec-sm" aria-labelledby="said-h">
          <div className="card p-5">
            <div className="kicker c-brand" id="said-h">You said {wanted}</div>
            <p className="t-md mt-2 measure" style={{ lineHeight: 1.6 }}>
              {stated.computed === null
                ? <>With nothing set aside each month there is no date to compare it with yet. The first change below gives you one.</>
                : stated.onTrack
                  ? stated.late! <= 0
                    ? <>Your numbers say {stated.computed === 0 ? "now" : span(stated.computed)}{stated.late! < 0 ? `, ${span(-stated.late!)} to spare` : ""}. You are on track for it.</>
                    : <>Your numbers say {span(stated.computed)}, a month past it. That is close enough to call on track; a little more each month makes it certain.</>
                  : <>Your numbers say {span(stated.computed)}: {span(stated.late!)} later. Any one of the changes below gets you there on its own.</>}
            </p>
          </div>
        </section>
      ) : null}

      {plan.forTarget.length ? (
        <Lines
          title={`What it takes to buy ${wanted}`}
          rows={plan.forTarget.map((l) => ({ label: l.label, note: l.detail, amount: "Meets your date" }))}
        />
      ) : null}

      {!plan.forTarget.length && levers.length ? (
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
      {plan.moving && months !== null && plan.moving.months > months ? (
        <Lines
          title="If prices keep rising while you save"
          rows={[{
            label: `At ${plan.growthPct}% a year`,
            note: `The same home would be about ${money(plan.moving.price)} by then, so the cash it needs grows too. A planning rate, not a forecast.`,
            amount: span(plan.moving.months),
          }]}
        />
      ) : plan.outpaced ? (
        <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}>
          If prices rise {plan.growthPct}% a year, saving {money(inputs.monthlySaving)} a month would not catch up with this price. A lower price or a larger monthly amount changes that.
        </p>
      ) : null}
      <WorkedOut
        assumptions={[...g.assumptions, { label: "Price growth while you save", value: `${plan.growthPct}% a year, shown beside the answer and never in it` }]}
        couldBeWrong={g.couldBeWrong}
      />

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
