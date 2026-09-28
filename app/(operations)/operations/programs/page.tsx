import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { rulesOrDefaults } from "@/lib/db/settings";
import { readChecks } from "@/lib/db/program-checks";
import { jobsHealth } from "@/lib/db/jobs";
import { GEORGIA_PROGRAMS, isCurrent, reviewDue } from "@/lib/core/assistance";
import { mayFit } from "@/lib/core/alerts";
import { alertSubscribers } from "@/lib/db/saved-plan";
import { applyChecks, openFlags, textDiff, type CheckOutcome, type SourceCheck } from "@/lib/core/program-check";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { reviewProgramPage, prepareProgramAlerts } from "./actions";
import { showDay } from "@/lib/core/day";

export const metadata: Metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });

const READING: Record<CheckOutcome, { label: string; chip: string }> = {
  baseline: { label: "First reading", chip: "chip-out" },
  unchanged: { label: "Unchanged", chip: "chip-pos" },
  changed: { label: "Changed", chip: "chip-warn" },
  unreachable: { label: "Could not read", chip: "chip-neg" },
};

/**
 * Programs (Blueprint v5 §6.5, §8.4): the Georgia assistance records, whether
 * buyers see each one, and the official pages that changed and need a person.
 *
 * Operations is utilitarian (§4.6): one table, the flags above it, every
 * state in a word as well as a colour.
 */
export default async function ProgramsReview() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const [{ rules }, read, jobs, subsRead] = await Promise.all([rulesOrDefaults(agent.agentId), readChecks({ withText: true }), jobsHealth(), alertSubscribers()]);
  const subs = subsRead.ok && "data" in subsRead ? subsRead.data : [];
  const window = rules.registryDays.value;
  const today = new Date();
  const data = read.ok && "data" in read ? read.data : null;
  const tracked = data !== null;
  const checks = data?.checks ?? [];
  const reviews = data?.reviews ?? [];
  const records = applyChecks(GEORGIA_PROGRAMS, checks, reviews);
  const flags = openFlags(GEORGIA_PROGRAMS, checks, reviews);
  const job = jobs.ok && "data" in jobs && jobs.data ? jobs.data.find((j) => j.job === "program-check") : null;

  const latest = (url: string): SourceCheck | null =>
    checks.filter((c) => c.sourceUrl === url).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] ?? null;

  const h2 = { fontSize: 20, letterSpacing: "-0.01em", marginTop: 32 } as const;

  return (
    <>
      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 1040 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Programs</h1>
        <p className="t-sm c-3 mt-2 measure" style={{ lineHeight: 1.6 }}>
          Every Monday Rift reads each program&apos;s official page. An unchanged page renews the program.
          A changed page waits for you here, and the program is not renewed until you answer.
          Programs not renewed within {window} days are withheld from buyers.
        </p>

        {!tracked ? (
          <div className="card p-4 mt-4" style={{ borderColor: "var(--warn-line, var(--line-2))" }}>
            <div className="row gap-2"><Ico.alert size={15} className="c-warn" /><span className="t-sm w6">Program checks are not recorded yet</span></div>
            <p className="t-sm c-3 mt-1">
              {read.ok ? "The tables for them do not exist on this database. Apply the migration 20260926030000_rift_program_checks.sql." : `The checks did not load: ${read.error}.`}
              {" "}Until then each program stands on the date it was written, and ages out on schedule.
            </p>
          </div>
        ) : job?.problem ? (
          <div className="card p-4 mt-4" style={{ borderColor: "var(--neg, #b3261e)" }}>
            <div className="row gap-2"><Ico.alert size={15} className="c-neg" /><span className="t-sm w6">The weekly check needs you</span></div>
            <p className="t-sm c-3 mt-1">{job.problem}</p>
          </div>
        ) : null}

        <h2 className="serif" style={h2}>Needs your review</h2>
        {flags.length ? (
          <div className="col gap-3 mt-3">
            {flags.map((f) => {
              const diff = textDiff(f.before?.text ?? null, f.check.text);
              const asked = subs.filter((x) => f.programs.some((p) => mayFit(p, x.plan)));
              return (
                <article key={f.check.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <div>
                      <div className="t-md w6">{f.programs.map((p) => p.name).join(", ")}</div>
                      <div className="t-xs c-4 mt-1">
                        {f.check.outcome === "unreachable"
                          ? `Could not be read on ${DAY(f.check.checkedAt)}: ${f.check.detail ?? "no reason given"}.`
                          : `Changed since ${f.before ? DAY(f.before.checkedAt) : "the last reading"}; read ${DAY(f.check.checkedAt)}.`}
                      </div>
                    </div>
                    <a href={f.check.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">Open the official page<Ico.arrowUpR size={12} /></a>
                  </div>

                  {f.check.summary ? (
                    <div className="card p-3 mt-3" style={{ background: "var(--sunk)" }}>
                      <div className="t-xs w6 c-3">What the automatic comparison found (check it on the page)</div>
                      <p className="t-xs c-2 mt-1" style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{f.check.summary}</p>
                    </div>
                  ) : null}

                  {f.check.outcome === "changed" ? (
                    f.check.text === null ? (
                      <p className="t-sm c-3 mt-3">This source is a PDF, so there is no text to compare. Open it and check the amounts, limits and dates against the record.</p>
                    ) : diff.removed.length || diff.added.length ? (
                      <div className="g2 gap-3 mt-3">
                        <div>
                          <div className="t-xs w6 c-3">No longer on the page</div>
                          <ul className="col gap-1 mt-1">{diff.removed.length ? diff.removed.map((l, i) => <li key={i} className="t-xs c-2" style={{ lineHeight: 1.5 }}>− {l}</li>) : <li className="t-xs c-4">Nothing removed</li>}</ul>
                        </div>
                        <div>
                          <div className="t-xs w6 c-3">New on the page</div>
                          <ul className="col gap-1 mt-1">{diff.added.length ? diff.added.map((l, i) => <li key={i} className="t-xs c-2" style={{ lineHeight: 1.5 }}>+ {l}</li>) : <li className="t-xs c-4">Nothing added</li>}</ul>
                        </div>
                      </div>
                    ) : (
                      <p className="t-sm c-3 mt-3">Only the order or spacing of the text changed.</p>
                    )
                  ) : null}

                  {asked.length ? (
                    <div className="card p-3 mt-3">
                      <div className="t-xs w6">{asked.length === 1 ? "One person asked" : `${asked.length} people asked`} to hear when a program they may fit changes</div>
                      <p className="t-2xs c-4 mt-1">Rift can prepare an email to each; every one waits in your Outbox until you approve it (D04).</p>
                      <ul className="row wrap gap-2 mt-2">
                        {asked.map((x) => <li key={x.leadId}><Link href={`/operations/lead/${x.leadId}`} className="chip">{x.name ?? "Unnamed"}</Link></li>)}
                      </ul>
                      <form action={prepareProgramAlerts} className="mt-2">
                        <input type="hidden" name="checkId" value={f.check.id} />
                        <button className="btn btn-g btn-sm" type="submit">Prepare an email to each, for my approval</button>
                      </form>
                    </div>
                  ) : null}

                  <form action={reviewProgramPage} className="col gap-2 mt-3" style={{ paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
                    <input type="hidden" name="checkId" value={f.check.id} />
                    <label className="field">
                      <span className="label">Note (optional)</span>
                      <input className="input" name="note" maxLength={500} placeholder="What you checked, or what needs changing" />
                    </label>
                    <div className="row gap-2 wrap">
                      <button className="btn btn-p btn-sm" type="submit" name="outcome" value="still-right"><Ico.check size={13} />The record is still right</button>
                      <button className="btn btn-g btn-sm" type="submit" name="outcome" value="needs-update"><Ico.alert size={13} />It needs updating: stop showing it</button>
                    </div>
                    <span className="t-2xs c-4">Recorded as reviewed by {agent.name}. &ldquo;Needs updating&rdquo; withholds the program from buyers until its record is edited.</span>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="t-sm c-3 mt-2">{tracked ? "Nothing. Every page read so far matches its last reading, or has been reviewed." : "Nothing can be flagged until the checks are recorded."}</p>
        )}

        <h2 className="serif" style={h2}>Every record</h2>
        <div className="card scroll-x mt-3">
          <table className="tbl" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Buyers see it</th>
                <th scope="col">Last checked</th>
                <th scope="col">Due by</th>
                <th scope="col">Latest reading</th>
              </tr>
            </thead>
            <tbody>
              {records.map((p) => {
                const shown = isCurrent(p, today, window);
                const state = p.withheldReason ? { t: "Withdrawn", c: "chip-neg" }
                  : p.status === "unverified" ? { t: "Not confirmed", c: "chip-out" }
                  : shown ? { t: "Shown", c: "chip-pos" } : { t: "Withheld: overdue", c: "chip-warn" };
                const last = latest(p.sourceUrl);
                return (
                  <tr key={p.slug}>
                    <td style={{ maxWidth: 300 }}>
                      <div className="w6 t-sm">{p.name}</div>
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="t-xs c-brand">{p.sourceName}</a>
                    </td>
                    <td><span className={`chip t-2xs ${state.c}`}>{state.t}</span>{p.withheldReason ? <div className="t-2xs c-4 mt-1">{p.withheldReason}</div> : null}</td>
                    <td className="t-sm">{DAY(p.checkedOn)}</td>
                    <td className="t-sm">{p.status === "active" ? DAY(reviewDue(p, window)) : "–"}</td>
                    <td>{last ? <span className={`chip t-2xs ${READING[last.outcome].chip}`}>{READING[last.outcome].label} · {DAY(last.checkedAt)}</span> : <span className="t-xs c-4">Not read yet</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>
          Records are kept in <span className="mono">lib/core/assistance.ts</span>, written from each program&apos;s own page.
          Editing one and deploying it clears a withdrawal. The re-check window is a <Link href="/operations/settings" className="c-brand">setting</Link>.
        </p>
      </main>
    </>
  );
}

