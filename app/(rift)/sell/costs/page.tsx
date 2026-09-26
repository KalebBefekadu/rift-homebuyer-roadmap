import type { Metadata } from "next";
import { money, pct, range, sellingCosts } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery, commissionOf } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { CostBlocks } from "@/components/rift/value/artifacts";

export const metadata: Metadata = {
  title: "What will selling cost me?",
  description: "Each cost of selling a Georgia home, line by line, with commission as your own number rather than a standard rate.",
};

export const dynamic = "force-dynamic";

/**
 * Value: selling costs (Blueprint v5 §5.3, D20 third on the seller side).
 *
 * Two questions: the price and the commission. The commission is theirs to
 * negotiate, so it is asked, and "not agreed yet" is shown as a range
 * (MONEY-06). No payoff is asked, so the payoff wire fees are left out; the
 * "What you'd keep" value adds them when there is a loan.
 */
export default async function SellingCosts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("costs")!;
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
  const c = sellingCosts(price, commissionOf(a.commission));
  const figure = c.totalHigh === null ? money(c.total) : range(c.total, c.totalHigh);
  const share = (c.total / price) * 100;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={c.totalHigh === null
          ? <>is what selling a {money(price)} home would cost you, about {pct(share)} of the price. Commission is most of it, and it is the one line you negotiate.</>
          : <>is what selling a {money(price)} home would cost you. The range is the commission: you have not agreed one, and there is no standard rate to assume.</>}
        art={<CostBlocks parts={c.lines.map((l) => ({ label: l.label, amount: l.amount }))} total={c.total} />}
      />
      <BasedOn def={def} answers={a} />

      <Lines
        title="Line by line"
        layer
        rows={[
          ...c.lines.map((l) => ({ label: l.label, note: l.note, amount: money(l.amount) })),
          ...(c.totalHigh === null ? [] : [{ label: "Commission at the high end", note: "The extra if you agree the top of the range", amount: money(c.totalHigh - c.total), muted: true }]),
        ]}
        total={{ label: "Cost of selling", amount: figure }}
      />
      <WorkedOut assumptions={c.assumptions} couldBeWrong={c.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
