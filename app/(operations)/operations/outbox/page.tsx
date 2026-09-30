import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { outbox } from "@/lib/db/outbox";
import { STATE_LABEL, type OutboxState } from "@/lib/core/outbox";
import { Unavailable } from "../Unavailable";
import { OutboxItem } from "./Item";
import { showTime } from "@/lib/core/day";

export const metadata: Metadata = { title: "Outbox" };
export const dynamic = "force-dynamic";

const WHEN = (iso: string) => showTime(iso);
const CHIP: Record<OutboxState, string> = {
  prepared: "chip-warn", approved: "chip-warn", running: "chip-out", succeeded: "chip-pos", failed: "chip-neg", unknown: "chip-neg", cancelled: "chip-out",
};

/**
 * The outbox (Blueprint v5 §10.2, D04): messages Rift prepared and nobody has
 * sent. Approving sends exactly the words shown, to exactly this person;
 * changing them makes a new draft. Every step is kept, with who took it.
 */
export default async function Outbox() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;
  const r = await outbox(agent.agentId);
  const items = r.ok && "data" in r ? r.data : null;
  const waiting = (items ?? []).filter((x) => ["prepared", "approved", "failed", "unknown"].includes(x.state));
  const past = (items ?? []).filter((x) => !waiting.includes(x));

  return (
    <>
      <main className="shell-w">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Outbox</h1>
        <p className="t-sm c-3 mt-2 measure" style={{ lineHeight: 1.6 }}>
          What Rift prepared for you to send. Nothing leaves until you approve it, and it is sent exactly as shown.
          Just before sending, Rift checks again that the person is still here, has not opted out, and has not replied since.
        </p>
        {!r.ok ? <p className="t-sm c-neg mt-3">The outbox did not load: {r.error}. That is not the same as it being empty.</p>
          : items === null ? <p className="t-sm c-3 mt-3">The outbox is not set up on this database yet (migration 20260927010000).</p> : null}

        <h2 className="t-lg w6" style={{ marginTop: 28 }}>Waiting for you <span className="c-4 w5">{waiting.length}</span></h2>
        {waiting.length ? (
          <div className="col gap-3 mt-3">
            {waiting.map((x) => {
              const last = x.events.at(-1);
              return (
                <OutboxItem key={x.id} id={x.id} state={x.state} stateLabel={STATE_LABEL[x.state]} chip={CHIP[x.state]}
                  to={x.draft.name ? `${x.draft.name} <${x.draft.to}>` : x.draft.to} leadId={x.leadId}
                  subject={x.draft.subject} body={x.draft.body}
                  problem={last?.detail && (x.state === "failed" || x.state === "unknown") ? last.detail : null} />
              );
            })}
          </div>
        ) : <p className="t-sm c-3 mt-2">Nothing waiting.</p>}

        {past.length ? (
          <>
            <h2 className="t-lg w6" style={{ marginTop: 32 }}>Sent and discarded</h2>
            <ul className="mt-2" style={{ display: "grid", gap: 6 }}>
              {past.slice(0, 50).map((x) => (
                <li key={x.id} className="between gap-2 wrap t-sm" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 6 }}>
                  <span>{x.draft.subject} · {x.draft.to}</span>
                  <span className="t-xs c-4">{STATE_LABEL[x.state]} · {x.events.at(-1) ? `${WHEN(x.events.at(-1)!.at)} by ${x.events.at(-1)!.by}` : ""}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </>
  );
}
