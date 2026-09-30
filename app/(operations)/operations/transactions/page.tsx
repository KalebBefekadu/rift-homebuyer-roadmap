import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { allContracts } from "@/lib/db/transactions";
import { contractFlags, nextDate, type ContractSummary } from "@/lib/core/transactions";
import { STAGE_LABEL, WORK_STATE_LABEL, type WorkState } from "@/lib/core/progress";
import { Unavailable } from "../Unavailable";
import { PageHead, Tabs, Notice, Empty } from "../ui";

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
 * next deadline, the ten workstreams at a glance, and anything blocked or
 * unconfirmed. A row opens the journey's Contract tab. The filter is in the
 * address, so back returns to the same view.
 */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const show = (await searchParams).show;
  const which = SHOW.some((s) => s.id === show) ? (show as (typeof SHOW)[number]["id"]) : "open";
  const read = await allContracts();
  const all = read.ok && "data" in read ? read.data : null;
  const rows = (all ?? []).filter((c) => which === "all" || (which === "open" ? !c.outcome : Boolean(c.outcome)));

  return (
    <main className="shell-w">
      <PageHead
        title="Transactions"
        lede="Every contract, its next date and its ten workstreams. A row opens the journey's Contract tab."
        actions={<Tabs label="Which contracts" current={which} items={SHOW.map((s) => ({
          id: s.id, label: s.label, href: s.id === "open" ? "/operations/transactions" : `/operations/transactions?show=${s.id}`,
          count: all ? (all.filter((c) => s.id === "all" || (s.id === "open" ? !c.outcome : Boolean(c.outcome)))).length : undefined,
        }))} />}
      />

      {!read.ok ? (
        <Notice tone="neg" title="The contracts did not load">That is not the same as there being none; reload in a moment.</Notice>
      ) : "skipped" in read ? (
        <Notice tone="info" title="Nothing is recorded on this deployment">{read.reason}.</Notice>
      ) : all === null ? (
        <Notice tone="warn" title="Contracts need a database update">It has not been applied yet.</Notice>
      ) : !rows.length ? (
        <Empty title={which === "open" ? "No open contracts" : "None here"}>
          {which === "open" ? "A contract is recorded from its journey, on the Contract tab, once an offer is accepted." : null}
        </Empty>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ops-table">
            <thead>
              <tr><th>Property</th><th>Client</th><th>Stage</th><th>Next date</th><th>Workstreams</th><th>Needs a look</th></tr>
            </thead>
            <tbody>{rows.map((c) => <Row key={c.id} c={c} />)}</tbody>
          </table>
        </div>
      )}
      <p className="t-xs c-4" style={{ marginTop: 8 }}>
        {Object.entries(GLYPH).map(([s, v]) => <span key={s} style={{ marginRight: 12 }}><span className={v.c} aria-hidden>{v.g}</span> {WORK_STATE_LABEL[s as WorkState]}</span>)}
      </p>
    </main>
  );
}

function Row({ c }: { c: ContractSummary }) {
  const next = nextDate(c);
  const flags = contractFlags(c);
  const href = `/operations/journey/${c.journeyId}?tab=contract`;
  return (
    <tr>
      <td><Link href={href} className="w6">{c.address}</Link>{c.financing === "cash" ? <span className="chip t-2xs" style={{ marginLeft: 6 }}>Cash</span> : null}</td>
      <td><Link className="u" href={`/operations/lead/${c.leadId}`}>{c.person}</Link></td>
      <td>{c.outcome ? (c.outcome.outcome === "closed" ? "Closed" : "Terminated") : STAGE_LABEL[c.stage]}</td>
      <td style={{ whiteSpace: "nowrap" }}>{next ? <>{next.label}<div className="t-xs c-4">{next.view.when}</div></> : <span className="c-4">None checked ahead</span>}</td>
      <td>
        <span className="row" style={{ gap: 3, fontSize: 14 }}>
          {c.work.map((w) => (
            <span key={w.workstream} className={GLYPH[w.state].c} title={`${w.label}: ${WORK_STATE_LABEL[w.state]}`} aria-label={`${w.label}: ${WORK_STATE_LABEL[w.state]}`} role="img">{GLYPH[w.state].g}</span>
          ))}
        </span>
      </td>
      <td className="t-xs">
        {flags.length ? <ul style={{ display: "grid", gap: 2 }}>{flags.map((f) => <li key={f} className="c-2">{f}</li>)}</ul> : <span className="c-pos">✓ Nothing flagged</span>}
      </td>
    </tr>
  );
}
