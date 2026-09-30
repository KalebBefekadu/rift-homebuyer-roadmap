import type { Metadata } from "next";
import Link from "next/link";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "./Unavailable";
import { rankedLeads } from "@/lib/db/leads";
import { lapsingAgreements } from "@/lib/db/clients";
import { recentChoices } from "@/lib/db/offer-room";
import { programsToday, programFlags } from "@/lib/db/program-checks";
import { outbox } from "@/lib/db/outbox";
import { rulesOrDefaults } from "@/lib/db/settings";
import { openItems } from "@/lib/db/review";
import { due } from "@/lib/db/nurture";
import { currentRate } from "@/lib/db/rates";
import { datedCommitments } from "@/lib/db/plan";
import { allContracts } from "@/lib/db/transactions";
import { recentJourneyEvents } from "@/lib/db/progress";
import { readMarks } from "@/lib/db/desk";
import { dependenciesFor } from "@/lib/db/dependencies";
import { lineFor, stateOf } from "@/lib/core/dependency";
import { jobsHealth } from "@/lib/db/jobs";
import type { DbResult } from "@/lib/db/result";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { CHANNEL_LABEL } from "@/lib/core/nurture";
import { sla, type Band } from "@/lib/core/lead";
import { STAGE_LABEL, STATUS_LABEL, marketDay, type JourneyStatus, type Stage } from "@/lib/core/progress";
import { datesNeeding, waitingOnOthers } from "@/lib/core/transactions";
import { GROUP_LABEL, GROUP_QUESTION, UPCOMING_DAYS, activity, arrange, deskItems } from "@/lib/core/desk";
import { captureOpError } from "@/lib/monitoring/capture";
import { Ico } from "@/components/rift/icons";
import { ReviewRow } from "./ReviewRow";
import { LeadRow } from "./LeadRow";
import { DeskRow } from "./DeskRow";
import { saleCadences } from "@/lib/db/listing";
import { cadenceDue, pricingAnswers } from "@/lib/core/seller-cadence";
import { householdActivity } from "@/lib/db/summary";
import { showTime } from "@/lib/core/day";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/** How many new leads Today shows before pointing to Relationships. */
const NEW_LEADS = 4;
/** Items shown in a group before the rest fold away. */
const SHOWN = 3;

/** A list from a read, or an empty one. Whether the read failed is reported separately. */
const list = <T,>(r: DbResult<T[] | null>): T[] => (r.ok && "data" in r ? r.data ?? [] : []);

/**
 * Today (Blueprint v5 §8.2, §8.4): the seven questions answered on one
 * screen. New leads first with the reply target (D07a), then five groups,
 * each item with why it is there, who owns it, its evidence, when it is due
 * and the next action, then what changed and what Rift did on its own.
 *
 * The groups are rules (lib/core/desk.ts), not a score. The funnel, the
 * started-not-finished list and the pilot figures moved to Reports; the
 * people being worked are in Relationships.
 */
export default async function OperationsToday() {
  const session = await agentSession();

  /* A session check that did not answer is not a signed-out visitor. Today is
     the first thing the agent opens in the morning, which is the request most
     likely to pay for a cold start, and telling him to sign in when his
     cookie is fine says his session expired. See lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  const agent = session.state === "signed-in" ? session.agent : null;

  if (!agent) {
    return (
      <main className="shell-w">
        <h1 className="serif" style={{ fontSize: 28 }}>Operations is for the agent.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Sign in to see the people your readout has produced. If you arrived here by accident,
          the buyer product is a better place to be.
        </p>
        <div className="row gap-2 wrap" style={{ marginTop: 18 }}>
          <Link href="/operations/sign-in" className="btn btn-p">Sign in</Link>
          <Link href="/buy" className="btn btn-g">Rift for buyers</Link>
        </div>
      </main>
    );
  }

  const now = new Date();
  const today = marketDay(now);
  const { rules } = await rulesOrDefaults(agent.agentId);

  /* One round. None of these depends on another, and Today's latency is the
     product's felt speed. */
  const [leadsRead, reviewRead, dueRead, rate, lapsingRead, choicesRead, contractsRead, jobsRead, flagsRead, outboxRead, commitmentsRead, programsRead, eventsRead, marksRead, depsRead, salesRead, clientsRead] =
    await Promise.all([
      rankedLeads(50),
      openItems(),
      due(now),
      currentRate(),
      lapsingAgreements(),
      recentChoices(),
      allContracts(now),
      jobsHealth(),
      programFlags(),
      outbox(agent.agentId),
      datedCommitments(),
      programsToday(now, rules.registryDays.value),
      recentJourneyEvents(agent.agentId, 3, now),
      readMarks(agent.agentId, now),
      dependenciesFor(null, agent.agentId),
      saleCadences(agent.agentId),
      /* What households did, read the way the morning summary reads it. */
      householdActivity(new Date(now.getTime() - 3 * 86_400_000)),
    ]);

  /* Three states, not two: a query that FAILED is neither "nothing to do"
     nor "nothing recorded", and must not render as either. */
  const reads: DbResult<unknown>[] = [leadsRead, reviewRead, dueRead, lapsingRead, choicesRead, contractsRead, jobsRead, flagsRead, outboxRead, commitmentsRead, eventsRead, marksRead, depsRead, salesRead, clientsRead];
  const notRecording = reads.some((r) => "skipped" in r);
  const failures = reads.flatMap((r) => (r.ok ? [] : [r.error]));
  for (const error of failures) captureOpError(new Error(error), { op: "operations.today" });

  const leads = list(leadsRead);
  const contracts = list(contractsRead);
  const drafts = list(outboxRead);
  const reviews = list(reviewRead).filter((r) => r.state === "pending-review");
  const touches = list(dueRead);
  const jobs = list(jobsRead);
  const choices = list(choicesRead);
  const marks = marksRead.ok && "data" in marksRead ? marksRead.data : null;

  const items = deskItems({
    agentFirst: agent.name.split(/\s+/)[0] ?? agent.name,
    today,
    dates: datesNeeding(contracts, UPCOMING_DAYS),
    contracts,
    waiting: waitingOnOthers(contracts, today),
    commitments: list(commitmentsRead),
    touches: touches.filter((t) => !t.auto).map((t) => ({ leadId: t.leadId, name: t.name, says: t.says, channel: CHANNEL_LABEL[t.channel], daysLate: t.daysLate })),
    outbox: drafts.flatMap((d) => d.state === "prepared" || d.state === "approved" || d.state === "failed" || d.state === "unknown"
      ? [{ id: d.id, state: d.state, subject: d.draft.subject, to: d.draft.name ?? d.draft.to }] : []),
    programFlags: list(flagsRead).flatMap((f) => f.programs.map((p) => p.name)),
    programsWithheld: { names: [...programsRead.stale, ...programsRead.withdrawn].map((p) => p.name), owner: rules.registryOwner.value, withinDays: rules.registryDays.value },
    reviews: reviews.map((r) => ({ id: r.id, who: r.who, whoId: r.whoId, what: r.what, waitingHours: r.waitingHours, overdue: r.waitingHours > REVIEW_SLA_HOURS })),
    jobProblems: jobs.flatMap((j) => (j.problem ? [j.problem] : [])),
    lapsing: list(lapsingRead).map((l) => ({ id: l.id, name: l.name, covered: l.standing.covered, note: l.standing.note })),
    choices: choices.map((c) => ({ leadId: c.leadId, name: c.name, from: c.seen.from, note: c.note })),
    rate: { stale: rate.freshness !== "fresh", pct: rate.pct, age: rate.asOf ? `${rate.ageDays} days old` : "Never recorded" },
    dependencies: list(depsRead).filter((d) => stateOf(d) === "open")
      .map((d) => ({ id: d.id, purchaseJourneyId: d.purchaseJourneyId, purchaseLabel: d.purchaseLabel, line: lineFor(d, "buy"), owner: d.owner, note: d.note })),
    sales: cadenceDue(list(salesRead), today),
    pricingAnswers: pricingAnswers(list(salesRead)),
  });
  const groups = arrange(items, marks ?? [], now);

  const slaOf = (l: (typeof leads)[number]) => sla({
    completion: l.completion, contactable: l.contactable, hoursSince: l.hoursSince,
    humanRepliedMins: l.humanRepliedAt ? Math.max(0, (new Date(l.humanRepliedAt).getTime() - new Date(l.createdAt).getTime()) / 60_000) : null,
  }, l.band as Band);
  const fresh = leads.filter((l) => !l.humanRepliedAt && !l.stopped);
  const breached = fresh.filter((l) => slaOf(l).breached).length;

  const recent = activity({
    leads,
    events: list(eventsRead).map((e) => ({ ...e, toLabel: e.kind === "stage" ? STAGE_LABEL[e.to as Stage] ?? e.to : STATUS_LABEL[e.to as JourneyStatus] ?? e.to })),
    jobs,
    sent: drafts.filter((d) => d.state === "succeeded").map((d) => ({ subject: d.draft.subject, to: d.draft.name ?? d.draft.to, at: d.events.at(-1)?.at ?? d.createdAt })),
    choices: choices.map((c) => ({ leadId: c.leadId, name: c.name, from: c.seen.from, at: c.chosenAt })),
    answers: pricingAnswers(list(salesRead)),
    clients: list(clientsRead),
  }, now);
  const autoTouches = touches.filter((t) => t.auto).length;

  return (
    <main className="shell-w">
      <div className="between wrap gap-2">
        <h1 className="serif">Today</h1>
        <span className="t-xs c-4">
          {showTime(now.toISOString(), { weekday: "long", month: "long", day: "numeric" })} · Georgia time
        </span>
      </div>

      {failures.length ? (
        <div className="card p-4" role="alert" style={{ marginTop: 10, borderColor: "var(--neg, #b3261e)" }}>
          <div className="row gap-2"><Ico.alert size={15} className="c-neg" /><span className="t-sm w6">{failures.length} of this page&apos;s {reads.length} reads failed.</span></div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Treat every empty group below as unknown rather than clear. It has been reported; the first one said: {failures[0]}
          </p>
        </div>
      ) : notRecording ? (
        <div className="card p-4" style={{ marginTop: 10, borderColor: "var(--warn, #b8791f)" }}>
          <div className="row gap-2"><Ico.alert size={15} className="c-warn" /><span className="t-sm w6">Nothing is being recorded right now.</span></div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>The database is not reachable, so this screen is empty because nothing is stored, not because nothing is happening.</p>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 10, overflow: "hidden" }} aria-labelledby="new-leads">
        <div className="between wrap gap-2" style={{ padding: "8px 12px", borderBottom: fresh.length ? "1px solid var(--line-2)" : 0 }}>
          <h2 id="new-leads" className="t-sm w6">New leads <span className="c-4 w5">{fresh.length}</span></h2>
          <span className="row gap-2 t-xs c-4">
            {breached ? <span className="chip chip-neg t-2xs"><Ico.clock size={10} />{breached} past the reply target</span> : null}
            Ranked by what their answers say. Target: a first reply within 15 minutes.
          </span>
        </div>
        {fresh.length ? fresh.slice(0, NEW_LEADS).map((l, i) => (
          <LeadRow key={l.id} compact last={i === Math.min(fresh.length, NEW_LEADS) - 1}
            lead={{ ...l, signals: l.signals as { label: string; points: number; note: string }[], slaLabel: slaOf(l).humanLabel, breached: slaOf(l).breached }} />
        )) : (
          <p className="t-sm c-3" style={{ padding: "8px 12px" }}>
            {failures.length ? "Unknown: a read failed." : "Nobody new is waiting for a first reply."}
          </p>
        )}
        {fresh.length > NEW_LEADS ? (
          <p className="t-xs" style={{ padding: "6px 12px", borderTop: "1px solid var(--line-3)" }}>
            <Link className="u" href="/operations/clients?filter=new">{fresh.length - NEW_LEADS} more not picked up</Link>
          </p>
        ) : null}
      </section>

      {marks === null && marksRead.ok ? (
        <p className="t-xs c-4" style={{ marginTop: 8 }}>Snooze, pin and delegate arrive with database update 20260928000000.</p>
      ) : null}

      <div className="desk-grid desk-today">
        {groups.map((g) => (
          <section key={g.group} className="card desk-card" aria-labelledby={`g-${g.group}`}>
            <h2 id={`g-${g.group}`} title={GROUP_QUESTION[g.group]}>
              <span>{GROUP_LABEL[g.group]} <span className="c-4 w5">{g.items.length}</span></span>
            </h2>
            {g.items.length ? (
              <>
                <ul>{g.items.slice(0, SHOWN).map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
                {/* The rest fold away so every group stays on one screen (§8
                    acceptance); the count is on the heading either way. */}
                {g.items.length > SHOWN ? (
                  <details className="desk-more">
                    <summary className="t-xs u">{g.items.length - SHOWN} more</summary>
                    <ul>{g.items.slice(SHOWN).map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="t-sm c-4" style={{ padding: "6px 0" }}>{failures.length ? "Unknown: a read failed." : "Nothing."}</p>
            )}
            {g.snoozed.length ? (
              <details className="desk-more">
                <summary className="t-xs u">{g.snoozed.length} snoozed</summary>
                <ul>{g.snoozed.map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
              </details>
            ) : null}
            {g.group === "today" && autoTouches ? (
              <p className="t-xs c-4" style={{ paddingTop: 6 }}><Ico.bolt size={10} /> {autoTouches} follow-up{autoTouches === 1 ? "" : "s"} go out on their own today.</p>
            ) : null}
          </section>
        ))}

        <section className="card desk-card" aria-labelledby="g-activity">
          <h2 id="g-activity" title="Which leads or clients changed? What did Rift do on its own?">Recent activity</h2>
          {recent.length ? (
            <ul>
              {recent.map((a) => (
                <li key={a.at + a.text} className="desk-row t-xs">
                  <span className="c-4">{showTime(a.at, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>{" "}
                  {a.auto ? <span className="chip t-2xs" style={{ marginRight: 4 }}>Rift</span> : null}
                  <Link className="u" href={a.href}>{a.text}</Link>
                </li>
              ))}
            </ul>
          ) : <p className="t-sm c-4" style={{ padding: "6px 0" }}>Nothing in the last three days.</p>}
        </section>
      </div>

      {reviews.length ? (
        <section id="figures" style={{ marginTop: 16 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="between wrap gap-2" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line-2)" }}>
              <h2 className="t-sm w6">Figures you were asked to check</h2>
              {reviews.some((r) => r.waitingHours > REVIEW_SLA_HOURS)
                ? <span className="chip chip-neg t-2xs"><Ico.clock size={10} />Past {REVIEW_SLA_HOURS}h</span>
                : <span className="chip chip-pos t-2xs">All inside {REVIEW_SLA_HOURS}h</span>}
            </div>
            {reviews.map((r, i) => <ReviewRow key={r.id} item={r} last={i === reviews.length - 1} />)}
          </div>
        </section>
      ) : null}
    </main>
  );
}
