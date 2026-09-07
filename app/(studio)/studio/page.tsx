import type { Metadata } from "next";
import Link from "next/link";
import { currentAgent } from "@/lib/db/session";
import { rankedLeads } from "@/lib/db/leads";
import { funnelReport } from "@/lib/db/events";
import { readStale } from "@/lib/db/programs";
import { openItems } from "@/lib/db/review";
import { due } from "@/lib/db/nurture";
import { abandoned } from "@/lib/db/recovery";
import { currentRate } from "@/lib/db/rates";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { CHANNEL_LABEL } from "@/lib/core/nurture";
import { ReviewRow } from "./ReviewRow";
import { LeadRow } from "./LeadRow";
import { signOut } from "./actions";
import { sla, type Band } from "@/lib/core/lead";
import { diagnose } from "./diagnose";
import { Ico, Mark } from "@/components/rift/icons";
import { captureOpError } from "@/lib/monitoring/capture";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/**
 * Studio, the minimum agent surface for the MVP.
 *
 * Two things only: the leads the readout produced, ranked by what their answers
 * say rather than by when they arrived, and the funnel's own drop-off. Not the
 * whole of Studio — the board, offers, calendar and client records are phase 5,
 * and building them now would mean building against guesses, because there is
 * no live traffic yet for them to operate on.
 *
 * The ranking shows its own arithmetic. An agent who cannot see why a lead
 * ranks where it does stops trusting the ranking inside a week, and a ranking
 * nobody trusts still costs attention.
 */
export default async function StudioToday() {
  const agent = await currentAgent();

  if (!agent) {
    return (
      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: 28 }}>Studio is for the agent.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Sign in to see the people your readout has produced. If you arrived here by accident,
          the buyer product is a better place to be.
        </p>
        <div className="row gap-2 wrap" style={{ marginTop: 18 }}>
          <Link href="/studio/sign-in" className="btn btn-p">Sign in</Link>
          <Link href="/buy" className="btn btn-g">Rift for buyers</Link>
        </div>
      </main>
    );
  }

  /* One round, not two. None of these depends on another, and splitting them
     made the page wait for the slowest of the first five before starting the
     last two — for no reason beyond the order they were written in. Studio is
     the screen the agent opens first thing, so its latency is the product's
     felt speed. */
  const [leadsRead, reportRead, staleRead, reviewRead, dueRead, abandonedRead, rate] =
    await Promise.all([
      rankedLeads(50),
      funnelReport("buy"),
      readStale(new Date()),
      openItems(),
      due(new Date()),
      abandoned(),
      currentRate(),
    ]);

  const partial = abandonedRead.ok && "data" in abandonedRead ? abandonedRead.data : [];

  const leads = leadsRead.ok && "data" in leadsRead ? leadsRead.data : [];
  const report = reportRead.ok && "data" in reportRead ? reportRead.data : null;
  const stale = staleRead.ok && "data" in staleRead ? staleRead.data : [];
  const review = reviewRead.ok && "data" in reviewRead ? reviewRead.data : [];
  const touches = dueRead.ok && "data" in dueRead ? dueRead.data : [];
  const pending = review.filter((r) => r.state === "pending-review");
  const overdue = pending.filter((r) => r.waitingHours > REVIEW_SLA_HOURS);

  /* Three states, not two.
     
     "Nobody has arrived" and "nothing is being recorded" were already held
     apart. A query that FAILED was falling into neither — it produced an empty
     list, so a database error rendered "No leads yet" alongside copy assuring
     the agent that the readout is live and instrumented. That is the product
     telling him a comforting thing it cannot know. */
  const reads = [leadsRead, reportRead, staleRead, reviewRead, dueRead, abandonedRead];
  const notRecording = reads.some((r) => "skipped" in r);
  const failures = reads.filter((r) => !r.ok).map((r) => (r as { error: string }).error);
  /* Shown to the agent AND reported. He can see something is wrong; only the
     capture says what, and only somebody looking at Sentry will fix it. */
  for (const error of failures) captureOpError(new Error(error), { op: "studio.today" });

  /* No cast. The previous version fabricated the input and cast it to `never`,
     which hid a missing `contactable` and made every lead report as unbreached
     — an indicator that read as "doing well" because it could not fire. */
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

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <div className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
            <span className="chip chip-out t-2xs">Studio</span>
          </div>
          <div className="row gap-2">
            <span className="t-xs c-4">{agent.name}</span>
            <form action={signOut}>
              <button className="btn btn-g btn-sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Today</h1>

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
              there. Treat every empty section on this screen as unknown rather than as zero —
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
              stored — not because nobody has arrived. Those are different problems and this one
              is yours to fix.
            </p>
          </div>
        ) : null}

        {/* The rate is the assumption the most figures depend on and the only
            one that moves weekly. Recording it is a manual habit, so the one
            thing that must not happen is nobody noticing it has lapsed —
            every monthly figure in the product quietly drifts with it. */}
        {rate.freshness !== "fresh" ? (
          <div className="card p-4" style={{ marginTop: 16 }}>
            <div className="between wrap gap-2">
              <div className="row gap-2">
                <Ico.chart size={15} className="c-3" />
                <span className="t-sm w6">
                  The rate everyone is being shown is {rate.pct.toFixed(2)}%
                </span>
              </div>
              <span className={`chip ${rate.freshness === "stale" ? "chip-neg" : "chip-warn"}`}>
                {rate.asOf ? `${rate.ageDays} days old` : "Never recorded"}
              </span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              {rate.note} Record this week&apos;s with{" "}
              <span className="mono t-xs">npm run rift:rate -- 6.72</span>.
            </p>
          </div>
        ) : null}

        {stale.length ? (
          <div className="card p-4" style={{ marginTop: 16 }}>
            <div className="between wrap gap-2">
              <div className="row gap-2">
                <Ico.shield size={15} className="c-3" />
                <span className="t-sm w6">
                  {stale.length} program{stale.length === 1 ? "" : "s"} withheld from customers
                </span>
              </div>
              <span className="chip chip-warn">Needs re-verifying</span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              {stale.map((s) => s.name).join(", ")}. Nobody is being shown {stale.length === 1 ? "it" : "them"}
              {" "}until {stale.length === 1 ? "it is" : "they are"} checked again. Suppression is
              silent to the customer and loud here, which is the right way round.
            </p>
          </div>
        ) : null}

        {/* Waiting on a person */}
        {pending.length || touches.length ? (
          <section style={{ marginTop: 28 }}>
            <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>
              Waiting on you
            </h2>

            {pending.length ? (
              <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
                <div className="between wrap gap-2" style={{ padding: "11px 15px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Asked you to check a figure</span>
                  {overdue.length
                    ? <span className="chip chip-neg"><Ico.clock size={11} />{overdue.length} past {REVIEW_SLA_HOURS}h</span>
                    : <span className="chip chip-pos">All inside {REVIEW_SLA_HOURS}h</span>}
                </div>
                {pending.map((r, i) => (
                  <ReviewRow key={r.id} item={r} last={i === pending.length - 1} />
                ))}
              </div>
            ) : null}

            {touches.length ? (
              <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
                <div className="between wrap gap-2" style={{ padding: "11px 15px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Follow-up due today</span>
                  <span className="chip">{touches.filter((t) => t.auto).length} of {touches.length} go out on their own</span>
                </div>
                {touches.map((t, i) => (
                  <div key={t.enrolmentId + t.stepId} style={{ padding: "12px 15px", borderBottom: i === touches.length - 1 ? undefined : "1px solid var(--line-3)" }}>
                    <div className="row wrap gap-2">
                      <span className="t-sm w6">{t.name}</span>
                      <span className="chip">{CHANNEL_LABEL[t.channel]}</span>
                      {t.auto ? <span className="chip chip-pos"><Ico.bolt size={10} />Automatic</span> : <span className="chip chip-warn">Needs you</span>}
                      {t.daysLate > 0 ? <span className="chip chip-neg">{t.daysLate}d late</span> : null}
                    </div>
                    <p className="t-sm" style={{ marginTop: 4 }}>{t.says}</p>
                    <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>
                      <span className="w6">Gives them: </span>{t.gives}
                    </p>
                    {t.downgraded ? (
                      <p className="t-xs c-4 row gap-2" style={{ marginTop: 5 }}>
                        <Ico.lock size={11} style={{ flex: "none", marginTop: 2 }} />{t.downgraded}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Leads */}
        <section style={{ marginTop: 28 }}>
          <div className="between wrap gap-2">
            <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>
              Who to call
            </h2>
            {breached ? <span className="chip chip-neg"><Ico.clock size={11} />{breached} past the reply target</span> : null}
          </div>
          <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 660, lineHeight: 1.6 }}>
            Ranked by what the answers say, not by when they arrived. An inbox makes everyone
            look equally urgent, which is the same as making nobody urgent.
          </p>

          {leads.length === 0 ? (
            <div className="card p-5 center col gap-2" style={{ marginTop: 14 }}>
              <Ico.users size={20} className="c-4" />
              <span className="t-sm w55">No leads yet.</span>
              <span className="t-xs c-4" style={{ maxWidth: 380, textAlign: "center", lineHeight: 1.55 }}>
                {failures.length
                  ? "Or a query failed and this is unknown rather than empty. See the notice above."
                  : notRecording
                    ? "And none would be recorded if there were. See the notice above."
                    : "The readout is live and instrumented. The first 200 completed assessments are what turns every assumption in this product into a measurement."}
              </span>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
              {leads.map((l, i) => (
                <LeadRow
                  key={l.id}
                  lead={{
                    ...l,
                    signals: l.signals as { label: string; points: number; note: string }[],
                    slaLabel: slaOf(l).humanLabel,
                    breached: slaOf(l).breached,
                  }}
                  last={i === leads.length - 1}
                />
              ))}
            </div>
          )}
        </section>

        {/* Abandoned */}
        {partial.length ? (
          <section style={{ marginTop: 32 }}>
            <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>
              Started, not finished
            </h2>
            <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 660, lineHeight: 1.6 }}>
              The largest source of lost leads in this product, and a normal state rather than a
              failure. Most of these people have given no way to reach them, which is the correct
              outcome — a resumable link goes only to somebody who gave an address for that
              purpose.
            </p>
            <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
              {partial.slice(0, 12).map((a, i) => (
                <div key={a.assessmentId} className="between wrap gap-2" style={{
                  padding: "11px 15px", borderBottom: i === Math.min(partial.length, 12) - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <div>
                    <div className="row wrap gap-2">
                      <span className="t-sm w55">{a.email ?? "No contact details"}</span>
                      <span className="chip">{a.side === "buy" ? "Buyer" : "Seller"}</span>
                      {a.county ? <span className="chip">{a.county}</span> : null}
                    </div>
                    <div className="t-xs c-4" style={{ marginTop: 3 }}>
                      {a.answered} question{a.answered === 1 ? "" : "s"} answered · quiet for {a.hoursSince}h
                    </div>
                  </div>
                  {a.email
                    ? <span className="chip chip-acc">Can be sent a resume link</span>
                    : <span className="chip">Nothing to send</span>}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Funnel */}
        <section style={{ marginTop: 32 }}>
          <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>
            Where people stop
          </h2>
          <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 660, lineHeight: 1.6 }}>
            Counted in distinct sessions, never in page views. A person who backs up and re-reads
            a question is one person.
          </p>

          {!report || report.starts < 20 ? (
            <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
              <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                {report ? `${report.starts} assessment${report.starts === 1 ? "" : "s"} started.` : "No data yet."}{" "}
                Nothing is reported below twenty, because a drop-off computed from four people is
                noise wearing a percentage sign.
              </p>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
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
        </section>
      </main>
    </>
  );
}
