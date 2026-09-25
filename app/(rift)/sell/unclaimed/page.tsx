import type { Metadata } from "next";
import { SELLER_DEFAULTS, unclaimedValue } from "@/lib/core/compute";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { ClaimTags } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "Am I losing money on my home already?",
  description:
    "Homestead and senior exemptions, the capital gains exclusion and a payoff check. Worth knowing whether or not you ever sell. Free, and no account.",
};

export const dynamic = "force-dynamic";

/**
 * Value: money you may be losing (Blueprint v5 §5.3, D20 second on the
 * seller side). None of it depends on selling, which is why it is the value a
 * homeowner who is not selling will still use.
 *
 * Rebuilt on the value pattern: one question at a time, answered on the
 * server, then "you can also find out". The old page compared the visitor's
 * price with a sample house's assessed value ($392,000, from the defaults),
 * so anybody who said under about $408,000 was told their assessment "looks
 * high" and worth appealing. Nobody has told us their assessment, so the
 * appeal check is left out rather than invented. `assessedValue` is zero, the
 * one value that turns it off: `unclaimedValue` suggests an appeal when the
 * assessment exceeds 96% of the price, so setting it to the price (what the
 * old seller readout did) suggested an appeal to every seller there was.
 */
export default async function Unclaimed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("unclaimed")!;
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
  const items = unclaimedValue({
    ...SELLER_DEFAULTS,
    price,
    assessedValue: 0,
    yearsOwned: Number(a.yearsOwned),
    homesteadFiled: a.homestead === "yes",
    ageOver65: a.age65 === "yes",
  });
  const figure = `${items.length} thing${items.length === 1 ? "" : "s"}`;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={<>worth a phone call, and who to call about each. {a.homestead === "unsure" ? "You were not sure about homestead, so it is on the list: a two-minute check with your tax commissioner settles it." : "None of it depends on selling."}</>}
        art={<ClaimTags items={items.map((u) => ({ title: u.title, urgent: Boolean(u.urgency) }))} />}
      />
      <BasedOn def={def} answers={a} />

      <section className="sec-sm" aria-labelledby="claims-h">
        <h2 id="claims-h" className="t-xl serif">What to check, and who decides</h2>
        <div className="col gap-2 mt-3">
          {items.map((u) => (
            <div key={u.title} className="card p-4">
              <div className="between wrap gap-2">
                <span className="t-md w6 grow" style={{ minWidth: 200 }}>{u.title}</span>
                {/* Allowed to wrap: "Up to $250,000 single / $500,000 married"
                    is wider than a 320px phone. */}
                <span className="num t-md c-brand" style={{ flex: "0 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{u.estimate}</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>{u.detail}</p>
              <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                <span className="chip" style={{ whiteSpace: "normal", height: "auto", padding: "5px 10px", lineHeight: 1.45 }}><Ico.users size={12} style={{ flex: "none" }} />Decided by {u.decidedBy}</span>
                {/* A sentence, not a label: it has to wrap on a phone. */}
                {u.urgency ? <span className="chip chip-warn" style={{ whiteSpace: "normal", height: "auto", padding: "5px 10px", lineHeight: 1.45 }}><Ico.clock size={12} style={{ flex: "none" }} />{u.urgency}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <WorkedOut
        assumptions={[
          { label: "Home value", value: price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) },
          { label: "Owned for", value: `about ${a.yearsOwned} years` },
          { label: "Homestead filed", value: a.homestead === "yes" ? "Yes" : a.homestead === "no" ? "No" : "Not sure" },
          { label: "65 or older on the deed", value: a.age65 === "yes" ? "Yes" : "No" },
          { label: "Not checked", value: "Your assessment: we do not know it, so no appeal is suggested" },
        ]}
        couldBeWrong="Amounts are typical ranges, not quotes, and each depends on your county's rules and your own circumstances. We are not tax advisers or attorneys: this names the question and who is allowed to answer it."
      />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${items.length} to check`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
