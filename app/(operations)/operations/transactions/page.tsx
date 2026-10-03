import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { allContracts } from "@/lib/db/transactions";
import { contractFlags, nextAhead, orderContracts, progressOf, urgencyOf, type ContractSummary } from "@/lib/core/transactions";
import { inDays } from "@/lib/core/deadline";
import { georgiaDay, showDay } from "@/lib/core/day";
import { STAGE_LABEL, WORK_STATE_LABEL, type WorkState } from "@/lib/core/progress";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { PageHead, Tabs, Notice, Empty, Stats, Stat } from "../ui";
import { Tag } from "../_business/Tag";
import k from "../_business/kit.module.css";
import s from "./transactions.module.css";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

/* A shape per state as well as a colour, so the row reads without colour
   (rule 10). The word is in the title and the accessible name. */
const GLYPH: Record<WorkState, { g: string; c: string }> = {
  "not-started": { g: "○", c: "c-4" },
  "in-progress": { g: "◔", c: "c-2" },
  waiting: { g: "⏸", c: "c-warn" },
  blocked: { g: "✕", c: "c-neg" },
  reported: { g: "◑", c: "c-warn" },
  confirmed: { g: "✓", c: "c-pos" },
  "not-applicable": { g: "–", c: "c-4" },
};

const SHOW = [
  { id: "open", label: "Open" },
  { id: "ended", label: "Closed or ended" },
  { id: "all", label: "All" },
] as const;

/**
 * Every contract in one table (Blueprint v5 §8.7): property, client, stage,
 * the date to look at, how far along the ten workstreams are, and anything
 * blocked or unconfirmed. A row opens the journey's Contract tab. The filter
 * is in the address, so back returns to the same view.
 *
 * Ordered by what needs the agent, not by when the contract was recorded:
 * a stuck workstream or a missed date first, then the nearest date. Ended
 * contracts follow, most recent first, and carry no flags, because a list of
 * what is wrong with a deal that is over is noise.
 */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const show = (await searchParams).show;
  const which = SHOW.some((x) => x.id === show) ? (show as (typeof SHOW)[number]["id"]) : "open";
  const now = new Date();
  const read = await allContracts(now);
  const all = read.ok && "data" in read ? read.data : null;
  const matches = (c: ContractSummary, id: (typeof SHOW)[number]["id"]) => id === "all" || (id === "open" ? !c.outcome : Boolean(c.outcome));
  const rows = all ? orderContracts(all.filter((c) => matches(c, which))) : [];
  const open = all ? all.filter((c) => !c.outcome) : [];
  const needLook = open.filter((c) => urgencyOf(c) <= 1).length;
  const blocked = open.filter((c) => progressOf(c).blocked > 0).length;
  const soon = open.filter((c) => { const d = nextAhead(c); return d !== null && d.days <= 7; }).length;

  return (
    <main className="shell-w">
      <PageHead
        title="Transactions"
        lede="Every contract, the date to look at and how far along its workstreams are. A row opens the journey's Contract tab."
        actions={<Tabs label="Which contracts" current={which} items={SHOW.map((x) => ({
          id: x.id, label: x.label, href: x.id === "open" ? "/operations/transactions" : `/operations/transactions?show=${x.id}`,
          count: all ? all.filter((c) => matches(c, x.id)).length : undefined,
        }))} />}
      />

      {!read.ok ? (
        <Notice tone="neg" title="The contracts did not load">{read.error}. That is not the same as there being none; reload in a moment.</Notice>
      ) : "skipped" in read ? (
        <Notice tone="info" title="Nothing is recorded on this deployment">{read.reason}.</Notice>
      ) : all === null ? (
        <Notice tone="warn" title="Contracts need a database update">It has not been applied yet.</Notice>
      ) : (
        <>
          <Stats>
            <Stat label="Open contracts" value={open.length} />
            <Stat label="Need a look" value={needLook} tone={needLook ? "warn" : undefined} hint="Stuck, missed, or not yet checked" />
            <Stat label="Blocked" value={blocked} tone={blocked ? "neg" : undefined} hint="With a workstream that cannot move" />
            <Stat label="Date within 7 days" value={soon} hint="The next date on an open contract" />
          </Stats>

          {!rows.length ? (
            <Empty title={which === "open" ? "No open contracts" : "None here"}>
              {which === "open" ? "A contract is recorded from its journey, on the Contract tab, once an offer is accepted." : null}
            </Empty>
          ) : (
            <div className={k.tableCard}>
              <table className={`${k.table} ${k.stack}`}>
                <thead>
                  <tr><th>Property</th><th>Client</th><th>Stage</th><th>Date to look at</th><th>Progress</th><th>Needs a look</th></tr>
                </thead>
                <tbody>{rows.map((c) => <Row key={c.id} c={c} />)}</tbody>
              </table>
            </div>
          )}
          <p className={s.legend}>
            {Object.entries(GLYPH).map(([st, v]) => <span key={st}><span className={v.c} aria-hidden>{v.g}</span> {WORK_STATE_LABEL[st as WorkState]}</span>)}
          </p>
        </>
      )}
    </main>
  );
}

function Row({ c }: { c: ContractSummary }) {
  const next = c.outcome ? null : nextAhead(c);
  const flags = c.outcome ? [] : contractFlags(c);
  const p = progressOf(c);
  const href = `/operations/journey/${c.journeyId}?tab=contract`;
  const ended = c.outcome ? showDay(georgiaDay(new Date(c.outcome.at)), { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <tr>
      <td data-label="Property">
        <Link href={href} className={s.address}>{c.address}</Link>
        <div className={s.tags}>
          {c.side ? <Tag>{c.side === "sell" ? "Selling" : "Buying"}</Tag> : null}
          {c.financing === "cash" ? <Tag>Cash</Tag> : null}
        </div>
      </td>
      <td data-label="Client"><Link className={s.client} href={`/operations/lead/${c.leadId}`}>{c.person}</Link></td>
      <td data-label="Stage">
        {c.outcome
          ? <Tag tone={c.outcome.outcome === "closed" ? "pos" : "neg"}>{c.outcome.outcome === "closed" ? "Closed" : "Terminated"} {ended}</Tag>
          : STAGE_LABEL[c.stage]}
      </td>
      <td data-label="Date">
        {next ? (
          <>
            <div className={`${s.when} ${next.missed || next.days < 0 ? s.late : next.days <= 3 ? s.soon : ""}`}>{next.missed ? "Passed, not recorded as met" : inDays(next.days)}</div>
            <div className={s.whenLabel}>{next.label}</div>
            <div className={s.whenFull}>{next.when}</div>
            {next.verified ? null : <div className={s.tags}><Tag tone="warn">Not checked against the document</Tag></div>}
          </>
        ) : <span className={k.muted}>{c.outcome ? "Over" : "No date recorded ahead"}</span>}
      </td>
      <td data-label="Progress">
        <div className={s.progressText}>{p.settled} of {p.total} confirmed</div>
        <span className={s.strip}>
          {c.work.map((w) => (
            <span key={w.workstream} className={GLYPH[w.state].c} title={`${w.label}: ${WORK_STATE_LABEL[w.state]}`} aria-label={`${w.label}: ${WORK_STATE_LABEL[w.state]}`} role="img">{GLYPH[w.state].g}</span>
          ))}
        </span>
      </td>
      <td data-label="Needs a look" className={s.needs}>
        {c.outcome ? <span className={s.ended}>Nothing to do</span> : flags.length ? (
          <ul className={s.flags}>
            {flags.map((f) => (
              <li key={f} className={/blocked|passed/i.test(f) ? s.bad : undefined}>
                {/blocked|passed/i.test(f) ? <Ico.alert size={13} aria-hidden /> : <Ico.clock size={13} aria-hidden />}
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : <Tag tone="pos">Nothing flagged</Tag>}
      </td>
    </tr>
  );
}
