import type { Metadata } from "next";
import { money } from "@/lib/core/compute";
import { sellerNet } from "@/lib/core/seller";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { ProceedsFlow } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "What would I actually keep if I sold?",
  description: "What reaches you after your loan payoff, commission and every Georgia cost of selling. Worked out from your own numbers, free.",
};

export const dynamic = "force-dynamic";

/**
 * Value: net proceeds (Blueprint v5 §5.3, D20 first for sellers; MONEY-06).
 *
 * The seller's mirror of cash to close: the list price is not the number.
 * Commission is the seller's own answer, and "not agreed yet" leaves it out
 * and says so rather than using a rate we picked (lib/core/seller.ts).
 */
export default async function Proceeds({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("proceeds")!;
  /* The published words (D37), or the code's when they cannot be read in time. */
  const words = await valueWording(def);
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow defs={words.defs} tool={def.id} side="sell" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const price = Number(a.salePrice);
  const payoff = Number(a.payoff);
  const commissionPct = a.commission === "none" ? null : Number(a.commission);
  const r = sellerNet({ price, payoff, county: String(a.county), commissionPct });
  const underwater = r.net < 0;

  const sentence = underwater
    ? <>would have to be brought to closing to sell at {money(price)}: what you owe and the costs of selling are more than the price. That is a problem to solve before listing, and it has answers; Kaleb can walk through them with you.</>
    : <>would reach you from a {money(price)} sale in {String(a.county)} County, after {payoff > 0 ? `the ${money(payoff)} you owe and ` : ""}{money(r.costs.total)} of selling costs{r.costs.commissionKnown ? "" : ", before commission"}.</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={underwater ? money(r.shortfall) : money(r.net)}
        tone={underwater ? "neg" : undefined}
        sentence={sentence}
        art={<ProceedsFlow price={price} net={r.net} parts={[{ label: "Loan payoff", amount: payoff }, ...r.costs.lines.map((l) => ({ label: l.short, amount: l.amount }))]} />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />

      {!r.costs.commissionKnown ? (
        <p className="t-sm c-2 mt-3 measure row-t gap-2" style={{ lineHeight: 1.6 }}>
          <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
          <span>Commission is not included because you have not agreed one. Each 1% you agree is {money(r.costs.perPoint)} on this price. There is no standard rate: it is yours to negotiate.</span>
        </p>
      ) : null}

      <Lines
        title={underwater ? "From the price to the shortfall" : "From the price to what you keep"}
        rows={[
          { label: "Sale price", note: "Your figure, not an estimate of ours", amount: money(price) },
          ...(payoff > 0 ? [{ label: "Loan payoff", note: "Exact only on your lender's payoff statement", amount: `−${money(payoff)}` }] : []),
          ...r.costs.lines.map((l) => ({ label: l.label, note: l.note, amount: `−${money(l.amount)}` })),
        ]}
        total={{ label: underwater ? "Short at closing" : "Reaches you", amount: underwater ? `−${money(r.shortfall)}` : money(r.net) }}
      />
      <p className="t-sm c-3 mt-3 measure" style={{ lineHeight: 1.6 }}>
        Not taken off: moving, which is not paid at closing, and anything a buyer asks for until you agree it.
        If a buyer asks for 1% toward their costs, that is {money(r.concessionPerPoint)}.
      </p>
      <WorkedOut assumptions={r.assumptions} couldBeWrong={r.couldBeWrong} />

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: underwater ? `${money(r.shortfall)} short` : money(r.net), href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
