import type { Metadata } from "next";
import { BUYER_DEFAULTS, cashToClose, georgiaClosing, monthlyCost, sellerHelp, money } from "@/lib/core/compute";
import { RESERVE_MONTHS } from "@/lib/core/ledger";
import { currentRate } from "@/lib/db/rates";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut, IfApprovedCard } from "@/components/rift/value/parts";
import { IfApprovedPrompt } from "@/components/rift/value/IfApproved";
import { matchFromAnswers } from "@/lib/db/assistance-match";
import { ifApproved } from "@/lib/core/if-approved";
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
 * the down payment and the county, then shows only this answer. Georgia's
 * intangible tax is named inside the closing estimate (not added to it),
 * what seller help would take off is shown at the two common limits, and the
 * ledger's suggested reserve sits beside the total, never in it
 * (docs/audit/value-depth-2026-10.md §4.2).
 */
export default async function CashToClose({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("cash")!;
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

  const inputs = { ...BUYER_DEFAULTS, price: Number(a.price), downPct: Number(a.downPct), county: String(a.county), assistance: 0 };
  const cash = cashToClose(inputs);
  const extra = cash.total - cash.down;
  const ga = georgiaClosing(inputs);
  const help = [3, 6].map((p) => sellerHelp(inputs, p));
  const rate = await currentRate();
  const reserve = monthlyCost({ ...inputs, ratePct: rate.pct }).total * RESERVE_MONTHS;
  const match = await matchFromAnswers(a);
  const approved = match ? ifApproved(inputs, match) : null;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={money(cash.total)}
        sentence={<>is the cash you would need on a {money(inputs.price)} home in {inputs.county} County. The down payment is only {money(cash.down)} of it; the other {money(extra)} is what surprises most buyers.</>}
        art={<CashStack lines={cash.lines} total={cash.total} down={cash.down} />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />

      <Lines
        title="Line by line"
        rows={cash.lines.flatMap((l) => l.label === "Closing costs" && ga.intangible > 0
          ? [
            { label: "Georgia intangible tax on your loan", note: `$1.50 for every $500 of the ${money(ga.loan)} loan, set by the state and paid at closing`, amount: money(ga.intangible), muted: false },
            { label: "Other closing costs", note: "Lender, title, attorney and recording: the rest of the estimate", amount: money(ga.other), muted: false },
          ]
          : [{
            label: l.credited ? `${l.label}, back at closing` : l.label,
            note: l.note,
            amount: money(l.amount),
            muted: l.credited,
          }])}
        total={{ label: "Cash you bring", amount: money(cash.total) }}
      />
      {approved ? (
        <IfApprovedCard program={approved.program} administrator={approved.administrator}>
          If {approved.program} approves you, up to {money(approved.amount)}, the cash you bring could be {money(approved.cash)} instead of {money(cash.total)}.
        </IfApprovedCard>
      ) : !match ? <IfApprovedPrompt href={def.href} asks={def.asks} given={a} /> : null}

      <Lines
        title="If the seller pays toward your costs"
        rows={[
          ...help.map((h) => ({
            label: `${h.pct}% of the price`,
            note: h.pct === 3 ? "The limit on a conventional loan with under 10% down" : "The limit on an FHA loan, and on a conventional loan with 10% or more down",
            amount: money(h.total),
          })),
        ]}
      />
      <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}>
        It comes off the closing costs and prepaids, never the down payment. Asking costs nothing, and it is often worth more to you than the same amount off the price.
      </p>
      <Lines
        title="Beside the total, not in it"
        rows={[{
          label: "A cushion after closing",
          note: `${RESERVE_MONTHS} months of the full monthly payment at this week's ${rate.pct.toFixed(2)}% rate. Lenders like to see money left over; it is a suggestion, not part of the cost`,
          amount: money(Math.round(reserve)),
        }]}
      />
      <WorkedOut
        assumptions={[...cash.assumptions, { label: "Georgia intangible tax", value: "$1.50 per $500 of the loan (O.C.G.A. § 48-6-61), inside the closing estimate" }]}
        couldBeWrong={cash.couldBeWrong}
      />

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: money(cash.total), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
