import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { outbox } from "@/lib/db/outbox";
import { STATE_LABEL, type OutboxState } from "@/lib/core/outbox";
import { StudioHeader } from "../StudioHeader";
import { Unavailable } from "../Unavailable";
import { outboxAction } from "./actions";

export const metadata: Metadata = { title: "Outbox" };
export const dynamic = "force-dynamic";

const WHEN = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
      <StudioHeader agentName={agent.name} current="outbox" />
      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 860 }}>
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
                <article key={x.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <div className="t-sm">To <strong>{x.draft.name ? `${x.draft.name} <${x.draft.to}>` : x.draft.to}</strong>{x.leadId ? <> · <Link className="u" href={`/operations/lead/${x.leadId}`}>their record</Link></> : null}</div>
                    <span className={`chip t-2xs ${CHIP[x.state]}`}>{STATE_LABEL[x.state]}</span>
                  </div>
                  {last?.detail && (x.state === "failed" || x.state === "unknown") ? <p className="t-xs c-neg mt-1">{last.detail}</p> : null}
                  {x.state === "unknown" ? (
                    <form action={outboxAction} className="row gap-2 wrap mt-2">
                      <input type="hidden" name="id" value={x.id} />
                      <span className="t-xs c-3">Check the Brevo log, then say what happened. It is not sent again on its own.</span>
                      <button className="btn btn-g btn-sm" name="what" value="sent">It was sent</button>
                      <button className="btn btn-g btn-sm" name="what" value="not-sent">It was not sent</button>
                    </form>
                  ) : (
                    <form action={outboxAction} className="col gap-2 mt-3">
                      <input type="hidden" name="id" value={x.id} />
                      <label className="field"><span className="label">Subject</span><input className="input" name="subject" defaultValue={x.draft.subject} maxLength={200} /></label>
                      <label className="field"><span className="label">Message</span><textarea className="input" name="body" rows={9} defaultValue={x.draft.body} maxLength={5000} /></label>
                      <div className="row gap-2 wrap">
                        <button className="btn btn-p btn-sm" name="what" value="send">Approve and send as it was prepared</button>
                        <button className="btn btn-g btn-sm" name="what" value="edit">Save my changes as a new draft</button>
                        <button className="btn btn-g btn-sm" name="what" value="discard">Discard</button>
                      </div>
                      <span className="t-2xs c-4">Approving sends the prepared words, not unsaved edits: save changes first, then approve the new draft.</span>
                    </form>
                  )}
                </article>
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
