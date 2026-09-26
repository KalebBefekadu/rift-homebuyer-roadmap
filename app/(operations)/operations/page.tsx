import type { Metadata } from "next";
import Link from "next/link";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "./Unavailable";
import { rankedLeads } from "@/lib/db/leads";
import { funnelReport } from "@/lib/db/events";
import { board, dueActions, lapsingAgreements } from "@/lib/db/clients";
import { recentChoices } from "@/lib/db/offer-room";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { readStale } from "@/lib/db/programs";
import { rulesOrDefaults } from "@/lib/db/settings";
import { openItems } from "@/lib/db/review";
import { due } from "@/lib/db/nurture";
import { abandoned } from "@/lib/db/recovery";
import { currentRate } from "@/lib/db/rates";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { CHANNEL_LABEL } from "@/lib/core/nurture";
import { ReviewRow } from "./ReviewRow";
import { LeadRow } from "./LeadRow";
import { OpsNav } from "./OpsNav";
import { Layer } from "@/components/rift/Layer";

import { sla, type Band } from "@/lib/core/lead";
import { diagnose } from "./diagnose";
import { Ico } from "@/components/rift/icons";
import { captureOpError } from "@/lib/monitoring/capture";
import { datesNeedingAttention } from "@/lib/db/deadlines";
import { jobsHealth } from "@/lib/db/jobs";
import { inDays } from "@/lib/core/deadline";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/**
 * Today in Operations: what needs the agent now, as one list, and the rest
 * one press away (Blueprint v5 §8.4, rebuilt from the reviewed mock-up).
 *
 * Originally the minimum agent surface for the MVP.
 *
 * Two things only: the leads the readout produced, ranked by what their answers
 * say rather than by when they arrived, and the funnel's own drop-off. Not the
 * whole of Studio: the board, offers, calendar and client records are phase 5,
 * and building them now would mean building against guesses, because there is
 * no live traffic yet for them to operate on.
 *
 * The ranking shows its own arithmetic. An agent who cannot see why a lead
 * ranks where it does stops trusting the ranking inside a week, and a ranking
 * nobody trusts still costs attention.
 */
export default async function StudioToday() {
  const session = await agentSession();

  /* A session check that did not answer is not a signed-out visitor. Today is
     the first thing the agent opens in the morning, which is the request most
     likely to pay for a cold start, and telling him to sign in when his
     cookie is fine says his session expired. See lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;

  const agent = session.state === "signed-in" ? session.agent : null;

  if (!agent) {
    return (
      <main className="shell-w sec">
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

  /* One round, not two. None of these depends on another, and splitting them
     made the page wait for the slowest of the first five before starting the
     last two: for no reason beyond the order they were written in. Studio is
     the screen the agent opens first thing, so its latency is the product's
     felt speed. */
  /* His own re-check window, before the reads that depend on it. One extra
     round trip, and the alternative is a settings page that records a
     decision the product then ignores. */
  const agentRules = await rulesOrDefaults(agent.agentId);
  const { rules } = agentRules;
  const recheckDays = rules.registryDays.value;
  const undecidedCount = agentRules.undecided.length;

  const [leadsRead, reportRead, sellReportRead, boardRead, owedRead, staleRead, reviewRead, dueRead, abandonedRead, rate, lapsingRead, choicesRead, datesRead, jobsRead] =
    await Promise.all([
      rankedLeads(50),
      funnelReport("buy"),
      funnelReport("sell"),
      board(),
      dueActions(),
      readStale(new Date(), recheckDays),
      openItems(),
      due(new Date()),
      abandoned(),
      currentRate(),
      lapsingAgreements(),
      recentChoices(),
      datesNeedingAttention(),
      jobsHealth(),
    ]);
  /* Null means not tracked yet (the tables are not there); a failed read is
     shown as one, never as nothing to do. */
  const dates = datesRead.ok && "data" in datesRead ? datesRead.data : null;
  const datesFailed = !datesRead.ok;
  const jobProblems = jobsRead.ok && "data" in jobsRead && jobsRead.data ? jobsRead.data.filter((j) => j.problem) : [];

  const partial = abandonedRead.ok && "data" in abandonedRead ? abandonedRead.data : [];
  const lapsing = lapsingRead.ok && "data" in lapsingRead ? lapsingRead.data : [];
  const choices = choicesRead.ok && "data" in choicesRead ? choicesRead.data : [];

  const leads = leadsRead.ok && "data" in leadsRead ? leadsRead.data : [];
  const report = reportRead.ok && "data" in reportRead ? reportRead.data : null;
  const sellReport = sellReportRead.ok && "data" in sellReportRead ? sellReportRead.data : null;
  const working = boardRead.ok && "data" in boardRead ? boardRead.data : [];
  const owed = owedRead.ok && "data" in owedRead ? owedRead.data : [];
  const stale = staleRead.ok && "data" in staleRead ? staleRead.data : [];
  const review = reviewRead.ok && "data" in reviewRead ? reviewRead.data : [];
  const touches = dueRead.ok && "data" in dueRead ? dueRead.data : [];
  const pending = review.filter((r) => r.state === "pending-review");
  const overdue = pending.filter((r) => r.waitingHours > REVIEW_SLA_HOURS);

  /* Three states, not two.
     
     "Nobody has arrived" and "nothing is being recorded" were already held
     apart. A query that FAILED was falling into neither: it produced an empty
     list, so a database error rendered "No leads yet" alongside copy assuring
     the agent that the readout is live and instrumented. That is the product
     telling him a comforting thing it cannot know. */
  const reads = [leadsRead, reportRead, sellReportRead, boardRead, owedRead, staleRead, reviewRead, dueRead, abandonedRead];
  const notRecording = reads.some((r) => "skipped" in r);
  const failures = reads.filter((r) => !r.ok).map((r) => (r as { error: string }).error);
  /* Shown to the agent AND reported. He can see something is wrong; only the
     capture says what, and only somebody looking at Sentry will fix it. */
  for (const error of failures) captureOpError(new Error(error), { op: "studio.today" });

  /* No cast. The previous version fabricated the input and cast it to `never`,
     which hid a missing `contactable` and made every lead report as unbreached
    : an indicator that read as "doing well" because it could not fire. */
  const slaOf = (l: (typeof leads)[number]) =>
    sla(
      {
        completion: l.completion,
        contactable: l.contactable,
        hoursSince: l.hoursSince,
        humanRepliedMins: l.humanRepliedAt
          ? Math.max(0, (new Date(l.humanRepliedAt).getTime() - new Date(l.createdAt).getTime()) / 60_000)
          : null,
      },
      l.band as Band,
    );

  const breached = leads.filter((l) => slaOf(l).breached).length;

  /* Everything that needs him, as one list (Blueprint v5 §8.4; Kaleb, R3:
     simple first, more one press away). The old page stacked eleven sections
     of equal weight and he had to read all of them to find the two that
     mattered. Now each thing that needs his judgement is one line here, most
     urgent first, and everything that is only worth knowing sits in a layer
     below, closed, with its count on the outside. A layer opens by itself
     when something inside it needs him. */
  const today = new Date().toISOString().slice(0, 10);
  const owedNow = owed.filter((p) => p.nextDue && p.nextDue <= today);
  const owedLater = owed.filter((p) => !(p.nextDue && p.nextDue <= today));
  const touchesForYou = touches.filter((t) => !t.auto);
  const breachedLeads = leads.filter((l) => slaOf(l).breached);
  const needs: Need[] = [
    ...jobProblems.map((j): Need => ({ key: `job-${j.job}`, tone: "neg", icon: "alert", title: "A scheduled job needs you", sub: j.problem ?? "", chip: "Failed" })),
    ...(dates ?? []).map((d, i): Need => ({
      key: `date-${d.journeyId}-${i}`, href: `/operations/journey/${d.journeyId}`, icon: "cal",
      tone: d.why === "missed" ? "neg" : "warn",
      title: `${d.person}: ${d.label}`,
      sub: d.why === "missed" ? `${d.when}. Passed and not recorded as met: record what actually happened.` : d.why === "unchecked" ? `${d.when}. Not checked against the document yet, so the buyer does not see it.` : `${d.when}. Due ${inDays(d.days!)}.`,
      chip: d.why === "missed" ? "Passed" : d.why === "unchecked" ? "Check it" : "Soon",
    })),
    ...breachedLeads.map((l): Need => ({
      key: `lead-${l.id}`, href: `/operations/lead/${l.id}`, icon: "clock", tone: "neg",
      title: `Call ${l.name ?? l.email ?? "a new lead"}`, sub: `${slaOf(l).humanLabel}. Past your reply target.`, chip: "Reply now",
    })),
    ...owedNow.map((p): Need => ({
      key: `owed-${p.id}`, href: `/operations/lead/${p.id}`, icon: "arrowR", tone: p.nextDue! < today ? "neg" : "warn",
      title: `${p.name ?? p.email ?? "Unnamed"}: ${p.nextAction}`, sub: `${p.stage} · ${p.side === "buy" ? "buyer" : "seller"}`,
      chip: p.nextDue! < today ? "Overdue" : "Today",
    })),
    ...choices.map((c): Need => ({
      key: `choice-${c.leadId}`, href: `/operations/lead/${c.leadId}`, icon: "scale", tone: "warn",
      title: `${c.name} chose ${c.seen.from}`, sub: `A choice is not an acceptance: the paperwork comes next, before the buyer's deadline.${c.note ? ` “${c.note}”` : ""}`, chip: "Paperwork",
    })),
    ...lapsing.map((l): Need => ({
      key: `lapse-${l.id}`, href: `/operations/lead/${l.id}`, icon: "doc", tone: l.standing.covered ? "warn" : "neg",
      title: `${l.name}: agreement ${l.standing.covered ? "running out" : "expired"}`, sub: l.standing.note, chip: l.standing.covered ? "Running out" : "Expired",
    })),
    ...(rate.freshness !== "fresh" ? [{
      key: "rate", icon: "chart", tone: rate.freshness === "stale" ? "neg" : "warn",
      title: `The rate everyone is shown is ${rate.pct.toFixed(2)}%, ${rate.asOf ? `${rate.ageDays} days old` : "never recorded"}`,
      sub: `${rate.note} Record this week's with npm run rift:rate -- 6.72.`, chip: rate.asOf ? "Old" : "Missing",
    } satisfies Need] : []),
    ...(stale.length ? [{
      key: "programs", href: "/operations/settings", icon: "shield", tone: "warn",
      title: `${stale.length} program${stale.length === 1 ? "" : "s"} withheld from customers until re-checked`,
      sub: `${stale.map((s) => s.name).join(", ")}. ${rules.registryOwner.value} re-checks these within ${recheckDays} days of the last check.`,
      chip: "Re-check",
    } satisfies Need] : []),
  ];
  const needCount = needs.length + pending.length + touchesForYou.length;

  return (
    <>
      <OpsNav agentName={agent.name} undecided={undecidedCount} />

      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Today</h1>
        <p className="t-sm c-3" style={{ marginTop: 6 }}>
          {failures.length || notRecording ? "Some of this page could not be read; see below." : needCount
            ? <><strong>{needCount} thing{needCount === 1 ? "" : "s"} need{needCount === 1 ? "s" : ""} you</strong>{breached ? `, ${breached} of them people waiting for a reply` : ""}. Everything else is below, one press away.</>
            : "Nothing needs you right now. Everything else is below, one press away."}
        </p>

        {/* Never behind a layer: an empty list here has to mean empty. */}
        {failures.length ? (
          <div className="card p-4" style={{ marginTop: 16, borderColor: "var(--neg, #b3261e)" }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-neg" />
              <span className="t-sm w6">
                {failures.length} of this page&apos;s {reads.length} queries failed.
              </span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              What is missing below is missing because a query broke, not because it is not
              there. Treat every empty section on this screen as unknown rather than as zero:
              it has been reported, and the first one said: {failures[0]}
            </p>
          </div>
        ) : notRecording ? (
          <div className="card p-4" style={{ marginTop: 16, borderColor: "var(--warn, #b8791f)" }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-warn" />
              <span className="t-sm w6">Nothing is being recorded right now.</span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              The database is not reachable, so this screen is empty because nothing is being
              stored, not because nobody has arrived. Those are different problems and this one
              is yours to fix.
            </p>
          </div>
        ) : null}
        {datesFailed ? (
          <div className="card p-4" style={{ marginTop: 16, borderColor: "var(--neg, #b3261e)" }}>
            <span className="t-sm w6">The contract dates did not load.</span>
            <p className="t-sm c-3" style={{ marginTop: 6 }}>That is not the same as none being due. Reload in a moment.</p>
          </div>
        ) : null}

        <section className="card opsx-needs" style={{ marginTop: 16 }} aria-labelledby="needs-h">
          <h2 id="needs-h" className="opsx-needs-h">
            <Ico.alert size={14} aria-hidden /> Needs you <span className="c-4 w5">{needCount}</span>
            {overdue.length ? <span className="chip chip-neg t-2xs"><Ico.clock size={10} />{overdue.length} figure check{overdue.length === 1 ? "" : "s"} past {REVIEW_SLA_HOURS}h</span> : null}
          </h2>
          {needs.map((n) => <NeedRow key={n.key} n={n} />)}
          {pending.map((r, i) => (
            <ReviewRow key={r.id} item={r} last={i === pending.length - 1 && !touchesForYou.length} />
          ))}
          {touchesForYou.length ? (
            <a href="#followups" className="opsx-need">
              <span className="opsx-need-icon c-warn"><Ico.mail size={14} aria-hidden /></span>
              <span className="opsx-need-body">
                <span className="t-sm w6">{touchesForYou.length} follow-up{touchesForYou.length === 1 ? "" : "s"} to send yourself today</span>
                <span className="t-xs c-4">They cannot go out on their own. The list is open below.</span>
              </span>
              <span className="chip chip-warn t-2xs">Needs you</span>
            </a>
          ) : null}
          {!needCount ? (
            <p className="t-sm c-3" style={{ padding: "14px 16px" }}>
              {failures.length || notRecording ? "Unknown: some reads failed, so an empty list here proves nothing." : "Nothing needs you right now."}
            </p>
          ) : null}
        </section>

        <div className="opsx-layers">
          {touches.length ? (
            <Layer id="followups" title="Follow-up going out today" open={touchesForYou.length > 0}
              meta={`${touches.filter((t) => t.auto).length} of ${touches.length} go out on their own`}>
              {touches.map((t) => (
                <div key={t.enrolmentId + t.stepId} className="opsx-row">
                  <div className="row wrap gap-2">
                    <span className="t-sm w6">{t.name}</span>
                    <span className="chip">{CHANNEL_LABEL[t.channel]}</span>
                    {t.auto ? <span className="chip chip-pos"><Ico.bolt size={10} />Automatic</span> : <span className="chip chip-warn">Needs you</span>}
                    {t.daysLate > 0 ? <span className="chip chip-neg">{t.daysLate}d late</span> : null}
                  </div>
                  <p className="t-sm" style={{ marginTop: 4 }}>{t.says}</p>
                  <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.55 }}><span className="w6">Gives them: </span>{t.gives}</p>
                  {t.downgraded ? (
                    <p className="t-xs c-4 row gap-2" style={{ marginTop: 5 }}><Ico.lock size={11} style={{ flex: "none", marginTop: 2 }} />{t.downgraded}</p>
                  ) : null}
                </div>
              ))}
            </Layer>
          ) : null}

          <Layer title="Who to call" meta={leads.length ? `${leads.length} lead${leads.length === 1 ? "" : "s"}, best first` : "none yet"}>
            <p className="t-sm c-3" style={{ lineHeight: 1.6, marginBottom: 10 }}>
              Ranked by what the answers say, not by when they arrived. Open anyone to see why they rank where they do.
            </p>
            {leads.length === 0 ? (
              <p className="t-sm c-4">
                {failures.length
                  ? "Or a query failed and this is unknown rather than empty. See the notice above."
                  : notRecording
                    ? "And none would be recorded if there were. See the notice above."
                    : "No leads yet. The readout is live and instrumented."}
              </p>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {leads.map((l, i) => (
                  <LeadRow key={l.id} last={i === leads.length - 1} lead={{
                    ...l,
                    signals: l.signals as { label: string; points: number; note: string }[],
                    slaLabel: slaOf(l).humanLabel,
                    breached: slaOf(l).breached,
                  }} />
                ))}
              </div>
            )}
          </Layer>

          <Layer title="Coming up this week" meta={owedLater.length ? `${owedLater.length} action${owedLater.length === 1 ? "" : "s"}` : "nothing scheduled"}>
            {owedLater.length ? owedLater.map((p) => (
              <Link key={p.id} href={`/operations/lead/${p.id}`} className="opsx-row opsx-link">
                <span className="t-sm w6">{p.name ?? p.email ?? "Unnamed"}</span>
                <span className="t-sm c-2">{p.nextAction}</span>
                <span className="t-xs c-4">
                  {new Date(p.nextDue + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {p.stage}
                </span>
              </Link>
            )) : <p className="t-sm c-3">Nothing scheduled after today. Open anyone and set the one thing you owe them next.</p>}
          </Layer>

          <Layer title="Everyone you are working" meta={working.length ? `${working.length}, quietest first` : "nobody yet"}>
            {working.length === 0 ? (
              <p className="t-sm c-3">
                Nobody on the board yet. <Link href="/operations/add" className="c-brand">Add someone you already work with</Link>.
              </p>
            ) : working.map((p) => (
              <Link key={p.id} href={`/operations/lead/${p.id}`} className="opsx-row opsx-link between gap-2">
                <span>
                  <span className="t-sm w6">{p.name ?? p.email ?? "Unnamed"}</span>
                  <span className="t-xs c-4" style={{ display: "block", marginTop: 2 }}>
                    {p.stage} · {p.side === "buy" ? "buyer" : "seller"}{p.stall ? ` · ${p.stall.days} day${p.stall.days === 1 ? "" : "s"} here` : ""}
                  </span>
                  {p.stall && p.stall.level !== "moving" ? <span className="t-xs c-3" style={{ display: "block", marginTop: 4, maxWidth: 460 }}>{p.stall.unstick}</span> : null}
                </span>
                {p.stall ? <span className={`chip ${STALL_CHIP[p.stall.level].c}`}>{STALL_CHIP[p.stall.level].l}</span> : null}
              </Link>
            ))}
          </Layer>

          {partial.length ? (
            <Layer title="Started, not finished" meta={`${partial.length}, ${partial.filter((a) => a.email).length} with an address`}>
              <p className="t-sm c-3" style={{ lineHeight: 1.6, marginBottom: 8 }}>
                A normal state, not a failure. A resume link only goes to someone who gave an address for it.
              </p>
              {partial.slice(0, 12).map((a) => (
                <div key={a.assessmentId} className="opsx-row between wrap gap-2">
                  <span>
                    <span className="t-sm w55">{a.email ?? "No contact details"}</span>
                    <span className="t-xs c-4" style={{ display: "block", marginTop: 2 }}>
                      {a.side === "buy" ? "Buyer" : "Seller"}{a.county ? ` · ${a.county}` : ""} · {a.answered} question{a.answered === 1 ? "" : "s"} answered · quiet for {a.hoursSince}h
                    </span>
                  </span>
                  {a.email ? <span className="chip chip-acc">Can be sent a resume link</span> : <span className="chip">Nothing to send</span>}
                </div>
              ))}
            </Layer>
          ) : null}

          <Layer title="Where people stop" meta={`the last ${report?.days ?? 90} days`}>
            <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
              Counted in people, not page views. Change a question and watch whether its drop-off moves.
            </p>
            <Funnel label="Buyers" report={report} />
            <Funnel label="Sellers" report={sellReport} />
          </Layer>
        </div>
      </main>
    </>
  );
}

interface Need {
  key: string;
  href?: string;
  icon: keyof typeof Ico;
  tone: "neg" | "warn";
  title: string;
  sub: string;
  chip: string;
}

/** One thing that needs him: what, why in one line, and a word for how urgent (rule 10: never colour alone). */
function NeedRow({ n }: { n: Need }) {
  const Icon = Ico[n.icon];
  const body = (
    <>
      <span className={`opsx-need-icon c-${n.tone}`}><Icon size={14} aria-hidden /></span>
      <span className="opsx-need-body">
        <span className="t-sm w6">{n.title}</span>
        <span className="t-xs c-4">{n.sub}</span>
      </span>
      <span className={`chip chip-${n.tone} t-2xs`}>{n.chip}</span>
    </>
  );
  return n.href ? <Link href={n.href} className="opsx-need">{body}</Link> : <div className="opsx-need">{body}</div>;
}

/**
 * One side of the drop-off report.
 *
 * Both sides are always shown, including the one with no traffic. A funnel
 * that is simply absent from this page reads as "nothing is wrong with it"
 * rather than "nobody has been through it", and those need to look different.
 */
interface FunnelStep {
  questionKey: string;
  reached: number;
  answered: number;
  medianSec: number;
  dropPct: number;
}

function Funnel({ label, report }: {
  label: string;
  report: { days: number; starts: number; steps: FunnelStep[] } | null;
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="t-sm w6 c-3">{label}</div>
      {!report || report.starts < 20 ? (
        <div className="card p-4" style={{ marginTop: 8, background: "var(--sunk)" }}>
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            {report ? `${report.starts} assessment${report.starts === 1 ? "" : "s"} started.` : "No data yet."}{" "}
            Nothing is reported below twenty, because a drop-off computed from four people is
            noise wearing a percentage sign.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8, overflow: "hidden" }}>
          {report.steps.map((s, i) => {
            const d = diagnose(s);
            return (
              <div key={s.questionKey} className="between wrap gap-2" style={{
                padding: "12px 15px", borderBottom: i === report.steps.length - 1 ? undefined : "1px solid var(--line-3)",
              }}>
                <div>
                  <span className="t-sm w55">{s.questionKey}</span>
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>
                    {s.reached} reached · {s.answered} answered · {s.medianSec}s median
                  </div>
                  {d ? <p className="t-xs c-3" style={{ marginTop: 4, maxWidth: 460, lineHeight: 1.5 }}>{d.advice}</p> : null}
                </div>
                <div className="row gap-2">
                  <span className="num t-sm">{s.dropPct}%</span>
                  {d ? <span className={`chip ${d.tone}`}>{d.label}</span> : <span className="chip chip-pos">Healthy</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
