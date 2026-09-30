import type { Metadata } from "next";
import { PMI_NOTE, money } from "@/lib/core/compute";
import { affordability } from "@/lib/core/afford";
import { currentRate } from "@/lib/db/rates";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn, Lines, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { MonthlyHomes } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "How much home fits me?",
  description: "The price your comfortable monthly payment reaches in Georgia, beside two common planning guidelines. A plan, not a lending decision.",
};

export const dynamic = "force-dynamic";

/**
 * Value: what fits (Blueprint v5 §5.2, MONEY-05). A planning scenario built
 * on the payment the person chose; the rules and their bounds are
 * lib/core/afford.ts, tested before this page existed.
 */
export default async function Afford({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("afford")!;
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
  const r = affordability({ income: Number(a.income), debts: Number(a.debts), comfort: Number(a.comfort), downPct: Number(a.downPct), ratePct: rate.pct });
  const priced = r.scenarios.filter((x) => x.price !== null).sort((x, y) => x.price! - y.price!);
  const band = priced.map((x) => ({ price: x.price!, monthly: x.payment }));
  const focus = priced.findIndex((x) => x === r.comfort);
  const m = r.monthlyAt;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={r.comfort.price !== null ? `About ${money(r.comfort.price)}` : "No price yet"}
        sentence={r.comfort.price !== null
          ? <>is the home price a {money(Number(a.comfort))} monthly payment reaches, all in, with {String(a.downPct)}% down at today&apos;s {rate.pct.toFixed(2)}% rate. It is a plan, not what a lender will approve.</>
          : <>{money(Number(a.comfort))} a month does not cover a home&apos;s insurance and taxes on its own. Try a higher payment, or talk it through with Kaleb.</>}
        art={band.length ? <MonthlyHomes band={band} focus={Math.max(focus, 0)} parts={m ? [
          { label: "Principal and interest", amount: m.pi }, { label: "Property tax", amount: m.tax },
          { label: "Insurance", amount: m.insurance }, { label: "Mortgage insurance", amount: m.pmi },
        ] : []} /> : <div />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />

      {r.stretch ? (
        <p className="t-sm c-2 mt-3 measure row-t gap-2" style={{ lineHeight: 1.6 }}>
          <Ico.info size={14} className="c-warn" style={{ flex: "none", marginTop: 3 }} />
          <span>Your comfortable payment is above both planning guidelines below. That is your call to make; it is worth knowing you are making it.</span>
        </p>
      ) : null}

      <Lines
        title="Three ways to look at it"
        rows={r.scenarios.map((x) => ({
          label: `${x.label}: ${money(Math.round(x.payment))} a month`,
          note: x.note,
          amount: x.price !== null ? money(x.price) : "No price",
        }))}
      />
      {m ? (
        <Lines
          title={`What ${money(Math.round(m.total))} a month is made of`}
          rows={[
            { label: "Principal and interest", amount: money(Math.round(m.pi)) },
            { label: "Property tax", amount: money(Math.round(m.tax)) },
            { label: "Home insurance", amount: money(Math.round(m.insurance)) },
            ...(m.pmi > 0 ? [{ label: "Mortgage insurance", note: `Until you reach 20% equity. ${PMI_NOTE}`, amount: money(Math.round(m.pmi)) }] : []),
          ]}
        />
      ) : null}
      <WorkedOut assumptions={r.assumptions} couldBeWrong={r.couldBeWrong} />

      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: r.comfort.price !== null ? `about ${money(r.comfort.price)}` : "no price yet", href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
