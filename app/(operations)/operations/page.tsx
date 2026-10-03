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
import { GROUP_LABEL, GROUP_QUESTION, UPCOMING_DAYS, activity, arrange, deskHeadline, deskItems, type DeskGroup, type Group } from "@/lib/core/desk";
import { heldReason } from "@/lib/core/outbox";
import { captureOpError } from "@/lib/monitoring/capture";
import { Ico } from "@/components/rift/icons";
import { ReviewRow } from "./ReviewRow";
import { LeadRow } from "./LeadRow";
import { DeskRow } from "./DeskRow";
import { saleCadences } from "@/lib/db/listing";
import { cadenceDue, pricingAnswers } from "@/lib/core/seller-cadence";
import { householdActivity } from "@/lib/db/summary";
import { showTime } from "@/lib/core/day";
import { agoFrom } from "@/lib/core/when";
import { PageHead, Section, Notice, Empty, Stat, Stats } from "./ui";
import { Tag } from "./_business/Tag";
import s from "./today.module.css";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/** How many new leads Today shows before pointing to Relationships. */
const NEW_LEADS = 4;
/** Items shown in a group before the rest fold away. */
const SHOWN = 4;

/** What an empty group means, said as that. "Nothing." read the same whether the day was clear or the read had failed. */
const CLEAR: Record<Group, string> = {
  attention: "Nothing is overdue, blocked or failing.",
  approval: "Nothing is waiting on your approval.",
  today: "Nothing is due today.",
  waiting: "Nobody owes you anything right now.",
  upcoming: `No dates or promises in the next ${UPCOMING_DAYS} days.`,
};

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
     likely to pay for a cold start, and telling them to sign in when their
     cookie is fine says their session expired. See lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  const agent = session.state === "signed-in" ? session.agent : null;

  if (!agent) {
    return (
      <main className="shell-w ops-narrow">
        <PageHead
          title="Operations is for the agent"
          lede="Sign in to see the people your readout has produced. If you arrived here by accident, the buyer product is a better place to be."
          actions={<>
            <Link href="/operations/sign-in" className="btn btn-p">Sign in</Link>
            <Link href="/buy" className="btn btn-g">Rift for buyers</Link>
          </>}
        />
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
  /* A step that does not apply to them is skipped by the next run, not a task:
     it must not sit on the desk as one until then. */
  const touches = list(dueRead).filter((t) => !t.skip);
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
      ? [{ id: d.id, state: d.state, subject: d.draft.subject, to: d.draft.name ?? d.draft.to, held: heldReason(d.events) }] : []),
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
  const by = (g: Group) => groups.find((x) => x.group === g)!;

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

  /* With a read failed, a count of zero is not "clear". The headline says
     only what is known and leaves the "nothing needs you" claim to a day
     whose reads all answered. */
  const headline = deskHeadline({
    waiting: fresh.length, late: breached,
    attention: by("attention").items.length, approval: by("approval").items.length, today: by("today").items.length,
  });
  const lede = failures.length
    ? `${headline ?? "Some of this page did not load"}${headline ? " " : ". "}Treat an empty group as unknown, not clear.`
    : headline ?? "Nothing needs you right now. New leads, overdue promises, approvals and contract dates will appear here when they do.";

  return (
    <main className="shell-w">
      <PageHead
        title="Today"
        lede={lede}
        meta={<span className="t-xs c-4">{showTime(now.toISOString(), { weekday: "long", month: "long", day: "numeric" })} · Georgia time</span>}
      />

      {failures.length ? (
        <Notice tone="neg" title={`${failures.length} of this page's ${reads.length} reads failed`}>
          Treat every empty group below as unknown rather than clear. It has been reported; the first one said: {failures[0]}
        </Notice>
      ) : notRecording ? (
        <Notice tone="warn" title="Nothing is being recorded right now">
          The database is not reachable, so this screen is empty because nothing is stored, not because nothing is happening.
        </Notice>
      ) : null}

      {marks === null && marksRead.ok ? (
        <Notice tone="info" title="Snooze, pin and delegate are not available yet">They arrive with database update 20260928000000.</Notice>
      ) : null}

      <Stats>
        <Stat label="Waiting for a first reply" value={fresh.length} tone={breached ? "neg" : undefined} href="#new-leads"
          hint={breached ? `${breached} past the 15 minute target` : fresh.length ? "All inside the target" : "Nobody is waiting"} />
        <Stat label="Needs attention" value={by("attention").items.length} tone={by("attention").items.length ? "neg" : undefined} href="#g-attention"
          hint={urgentHint(by("attention"))} />
        <Stat label="Needs your approval" value={by("approval").items.length} tone={by("approval").items.length ? "warn" : undefined} href="#g-approval"
          hint={by("approval").items.length ? "Drafts, dates, figures, choices" : "Nothing waiting"} />
        <Stat label="Due today" value={by("today").items.length} href="#g-today"
          hint={autoTouches ? `${autoTouches} more go out on their own` : "Yours to do"} />
      </Stats>

      <Section id="new-leads" title={<>New leads <span className={s.count}>{fresh.length}</span></>}
        hint="Ranked by what their answers say. The target is a first reply within 15 minutes.">
        <div className={s.card}>
          {fresh.length ? fresh.slice(0, NEW_LEADS).map((l) => (
            <LeadRow key={l.id}
              lead={{ ...l, signals: l.signals as { label: string; points: number; note: string }[], slaLabel: slaOf(l).humanLabel, breached: slaOf(l).breached }} />
          )) : (
            <p className={s.cardEmpty}>{failures.length ? "Unknown: a read failed." : "Nobody new is waiting for a first reply."}</p>
          )}
          {fresh.length > NEW_LEADS ? (
            <p className={s.cardFoot}>
              <Link className="u" href="/operations/clients?filter=new">{fresh.length - NEW_LEADS} more not picked up</Link>
            </p>
          ) : null}
        </div>
      </Section>

      <Section id="desk" title="What needs you" hint="Each item says why it is here, who it is about, and the next thing to do.">
        <div className={s.groups}>
          {groups.map((g) => (
            <section key={g.group} className={s.card} aria-labelledby={`g-${g.group}-h`} id={`g-${g.group}`}>
              <div className={s.cardHead}>
                <div>
                  <h3 id={`g-${g.group}-h`} className={s.cardTitle}>{GROUP_LABEL[g.group]} <span className={s.count}>{g.items.length}</span></h3>
                  <p className={s.cardHint}>{GROUP_QUESTION[g.group]}</p>
                </div>
              </div>
              {g.items.length ? (
                <>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{g.items.slice(0, SHOWN).map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
                  {/* The rest fold away so every group stays short; the count
                      is on the heading either way. */}
                  {g.items.length > SHOWN ? (
                    <details className={s.more}>
                      <summary>{g.items.length - SHOWN} more</summary>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{g.items.slice(SHOWN).map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className={s.cardEmpty}>{failures.length ? "Unknown: a read failed." : CLEAR[g.group]}</p>
              )}
              {g.snoozed.length ? (
                <details className={s.more}>
                  <summary>{g.snoozed.length} snoozed</summary>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{g.snoozed.map((i) => <DeskRow key={i.key} item={i} agentName={agent.name} marksReady={marks !== null} />)}</ul>
                </details>
              ) : null}
              {g.group === "today" && autoTouches ? (
                <p className={s.cardFoot}><Ico.bolt size={12} />{autoTouches} follow-up{autoTouches === 1 ? "" : "s"} go out on their own today.</p>
              ) : null}
            </section>
          ))}
        </div>
      </Section>

      {reviews.length ? (
        <Section id="figures" title="Figures you were asked to check"
          hint="You are being asked to stand behind a number. Each one shows what it assumes and where it could be wrong."
          actions={reviews.some((r) => r.waitingHours > REVIEW_SLA_HOURS)
            ? <Tag tone="neg">Past {REVIEW_SLA_HOURS}h</Tag>
            : <Tag tone="pos">All inside {REVIEW_SLA_HOURS}h</Tag>}>
          <div className={s.card}>
            {reviews.map((r) => <ReviewRow key={r.id} item={r} />)}
          </div>
        </Section>
      ) : null}

      <Section id="activity" title="Recent activity" hint="What changed in the last three days, and what Rift did on its own.">
        {recent.length ? (
          <div className={s.card}>
            <ul className={s.feed}>
              {recent.map((a) => (
                <li key={a.at + a.text} className={s.feedRow}>
                  <span className={s.feedAt} title={showTime(a.at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}>{agoFrom(new Date(a.at), now)}</span>
                  <span className={s.feedText}>
                    {a.auto ? <span className={s.auto}><Ico.bolt size={11} />Rift</span> : null}
                    <Link href={a.href}>{a.text}</Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty title="Nothing in the last three days">New leads, stage changes, sent messages and what clients did on their pages show here.</Empty>
        )}
      </Section>
    </main>
  );
}

/** How much of Needs attention is urgent, said as words. */
function urgentHint(g: DeskGroup): string {
  const urgent = g.items.filter((i) => i.tone === "neg").length;
  if (!g.items.length) return "Nothing overdue or failing";
  return urgent ? `${urgent} urgent` : "None urgent";
}
