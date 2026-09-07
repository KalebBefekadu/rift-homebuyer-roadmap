import type { Metadata } from "next";
import Link from "next/link";
import { currentAgent } from "@/lib/db/session";
import { rankedLeads } from "@/lib/db/leads";
import { funnelReport } from "@/lib/db/events";
import { readStale } from "@/lib/db/programs";
import { openItems } from "@/lib/db/review";
import { due } from "@/lib/db/nurture";
import { Trust } from "@/components/rift/Trust";
import { REVIEW_SLA_HOURS } from "@/lib/core/review";
import { CHANNEL_LABEL } from "@/lib/core/nurture";
import { BAND_LABEL, BAND_TONE, sla, type Band } from "@/lib/core/lead";
import { diagnose } from "./diagnose";
import { Ico, Mark } from "@/components/rift/icons";

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
        <div className="row gap-2" style={{ marginTop: 18 }}>
          <Link href="/buy" className="btn btn-p">Rift for buyers</Link>
        </div>
      </main>
    );
  }

  const [leadsRead, reportRead, staleRead, reviewRead, dueRead] = await Promise.all([
    rankedLeads(50),
    funnelReport("buy"),
    readStale(new Date()),
    openItems(),
    due(new Date()),
  ]);

  const leads = leadsRead.ok && "data" in leadsRead ? leadsRead.data : [];
  const report = reportRead.ok && "data" in reportRead ? reportRead.data : null;
  const stale = staleRead.ok && "data" in staleRead ? staleRead.data : [];
  const review = reviewRead.ok && "data" in reviewRead ? reviewRead.data : [];
  const touches = dueRead.ok && "data" in dueRead ? dueRead.data : [];
  const pending = review.filter((r) => r.state === "pending-review");
  const overdue = pending.filter((r) => r.waitingHours > REVIEW_SLA_HOURS);

  /* Nothing is being recorded is a different state from nobody has arrived,
     and an agent who cannot tell them apart will draw the wrong conclusion
     from an empty screen. */
  const notRecording = ("skipped" in leadsRead) || ("skipped" in reportRead);

  const breached = leads.filter((l) => {
    const hours = (Date.now() - new Date(l.createdAt).getTime()) / 3_600_000;
    return sla(
      { completion: 1, humanRepliedMins: l.humanRepliedAt ? 1 : null, hoursSince: hours } as never,
      l.band as Band,
    ).breached;
  }).length;

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <div className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
            <span className="chip chip-out t-2xs">Studio</span>
          </div>
          <span className="t-xs c-4">{agent.name}</span>
        </div>
      </header>

      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Today</h1>

        {notRecording ? (
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
                  <div key={r.id} style={{ padding: "12px 15px", borderBottom: i === pending.length - 1 ? undefined : "1px solid var(--line-3)" }}>
                    <div className="between wrap gap-2">
                      <div className="row wrap gap-2">
                        <span className="t-sm w6">{r.who}</span>
                        <Trust state={r.state} short />
                        <span className={`chip ${r.waitingHours > REVIEW_SLA_HOURS ? "chip-neg" : ""}`}>{r.waitingHours}h waiting</span>
                      </div>
                      <span className="mono t-sm w6">{r.claim}</span>
                    </div>
                    <p className="t-sm" style={{ marginTop: 4 }}>{r.what}</p>
                    <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.55 }}>
                      <span className="w6">To advance: </span>{r.toAdvance}
                    </p>
                  </div>
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
                {notRecording
                  ? "And none would be recorded if there were. See the notice above."
                  : "The readout is live and instrumented. The first 200 completed assessments are what turns every assumption in this product into a measurement."}
              </span>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
              {leads.map((l, i) => (
                <div key={l.id} style={{ padding: "13px 15px", borderBottom: i === leads.length - 1 ? undefined : "1px solid var(--line-3)" }}>
                  <div className="between wrap gap-2">
                    <div className="row wrap gap-2">
                      <span className="t-sm w6">{l.name || l.email || "Anonymous"}</span>
                      <span className={`chip ${BAND_TONE[l.band as Band] ?? "chip"}`}>{BAND_LABEL[l.band as Band] ?? l.band}</span>
                      <span className="chip">{l.side === "buy" ? "Buyer" : "Seller"}</span>
                    </div>
                    <span className="num t-sm">{l.score}</span>
                  </div>
                  {/* The arithmetic, not a tooltip. */}
                  <div className="row wrap gap-2" style={{ marginTop: 7 }}>
                    {(l.signals as { label: string; points: number; note: string }[]).map((s) => (
                      <span key={s.label} className="chip t-2xs" title={s.note}>
                        {s.label} {s.points > 0 ? "+" : ""}{s.points}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
