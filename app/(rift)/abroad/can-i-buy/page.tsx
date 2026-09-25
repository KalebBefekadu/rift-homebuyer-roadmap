import type { Metadata } from "next";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { STATUSES, statusById, type StatusId, type Use } from "@/lib/core/abroad";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { DownFloors } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "Can I buy a home in the United States from where I live?",
  description: "You don't need citizenship, a green card or a visa to own property in the United States. What your residency status means for owning, financing and closing.",
};

export const dynamic = "force-dynamic";

const SHORT: Record<StatusId, string> = { citizen: "Citizen", resident: "Green card or visa", itin: "ITIN", foreign: "No U.S. status" };

/**
 * Value: can I buy in the United States (Blueprint v5 §5.4, D20 first abroad).
 *
 * The answer to "am I allowed" is yes for every status, and it says so in the
 * United States' terms, not Georgia's: people abroad care about the U.S. and
 * many do not know Georgia (Kaleb, R1). What changes by status is financing,
 * so that is the rest of the answer: the smallest down payment a lender takes,
 * the rate on top, and what they will ask for. The figures are the lenders'
 * floors in lib/core/abroad.ts, where the abroad readout reads them too.
 */
export default async function CanIBuy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("eligibility")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="abroad" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const s = statusById(a.status as StatusId);
  const use = a.use as Use;
  const floor = s.down[use];

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure="Yes"
        sentence={<>You don&apos;t need citizenship, a green card, or a visa to own property in the United States. What your situation changes is the loan: lenders usually want at least {floor}% down for a home {use === "live" ? "your family lives in" : "you rent out"}{s.ratePremium ? `, at about ${s.ratePremium} points above an ordinary rate` : ""}. Paying cash avoids that entirely.</>}
        art={<DownFloors floors={STATUSES.map((x) => ({ id: x.id, label: SHORT[x.id], pct: x.down[use] }))} mine={s.id} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="What your situation means"
        rows={[
          { label: "Owning the home", note: "No citizenship or residency requirement anywhere in the United States", amount: "Allowed" },
          { label: "Smallest down payment, usually", note: use === "live" ? "For a home you or your family live in" : "For a home you rent out", amount: `${floor}%` },
          { label: "Rate on top of an ordinary loan", note: "Fewer lenders make these loans, and they price the risk", amount: s.ratePremium ? `+${s.ratePremium} points` : "None" },
          { label: "What a lender will ask for", note: s.asks, amount: "" },
          { label: "Paying cash", note: "No lender, so none of the above. The closing attorney will ask how the money arrives", amount: "Possible" },
        ]}
      />
      <WorkedOut
        assumptions={[
          { label: "Your situation", value: s.label },
          { label: "The home", value: use === "live" ? "Lived in" : "Rented out" },
          { label: "Down payment and rate", value: "The usual floors lenders publish for this situation, not a quote" },
        ]}
        couldBeWrong="Each lender sets its own terms, and some will ask for more than this. Tax on rent and on a later sale depends on your own country's treaty with the United States: ask a U.S. tax adviser who works with owners abroad."
      />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `Yes, ${floor}% down`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
