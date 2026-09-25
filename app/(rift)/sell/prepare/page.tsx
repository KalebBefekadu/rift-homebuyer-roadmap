import type { Metadata } from "next";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { prepTriage, type Interior, type KitchenAge, type Systems, type PrepVerdict } from "@/lib/core/prepare";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout, AnswerHead, BasedOn, WorkedOut } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { PrepRooms } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "Should I fix things before I list?",
  description: "What is worth doing before you sell a Georgia home, what maybe, and what not yet, from three questions about its condition.",
};

export const dynamic = "force-dynamic";

/* Never colour alone (rule 10): each group has its word and its icon. */
const GROUPS: { verdict: PrepVerdict; title: string; icon: keyof typeof Ico }[] = [
  { verdict: "now", title: "Worth doing now", icon: "checkCircle" },
  { verdict: "maybe", title: "Maybe", icon: "info" },
  { verdict: "later", title: "Not yet", icon: "pause" },
];

/**
 * Value: should I fix it first (Blueprint v5 §5.3). Reasons, never a dollar
 * return (MONEY-06): see lib/core/prepare.ts.
 */
export default async function Prepare({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("prepare")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="sell" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  const r = prepTriage({
    price: Number(a.price),
    interior: a.interior as Interior,
    kitchen: a.kitchen as KitchenAge,
    systems: a.systems as Systems,
  });
  const n = r.counts.now;
  const figure = `${n} thing${n === 1 ? "" : "s"}`;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={figure}
        sentence={<>worth doing before you list, {r.counts.maybe ? `${r.counts.maybe} to weigh up` : "nothing to weigh up"}, and {r.counts.skip ? `${r.counts.skip} to leave` : "nothing to leave"}. No big projects: what sells a house is that it looks cared for.</>}
        art={<PrepRooms counts={r.counts} />}
      />
      <BasedOn def={def} answers={a} />

      {GROUPS.map((g) => {
        const items = r.items.filter((x) => x.verdict === g.verdict);
        if (!items.length) return null;
        const Icon = Ico[g.icon];
        return (
          <section key={g.verdict} className="sec-sm" aria-labelledby={`g-${g.verdict}`}>
            <h2 id={`g-${g.verdict}`} className="t-xl serif row gap-2">
              <Icon size={18} className={g.verdict === "now" ? "c-brand" : "c-4"} />{g.title}
            </h2>
            <div className="card mt-3" style={{ overflow: "hidden" }}>
              {items.map((x) => (
                <div key={x.item} style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-3)" }}>
                  <div className="t-md w55">{x.item}</div>
                  <div className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>{x.why}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <WorkedOut assumptions={r.assumptions} couldBeWrong={r.couldBeWrong} />

      <AfterAnswer
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${n} to do first`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}
