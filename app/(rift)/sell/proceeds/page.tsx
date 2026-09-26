import type { Metadata } from "next";
import { money, range, sellerNet } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery, commissionOf } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { ProceedsFlow } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What would I actually keep?",
  description: "What reaches you from a Georgia home sale after the loan payoff and every cost of selling. Worked out from your answers.",
};

export const dynamic = "force-dynamic";

/**
 * Value: what you'd keep (Blueprint v5 §5.3, D20 first on the seller side).
 *
 * The list price is not the number. Asks the price, what is still owed and
 * the commission, then shows only this answer. With no commission agreed the
 * figure is a range, never a standard rate in disguise (MONEY-06). A sale
 * below the payoff is said as a shortfall, never as money reaching anyone.
 */
export default async function Proceeds({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("proceeds")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="sell" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const price = Number(a.price);
  const payoff = Number(a.payoff);
  const r = sellerNet(price, payoff, commissionOf(a.commission));
  /* Short only when even the best case is short: a range that crosses zero is
     shown as the range it is, with its minus sign. */
  const underwater = r.net < 0;
  const figure = underwater
    ? (r.netLow === null ? money(-r.net) : range(-r.net, -r.netLow))
    /* The range reads low to high: the high commission gives the low net. */
    : (r.netLow === null ? money(r.net) : range(r.netLow, r.net));

  const sentence = underwater
    ? <>is what you would need to bring to closing on a {money(price)} sale: the {money(payoff)} still owed plus the costs of selling is more than the price. That is worth knowing now, and there are ways through it worth talking about.</>
    : <>is what reaches you from a {money(price)} sale, after the {money(payoff)} still owed and {r.totalHigh === null ? money(r.total) : range(r.total, r.totalHigh)} of selling costs.{r.netLow === null ? "" : " The range is the commission you have not agreed yet."}</>;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        tone={underwater ? "neg" : undefined}
        sentence={sentence}
        art={<ProceedsFlow price={price} parts={[{ label: "Loan payoff", amount: payoff }, { label: "Selling costs", amount: r.total }]} net={r.net} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="From the price to what you keep"
        layer
        rows={[
          { label: "Sale price", amount: money(price) },
          { label: "Loan payoff", note: "What you still owe, exact only on a lender's payoff statement", amount: `−${money(payoff)}` },
          ...r.lines.map((l) => ({ label: l.label, note: l.note, amount: `−${money(l.amount)}` })),
          ...(r.totalHigh === null ? [] : [{ label: "Commission at the high end", note: "The extra if you agree the top of the range", amount: `−${money(r.totalHigh - r.total)}`, muted: true }]),
        ]}
        total={{ label: underwater ? "Short at closing" : "Reaches you", amount: figure }}
      />
      <WorkedOut assumptions={r.assumptions} couldBeWrong={r.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: underwater ? `${figure} short` : figure, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
