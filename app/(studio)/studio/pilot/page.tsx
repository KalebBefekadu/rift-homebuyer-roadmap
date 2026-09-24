import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { pilotReport, type PilotJourney } from "@/lib/db/pilot";
import { buyerSearchOn } from "@/lib/core/journey";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/core/progress";
import {
  ANSWER_LABEL, ASK_LABEL, DATES_CHECK_LABEL, PILOT_TZ, SEARCH_CHECK_LABEL,
  durationText, promiseLine, replyStats, setupStats, timing, type CheckState,
} from "@/lib/core/pilot";
import { PrintButton } from "@/components/rift/PrintButton";
import { StudioHeader } from "../StudioHeader";
import { Unavailable } from "../Unavailable";
import { Check } from "./Check";

export const metadata: Metadata = { title: "Pilot" };
export const dynamic = "force-dynamic";

const WHEN = (iso: string) => new Date(iso).toLocaleString("en-US", {
  timeZone: PILOT_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: PILOT_TZ, month: "short", day: "numeric" });

function checkLine(c: CheckState): { text: string; tone: "pos" | "warn" | "neg" | "none" } {
  switch (c.state) {
    case "never": return { text: "Never checked against Matrix or the documents.", tone: "warn" };
    case "differs": return {
      text: `Checked ${DAY(c.check.at)} by ${c.check.by}: ${[
        c.check.search === "differs" ? "the Matrix search differed" : "",
        c.check.dates === "differs" ? "a date differed" : "",
      ].filter(Boolean).join(" and ")}. It stands until a later check finds a match.`,
      tone: "neg",
    };
    case "changed": return {
      text: `Matched when checked ${DAY(c.check.at)}, but the ${c.what.join(" and the ")} changed since. Check again.`,
      tone: "warn",
    };
    case "current": return { text: `Matched when checked ${DAY(c.check.at)} by ${c.check.by}. Nothing has changed since.`, tone: "pos" };
  }
}

/**
 * The pilot's evidence (W12): whether the same-business-day promise (D07) is
 * kept, how long searches take to set up, and whether Rift's record of each
 * buyer's search and dates still matches Matrix and the documents.
 *
 * Every figure is counted from what is recorded; nothing is estimated, and
 * nothing is compared with a time before Rift, because none was measured.
 * The page prints, so the report can be kept or handed on as a PDF.
 */
export default async function PilotPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/studio/sign-in");
  const agent = session.agent;

  const now = new Date();
  const on = buyerSearchOn(process.env);
  const report = on ? await pilotReport(now) : null;
  const data = report && report.ok && "data" in report ? report.data : null;

  const stats = data ? replyStats(data.asks, now) : [];
  const setup = data ? setupStats(data.setup) : null;
  const asked = stats.filter((s) => s.asked > 0);
  const quiet = stats.filter((s) => s.asked === 0);
  const owed = data ? data.asks.filter((a) => ["waiting", "overdue"].includes(timing(a, now))) : [];
  const current: PilotJourney[] = data ? data.journeys.filter((j) => j.status === "active" || j.status === "paused") : [];
  const members = data ? data.journeys.reduce((m, j) => ({
    invited: m.invited + j.members.invited, accepted: m.accepted + j.members.accepted, withdrawn: m.withdrawn + j.members.withdrawn,
  }), { invited: 0, accepted: 0, withdrawn: 0 }) : null;

  const h2 = { fontSize: 20, letterSpacing: "-0.01em", marginTop: 32 } as const;

  return (
    <>
      <div className="no-print"><StudioHeader agentName={agent.name} current="pilot" /></div>
      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 860 }}>
        <div className="between gap-2 wrap">
          <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Pilot</h1>
          <div className="no-print"><PrintButton /></div>
        </div>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
          What the pilot shows so far, counted from what is recorded in Rift, as of {WHEN(now.toISOString())} (New York time).
          Nothing here is compared with how long the same work took before Rift, because that was never measured.
        </p>

        {!on ? (
          <p className="t-sm c-3" style={{ marginTop: 20 }}>Journeys are switched off on this deployment (RIFT_BUYER_SEARCH=off).</p>
        ) : report && !report.ok ? (
          <p className="t-sm c-neg" style={{ marginTop: 20 }}>
            The pilot report did not load ({report.error}). This is not an empty report; it is one we could not read.
          </p>
        ) : report && "skipped" in report ? (
          <p className="t-sm c-3" style={{ marginTop: 20 }}>{report.reason}</p>
        ) : !data || data.journeys.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="t-sm w6">No buying journeys yet.</div>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              The report fills in as pilot buyers are added. Start a journey from a buyer in{" "}
              <Link className="u" href="/studio/clients">Relationships</Link>.
            </p>
          </div>
        ) : (
          <>
            {data.truncated ? (
              <p className="t-xs c-neg" style={{ marginTop: 16 }}>
                Some records reached the report&apos;s reading limit, so the counts below may be short.
              </p>
            ) : null}

            <h2 className="serif" style={h2}>Same-day replies</h2>
            <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
              The pilot promises buyers a reply the same business day. Anything asked on a weekend or holiday is due the next
              business day. {promiseLine(stats)}
            </p>
            {asked.length ? (
              <>
                {/* Scrolls on its own at phone width; focusable so a keyboard can scroll it too. */}
                <div role="region" aria-label="Replies by kind" tabIndex={0} style={{ overflowX: "auto", marginTop: 12 }}>
                  <table className="t-xs" style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                    <thead>
                      <tr className="c-3" style={{ textAlign: "left" }}>
                        <th scope="col" style={{ padding: "6px 8px 6px 0", fontWeight: 600 }}>What a buyer did</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Asked</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Same day</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Later</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Past due</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Waiting, not late yet</th>
                        <th scope="col" style={{ padding: 6, fontWeight: 600 }}>Typical time to answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asked.map((s) => (
                        <tr key={s.kind} style={{ borderTop: "1px solid var(--line-2)" }}>
                          <th scope="row" style={{ padding: "8px 8px 8px 0", fontWeight: 500, textAlign: "left" }}>
                            {ASK_LABEL[s.kind]}
                            <span className="c-4" style={{ display: "block", fontWeight: 400 }}>Answered by {ANSWER_LABEL[s.kind]}</span>
                          </th>
                          <td style={{ padding: 6 }}>{s.asked}</td>
                          <td style={{ padding: 6 }}>{s.sameDay}</td>
                          <td style={{ padding: 6 }}>{s.later}</td>
                          <td style={{ padding: 6 }} className={s.overdue ? "c-neg w6" : ""}>{s.overdue}</td>
                          <td style={{ padding: 6 }}>{s.waiting}</td>
                          <td style={{ padding: 6 }}>{s.medianHours === null ? "None answered yet" : durationText(s.medianHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="t-xs c-4" style={{ marginTop: 6 }}>Typical is the middle value of the answered ones.</p>
              </>
            ) : null}
            {quiet.length && asked.length ? (
              <p className="t-xs c-4" style={{ marginTop: 4 }}>Nothing yet: {quiet.map((s) => ASK_LABEL[s.kind].toLowerCase()).join("; ")}.</p>
            ) : null}
            {owed.length ? (
              <div className="card p-3" style={{ marginTop: 12 }}>
                <div className="t-sm w6">Still waiting on you</div>
                <ul className="t-xs" style={{ marginTop: 6, display: "grid", gap: 4 }}>
                  {owed.map((a, i) => (
                    <li key={i}>
                      <Link className="u" href={`/studio/journey/${a.journeyId}`}>{a.person}</Link>: {ASK_LABEL[a.kind].toLowerCase()}, asked {WHEN(a.askedAt)}
                      {timing(a, now) === "overdue" ? <strong className="c-neg"> (past due)</strong> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h2 className="serif" style={h2}>Search setup</h2>
            {setup && (setup.recorded || setup.waiting || setup.dropped) ? (
              <ul className="t-sm c-2" style={{ marginTop: 8, display: "grid", gap: 4, lineHeight: 1.6 }}>
                <li>
                  {setup.recorded} approved {setup.recorded === 1 ? "search" : "searches"} recorded as set up in Matrix
                  {setup.medianHours !== null ? `, typically ${durationText(setup.medianHours)} after approval` : ""}.
                </li>
                {setup.waiting ? <li>{setup.waiting} approved and not recorded in Matrix yet.</li> : null}
                {setup.dropped ? <li>{setup.dropped} replaced or cancelled before being recorded.</li> : null}
              </ul>
            ) : (
              <p className="t-sm c-3" style={{ marginTop: 8 }}>No search has been approved yet.</p>
            )}

            <h2 className="serif" style={h2}>Checked against Matrix and the documents</h2>
            <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
              Rift cannot see Matrix or the signed documents, so for each buyer you check that the search Rift shows is the
              one running in Matrix and that the dates are the ones in the contract. A check goes stale when either changes.
            </p>
            {data.unavailable ? <p className="t-xs c-neg" style={{ marginTop: 10 }}>{data.unavailable}</p> : null}
            {current.length === 0 ? (
              <p className="t-sm c-3" style={{ marginTop: 10 }}>No active or paused buying journeys.</p>
            ) : (
              <ul style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {current.map((j) => {
                  const line = checkLine(j.check);
                  return (
                    <li key={j.id} className="card p-3">
                      <div className="between gap-2 wrap">
                        <span>
                          <Link className="t-sm w6 u" href={`/studio/journey/${j.id}`}>{j.person}</Link>
                          <span className="t-xs c-4"> · {j.label}</span>
                        </span>
                        <span className="chip t-xs">{STAGE_LABEL[j.stage]}{j.status === "paused" ? `, ${STATUS_LABEL.paused.toLowerCase()}` : ""}</span>
                      </div>
                      <ul className="t-xs c-3" style={{ marginTop: 6, display: "grid", gap: 2, lineHeight: 1.6 }}>
                        <li>
                          {j.search
                            ? `Matrix search recorded${j.search.status === "paused" ? ", paused" : ""}${j.search.ref ? ` (${j.search.ref})` : ""}.`
                            : `${SEARCH_CHECK_LABEL.none}.`}
                        </li>
                        <li>
                          {j.dates.active
                            ? `${j.dates.active} contract ${j.dates.active === 1 ? "date" : "dates"} in force${j.dates.unchecked ? `, ${j.dates.unchecked} not checked against the document yet` : ""}.`
                            : `${DATES_CHECK_LABEL.none}.`}
                        </li>
                        <li>
                          {j.members.invited
                            ? `${j.members.accepted} of ${j.members.invited} invited ${j.members.invited === 1 ? "person has" : "people have"} signed in${j.members.withdrawn ? `, ${j.members.withdrawn} withdrawn` : ""}.`
                            : "Nobody invited yet."}
                        </li>
                      </ul>
                      <p className={`t-xs ${line.tone === "pos" ? "c-pos" : line.tone === "neg" ? "c-neg" : line.tone === "warn" ? "c-warn" : "c-3"}`}
                        style={{ marginTop: 6, fontWeight: 600 }}>
                        {line.text}
                      </p>
                      {j.check.state === "differs" && j.check.check.note ? (
                        <p className="t-xs c-3" style={{ marginTop: 2 }}>&ldquo;{j.check.check.note}&rdquo;</p>
                      ) : null}
                      {data.unavailable ? null : (
                        <Check journeyId={j.id} has={j.has} stamp={`${j.id}:${j.check.state}:${"check" in j.check ? j.check.check.at : ""}`} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="serif" style={h2}>Sign-in and scheduled work</h2>
            <ul className="t-sm c-2" style={{ marginTop: 8, display: "grid", gap: 4, lineHeight: 1.6 }}>
              <li>
                {members && members.invited
                  ? `${members.accepted} of ${members.invited} invited household members have signed in with their emailed link at least once.`
                  : "Nobody has been invited to a journey yet."}
              </li>
              <li>
                {data.jobs === null
                  ? "Scheduled jobs are not tracked on this database yet."
                  : data.jobs.length
                    ? `Scheduled jobs: ${data.jobs.join(" ")}`
                    : "Every scheduled job ran when it was due."}
              </li>
            </ul>
          </>
        )}
      </main>
    </>
  );
}
