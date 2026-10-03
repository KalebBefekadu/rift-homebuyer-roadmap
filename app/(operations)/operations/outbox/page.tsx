import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { outbox } from "@/lib/db/outbox";
import { STATE_LABEL, heldReason, waitingRank, type OutboxState } from "@/lib/core/outbox";
import { Unavailable } from "../Unavailable";
import { OutboxItem } from "./Item";
import { showTime } from "@/lib/core/day";
import { agoFrom } from "@/lib/core/when";
import { PageHead, Section, Notice, Empty, Stat, Stats } from "../ui";
import { Tag, type TagTone } from "../_business/Tag";
import { say } from "../_business/say";
import s from "./outbox.module.css";

export const metadata: Metadata = { title: "Outbox" };
export const dynamic = "force-dynamic";

const WAITING: OutboxState[] = ["prepared", "approved", "failed", "unknown"];
/* Every state is an icon and a word (rule 10); the Tag draws both. */
const TONE: Record<OutboxState, TagTone> = {
  prepared: "warn", approved: "warn", running: "info", succeeded: "pos", failed: "neg", unknown: "neg", cancelled: "none",
};

/**
 * The outbox (Blueprint v5 §10.2, D04): messages Rift prepared and nobody has
 * sent. Approving sends exactly the words shown, to exactly this person;
 * changing them makes a new draft. Every step is kept, with who took it.
 *
 * What is stuck comes first and says why: a message that may have sent, one
 * the last check held back, one that failed. Fresh drafts follow.
 */
export default async function Outbox() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;
  const r = await outbox(agent.agentId);
  const now = new Date();
  const items = r.ok && "data" in r ? r.data : null;

  const rows = (items ?? []).filter((x) => WAITING.includes(x.state)).map((x) => ({ x, held: heldReason(x.events) }));
  rows.sort((a, b) => waitingRank(a.x.state, Boolean(a.held)) - waitingRank(b.x.state, Boolean(b.held)));
  const past = (items ?? []).filter((x) => !WAITING.includes(x.state));
  const needLook = rows.filter(({ x, held }) => x.state === "unknown" || x.state === "failed" || held).length;

  return (
    <main className="shell-w">
      <PageHead
        title="Outbox"
        lede="What Rift prepared for you to send. Nothing leaves until you approve it, and it is sent exactly as shown. Just before sending, Rift checks again that the person is still here, has not opted out, and has not replied since."
      />

      {!r.ok ? (
        <Notice tone="neg" title="The outbox did not load">{say(r.error)} That is not the same as it being empty.</Notice>
      ) : "skipped" in r ? (
        <Notice tone="warn" title="Nothing is being recorded">{say(r.reason)} This page is empty because nothing is stored, not because nothing is waiting.</Notice>
      ) : items === null ? (
        <Notice tone="warn" title="The outbox is not set up on this database yet">It arrives with migration 20260927010000.</Notice>
      ) : null}

      {items ? (
        <Stats>
          <Stat label="Waiting for you" value={rows.length} hint={rows.length ? "Nothing is sent until you approve" : "Nothing prepared"} />
          <Stat label="Need a look first" value={needLook} tone={needLook ? "neg" : undefined}
            hint={needLook ? "May have sent, held back or failed" : "Nothing is stuck"} />
        </Stats>
      ) : null}

      {items ? (
        <Section id="waiting" title="Waiting for you" hint="Stuck messages first, because pressing Send on them is the one thing not to do without reading why.">
          {rows.length ? (
            <div className={s.list}>
              {rows.map(({ x, held }) => {
                const last = x.events.at(-1);
                const reason = held ? { kind: "held" as const, text: held }
                  : last?.detail && (x.state === "failed" || x.state === "unknown") ? { kind: x.state as "failed" | "unknown", text: last.detail } : null;
                return (
                  <OutboxItem key={x.id} id={x.id} state={x.state} stateLabel={held ? "Approved, held back" : STATE_LABEL[x.state]} tone={TONE[x.state]}
                    to={x.draft.to} toName={x.draft.name} leadId={x.leadId}
                    subject={x.draft.subject} body={x.draft.body} reason={reason} />
                );
              })}
            </div>
          ) : (
            <Empty title="Nothing is waiting for you">
              A message appears here when Rift prepares one, for example when an official program changes and someone asked to hear about it.
            </Empty>
          )}
        </Section>
      ) : null}

      {past.length ? (
        <Section id="done" title="Sent and discarded" hint="The 50 most recent, with who took the last step.">
          <div className={s.done}>
            {past.slice(0, 50).map((x) => {
              const last = x.events.at(-1);
              return (
                <div key={x.id} className={s.doneRow}>
                  <div>
                    <div className={s.doneSubject}>{x.draft.subject}</div>
                    <div className={s.doneSub}>{x.draft.name ?? x.draft.to}{last ? ` · by ${last.by}` : ""}</div>
                  </div>
                  <div className={s.doneWhen}>
                    <Tag tone={TONE[x.state]}>{STATE_LABEL[x.state]}</Tag>
                    {last ? <div title={showTime(last.at)} style={{ marginTop: 4 }}>{agoFrom(new Date(last.at), now)}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}
    </main>
  );
}
