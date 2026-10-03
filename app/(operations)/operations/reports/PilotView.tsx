import Link from "next/link";
import { pilotReport, type PilotJourney } from "@/lib/db/pilot";
import { buyerSearchOn } from "@/lib/core/journey";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/core/progress";
import {
  ANSWER_LABEL, ASK_LABEL, DATES_CHECK_LABEL, SEARCH_CHECK_LABEL,
  durationText, promiseLine, replyStats, setupStats, timing, type CheckState,
} from "@/lib/core/pilot";
import { showDay, showTime } from "@/lib/core/day";
import { Notice, Empty, Section } from "../ui";
import { Tag, type TagTone } from "../_business/Tag";
import k from "../_business/kit.module.css";
import { say } from "../_business/say";
import s from "./reports.module.css";
import { Check } from "./Check";

const WHEN = (iso: string) => showTime(iso, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const DAY = (iso: string) => showDay(iso);

function checkLine(c: CheckState): { text: string; tone: "pos" | "warn" | "neg" } {
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

const CHECK_TAG: Record<"pos" | "warn" | "neg", { word: string; tone: TagTone }> = {
  pos: { word: "Checked", tone: "pos" },
  warn: { word: "Needs a check", tone: "warn" },
  neg: { word: "Differs", tone: "neg" },
};

/**
 * The pilot's evidence (W12): whether the same-business-day promise (D07) is
 * kept, how long searches take to set up, and whether Rift's record of each
 * buyer's search and dates still matches Matrix and the documents.
 *
 * Every figure is counted from what is recorded; nothing is estimated, and
 * nothing is compared with a time before Rift, because none was measured.
 * The page prints, so the report can be kept or handed on as a PDF.
 */
export async function PilotView({ now }: { now: Date }) {
  const on = buyerSearchOn(process.env);
  if (!on) return <Notice tone="info" title="Journeys are switched off on this deployment">RIFT_BUYER_SEARCH=off, so there is no pilot to report on.</Notice>;

  const report = await pilotReport(now);
  if (!report.ok) {
    return <Notice tone="neg" title="The pilot report did not load">{say(report.error)} This is not an empty report; it is one we could not read.</Notice>;
  }
  if ("skipped" in report) return <Notice tone="info" title="Nothing to read from">{report.reason}.</Notice>;
  const data = report.data;
  if (!data.journeys.length) {
    return (
      <Empty title="No buying journeys yet" action={<Link className="btn btn-g btn-sm" href="/operations/clients">Open Relationships</Link>}>
        The report fills in as pilot buyers are added. Start a journey from a buyer in Relationships.
      </Empty>
    );
  }

  const stats = replyStats(data.asks, now);
  const setup = setupStats(data.setup);
  const asked = stats.filter((x) => x.asked > 0);
  const quiet = stats.filter((x) => x.asked === 0);
  const owed = data.asks.filter((a) => ["waiting", "overdue"].includes(timing(a, now)));
  const current: PilotJourney[] = data.journeys.filter((j) => j.status === "active" || j.status === "paused");
  const members = data.journeys.reduce((m, j) => ({
    invited: m.invited + j.members.invited, accepted: m.accepted + j.members.accepted, withdrawn: m.withdrawn + j.members.withdrawn,
  }), { invited: 0, accepted: 0, withdrawn: 0 });

  return (
    <>
      {data.truncated ? <Notice tone="warn" title="Some records reached the report's reading limit">The counts below may be short.</Notice> : null}

      <Section
        title="Same-day replies"
        hint={`All time, from what is recorded. The pilot promises buyers a reply the same business day; anything asked on a weekend or holiday is due the next business day. ${promiseLine(stats)}`}
      >
        {owed.length ? (
          <Notice tone="warn" title={`${owed.length} still waiting on you`}>
            <ul className={s.kv}>
              {owed.map((a, i) => (
                <li key={i}>
                  <Link className={k.link} href={`/operations/journey/${a.journeyId}`}>{a.person}</Link>: {ASK_LABEL[a.kind].toLowerCase()}, asked {WHEN(a.askedAt)}
                  {timing(a, now) === "overdue" ? <> <Tag tone="neg">Past due</Tag></> : null}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {asked.length ? (
          <div className={k.tableCard} role="region" aria-label="Replies by kind" tabIndex={0}>
            <table className={`${k.table} ${k.stack}`}>
              <thead>
                <tr>
                  <th scope="col">What a buyer did</th><th scope="col" className="num">Asked</th><th scope="col" className="num">Same day</th>
                  <th scope="col" className="num">Later</th><th scope="col" className="num">Past due</th><th scope="col" className="num">Waiting, not late yet</th>
                  <th scope="col" className="num">Typical time to answer</th>
                </tr>
              </thead>
              <tbody>
                {asked.map((x) => (
                  <tr key={x.kind}>
                    <td data-label="What">
                      <span className={k.strong}>{ASK_LABEL[x.kind]}</span>
                      <div className={k.muted}>Answered by {ANSWER_LABEL[x.kind]}</div>
                    </td>
                    <td data-label="Asked" className="num">{x.asked}</td>
                    <td data-label="Same day" className="num">{x.sameDay}</td>
                    <td data-label="Later" className="num">{x.later}</td>
                    <td data-label="Past due" className={`num ${x.overdue ? "c-neg w6" : ""}`}>{x.overdue}</td>
                    <td data-label="Waiting" className="num">{x.waiting}</td>
                    <td data-label="Typical" className="num">{x.medianHours === null ? "None answered yet" : durationText(x.medianHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Nothing asked yet">A buyer&apos;s showing request, reported work or offer answer is counted here from the moment it is recorded.</Empty>}
        <div className={s.foot}>
          <p>Typical is the middle value of the answered ones.</p>
          {quiet.length && asked.length ? <p>Nothing yet: {quiet.map((x) => ASK_LABEL[x.kind].toLowerCase()).join("; ")}.</p> : null}
        </div>
      </Section>

      <Section title="Search setup" hint="All time.">
        {setup.recorded || setup.waiting || setup.dropped ? (
          <ul className={s.kv}>
            <li>
              {setup.recorded} approved {setup.recorded === 1 ? "search" : "searches"} recorded as set up in Matrix
              {setup.medianHours !== null ? `, typically ${durationText(setup.medianHours)} after approval` : ""}.
            </li>
            {setup.waiting ? <li>{setup.waiting} approved and not recorded in Matrix yet.</li> : null}
            {setup.dropped ? <li>{setup.dropped} replaced or cancelled before being recorded.</li> : null}
          </ul>
        ) : <Empty title="No search has been approved yet">The first one appears here once a buyer&apos;s priorities are approved.</Empty>}
      </Section>

      <Section
        title="Checked against Matrix and the documents"
        hint="Rift cannot see Matrix or the signed documents, so for each buyer you check that the search Rift shows is the one running in Matrix and that the dates are the ones in the contract. A check goes stale when either changes."
      >
        {data.unavailable ? <Notice tone="warn" title="Part of this is not available">{data.unavailable}</Notice> : null}
        {current.length === 0 ? (
          <Empty title="No active or paused buying journeys">Nothing to check until a buyer has one.</Empty>
        ) : (
          <div className={k.list}>
            {current.map((j) => {
              const line = checkLine(j.check);
              const tag = CHECK_TAG[line.tone];
              return (
                <div key={j.id} className={s.person}>
                  <div className={s.personTop}>
                    <span>
                      <Link className={s.personName} href={`/operations/journey/${j.id}`}>{j.person}</Link>
                      <span className={k.muted}> · {j.label}</span>
                    </span>
                    <span className="row gap-2">
                      <Tag>{STAGE_LABEL[j.stage]}{j.status === "paused" ? `, ${STATUS_LABEL.paused.toLowerCase()}` : ""}</Tag>
                      <Tag tone={tag.tone}>{tag.word}</Tag>
                    </span>
                  </div>
                  <ul className={s.steps}>
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
                  <p className={`${s.checkLine} ${s[line.tone]}`}>{line.text}</p>
                  {j.check.state === "differs" && j.check.check.note ? <p className={k.muted}>&ldquo;{j.check.check.note}&rdquo;</p> : null}
                  {data.unavailable ? null : (
                    <Check journeyId={j.id} has={j.has} stamp={`${j.id}:${j.check.state}:${"check" in j.check ? j.check.check.at : ""}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Sign-in and scheduled work" hint="All time.">
        <ul className={s.kv}>
          <li>
            {members.invited
              ? `${members.accepted} of ${members.invited} invited household members have signed in with their emailed link at least once.`
              : "Nobody has been invited to a journey yet."}
          </li>
          {data.jobs === null
            ? <li>Scheduled jobs are not tracked on this database yet.</li>
            : data.jobs.length
              ? data.jobs.map((j) => <li key={j}><Tag tone="warn">Scheduled job</Tag> {j}</li>)
              : <li>Every scheduled job ran when it was due.</li>}
        </ul>
      </Section>
    </>
  );
}
