import type { Metadata } from "next";
import { preparePlan, type Finish, type Roof, type Systems, type PrepItem } from "@/lib/core/seller";
import { hasAll, parseAnswers, answersToQuery } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { valueWording } from "@/lib/db/questions";
import { ValueLayout, AnswerHead, BasedOn } from "@/components/rift/value/parts";
import { AfterAnswer } from "@/components/rift/value/AfterAnswer";
import { PrepRooms } from "@/components/rift/value/artifacts";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "Should I fix things before I sell?",
  description: "What is worth addressing before you list a Georgia home, what maybe, and what not yet, from three questions about the house.",
};

export const dynamic = "force-dynamic";

/**
 * Value: preparation (Blueprint v5 §5.3, D20 fourth for sellers; MONEY-06).
 *
 * Three questions about the house, and three lists. No costs and no
 * "pays back": nothing here could know what a repair returns on a given
 * street, so it says why each item matters and leaves the money to Kaleb.
 */
export default async function Prepare({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("prepare")!;
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

  const plan = preparePlan({ roof: a.roof as Roof, systems: a.systems as Systems, finish: a.finish as Finish });
  const n = plan.address.length;

  return (
    <ValueLayout def={def}>
      <AnswerHead
        def={def}
        figure={`${n} thing${n === 1 ? "" : "s"}`}
        sentence={<>are worth addressing before you list, {plan.maybe.length} may be, and {plan.notYet.length} can wait. None of it needs doing before you talk to anyone.</>}
        art={<PrepRooms counts={{ now: n, maybe: plan.maybe.length, skip: plan.notYet.length }} />}
      />
      <BasedOn def={def} answers={a} defs={words.defs} />
      <section className="sec-sm g3 gap-4">
        <PrepList title="Worth addressing" icon={<Ico.check size={15} className="c-pos" />} items={plan.address} />
        <PrepList title="Maybe" icon={<Ico.info size={15} className="c-warn" />} items={plan.maybe} />
        <PrepList title="Not yet" icon={<Ico.clock size={15} className="c-3" />} items={plan.notYet} />
      </section>
      <p className="t-sm c-3 measure" style={{ lineHeight: 1.6 }}>
        No costs or returns are shown, on purpose: what a repair is worth depends on the house and the street,
        and a figure we made up would be worse than none. Kaleb can tell you what he would do with yours.
      </p>
      <AfterAnswer
        questions={words}
        tool={def.id}
        answers={a}
        entry={{ tool: def.id, label: def.name, figure: `${n} to address`, href: `${def.href}?${answersToQuery(a, def.asks)}` }}
      />
    </ValueLayout>
  );
}

function PrepList({ title, icon, items }: { title: string; icon: React.ReactNode; items: PrepItem[] }) {
  return (
    <div className="card p-5">
      <h2 className="t-lg w6 row gap-2">{icon}{title}</h2>
      {items.length ? (
        <ul className="col gap-3 mt-3">
          {items.map((i) => (
            <li key={i.item}>
              <div className="t-md w55">{i.item}</div>
              <p className="t-sm c-3 mt-1" style={{ lineHeight: 1.55 }}>{i.why}</p>
            </li>
          ))}
        </ul>
      ) : <p className="t-sm c-4 mt-3">Nothing here for your house.</p>}
    </div>
  );
}
