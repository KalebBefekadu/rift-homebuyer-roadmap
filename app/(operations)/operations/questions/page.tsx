import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { ASKS } from "@/lib/core/asks";
import { VALUES, type InputKey, type ValueSide } from "@/lib/core/values";
import { Ico } from "@/components/rift/icons";

export const metadata: Metadata = { title: "Questions", robots: { index: false } };
export const dynamic = "force-dynamic";

const SIDES: { id: ValueSide; label: string }[] = [
  { id: "buy", label: "Buyers" },
  { id: "sell", label: "Sellers" },
  { id: "abroad", label: "Buying from abroad" },
];

/**
 * What a visitor is asked, word for word (D31).
 *
 * This page used to edit the wording of the v4 questionnaire. That
 * questionnaire was retired for the v5 values (§5.6), so its edits reached
 * nobody: a page that saved and versioned words no visitor could see, which
 * is worse than no page. The values ask their questions from one definition
 * per answer (lib/core/asks.ts), shared by every value, and those words
 * change with a release. This shows them as they are, and which values ask
 * each, so the agent can read exactly what a stranger reads. Making them
 * editable here again is D31's reversal.
 */
export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await agentSession();
  /* A blip is not an expired session: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const sp = await searchParams;
  const raw = Array.isArray(sp.side) ? sp.side[0] : sp.side;
  const side: ValueSide = SIDES.some((s) => s.id === raw) ? (raw as ValueSide) : "buy";
  const values = VALUES.filter((v) => v.side === side && v.live);
  /* Each question once, in the order the values first ask it. */
  const keys = [...new Set(values.flatMap((v) => v.asks))] as InputKey[];

  return (
    <main className="shell-w">
      <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,32px)", letterSpacing: "-0.02em" }}>Questions</h1>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 600 }}>
        Exactly what a visitor reads, and which values ask it. An answer given once is reused by
        every value, so each question is asked once. The words change with a release; say which
        you would put differently and they will be changed.
      </p>

      <div className="row gap-2 wrap" style={{ marginTop: 18 }}>
        {SIDES.map((s) => (
          <Link key={s.id} href={`/operations/questions?side=${s.id}`} className={`btn btn-sm ${side === s.id ? "btn-p" : "btn-g"}`} aria-current={side === s.id ? "page" : undefined}>{s.label}</Link>
        ))}
      </div>

      {keys.length ? (
        <ol className="col gap-3" style={{ marginTop: 18 }}>
          {keys.map((k) => {
            const a = ASKS[k];
            const askedBy = values.filter((v) => v.asks.includes(k));
            return (
              <li key={k} className="card p-4">
                <div className="between wrap gap-2">
                  <h2 className="t-md w6">{a.title}</h2>
                  <span className="t-xs c-4">{a.type === "money" ? a.unitLabel ?? "An amount" : `${a.options?.length ?? 0} choices`}</span>
                </div>
                {a.why ? <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>{a.why}</p> : null}
                {a.type === "choice" && a.options && a.options.length <= 12 ? (
                  <ul className="row wrap gap-1" style={{ marginTop: 8 }}>
                    {a.options.map((o) => <li key={o.value} className="chip t-xs">{o.label}{o.hint ? <span className="c-4"> · {o.hint}</span> : null}</li>)}
                  </ul>
                ) : null}
                <p className="t-xs c-4" style={{ marginTop: 8 }}>Asked by {askedBy.map((v) => v.name).join(", ")}</p>
              </li>
            );
          })}
        </ol>
      ) : <p className="card p-4 t-sm c-3" style={{ marginTop: 18 }}>No live value on this side asks anything yet.</p>}

      <div className="card p-4" style={{ marginTop: 24 }}>
        <div className="row-t gap-2">
          <Ico.shield size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
          <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
            What a question feeds is fixed in code: county feeds the programs and taxes, savings and
            the monthly amount feed the timeline, ownership decides first-time status. Wording can
            change; what an answer does cannot.
          </p>
        </div>
      </div>
    </main>
  );
}
