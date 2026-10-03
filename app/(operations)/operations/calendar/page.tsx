import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { datedCommitments } from "@/lib/db/plan";
import { allContracts } from "@/lib/db/transactions";
import { buildAgenda, contractDateCommitments, summariseAgenda, agendaHeadline, type Commitment } from "@/lib/core/agenda";
import { showDay } from "@/lib/core/day";
import { relativeDay, spanOf } from "@/lib/core/when";
import { Unavailable } from "../Unavailable";
import { PageHead, Notice, Empty, Stat, Stats } from "../ui";
import { Tag } from "../_business/Tag";
import { say } from "../_business/say";
import s from "./calendar.module.css";

export const metadata: Metadata = { title: "What's coming" };
export const dynamic = "force-dynamic";

const HORIZON = 35;

/**
 * The next five weeks, across everybody.
 *
 * Today answers "what do I do now". This answers "what does the month look
 * like", which is the question an agent asks on a Sunday evening and which
 * nothing in the product could answer.
 *
 * It is a list, not a grid. A month view with twenty-two empty cells is a
 * picture of a calendar; an agent with four things in the next fortnight
 * should see four things, and the empty days counted in a sentence.
 *
 * It leads with what a CLIENT can see. "Three things are overdue" is a private
 * embarrassment; "two of them are on a page your client can open" is a
 * different fact, and the one that decides what the agent does first.
 *
 * Contract dates are on it, beside the promises: the dates with legal weight
 * were on Today and absent from the one page that shows a month.
 */
export default async function CalendarPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const now = new Date();
  const [read, contractsRead] = await Promise.all([datedCommitments(), allContracts(now)]);

  /* Either read failing makes the month incomplete, and "nothing is due" is
     the expensive thing for this page to say wrongly. */
  const failed = [read, contractsRead].flatMap((r) => (r.ok ? [] : [r.error]));
  const skipped = [read, contractsRead].flatMap((r) => (r.ok && "skipped" in r ? [r.reason] : []));
  const promises = read.ok && "data" in read ? read.data : [];
  const contracts = contractsRead.ok && "data" in contractsRead && contractsRead.data ? contractsRead.data : [];
  const items: Commitment[] = [...promises, ...contractDateCommitments(contracts)];
  const days = buildAgenda(items, now, HORIZON);
  const sum = summariseAgenda(days, HORIZON);
  const dates = items.filter((i) => i.kind === "date").length;

  const dayTitle = (date: string, away: number) =>
    away === 0 ? "Today" : away === 1 ? "Tomorrow" : showDay(date, { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="shell-w">
      <PageHead
        title="What’s coming"
        lede={failed.length || skipped.length ? "Some of this did not load, so what is below is not the whole month." : agendaHeadline(sum)}
      />

      {/* A read that failed must never render as a clear month. Of all the
          ways this page can be wrong, "you have nothing to do" is the
          expensive one. */}
      {failed.length ? (
        <Notice tone="neg" title="This is not an empty calendar">
          Dates could not be read, so nothing below is complete: {say(failed[0]!)}
        </Notice>
      ) : skipped.length ? (
        <Notice tone="warn" title="Nothing is being recorded">{say(skipped[0]!)} The calendar is empty because nothing is stored.</Notice>
      ) : null}

      {days.length ? (
        <Stats>
          <Stat label="Overdue" value={sum.overdue} tone={sum.overdue ? "neg" : undefined}
            hint={sum.overdue ? (sum.overdueAndVisible ? `${sum.overdueAndVisible} on a page a client can open` : "None visible to a client") : "Nothing is late"} />
          <Stat label="Due today" value={sum.today} hint={sum.today ? "On Today as well" : "Nothing due"} />
          <Stat label="This week" value={sum.thisWeek} hint="Today and the next seven days" />
          <Stat label="Contract dates" value={dates} hint="Overdue and coming, from open contracts" />
        </Stats>
      ) : null}

      {!days.length && !failed.length && !skipped.length ? (
        <Empty title="Nothing has a date on it"
          action={<Link href="/operations/clients" className="btn btn-s btn-sm">Find someone</Link>}>
          Dates come from three places: the one thing you owe somebody next, the steps on their plan, and the dates on an open contract. They are set on a person&rsquo;s record and on a contract.
        </Empty>
      ) : days.length ? (
        <>
          <div className={s.days} style={{ marginTop: 24 }}>
            {days.map((day) => (
              <section key={day.date} className={s.day} aria-label={dayTitle(day.date, day.daysAway)}>
                <div className={s.when}>
                  <div className={s.whenTitle}>{dayTitle(day.date, day.daysAway)}</div>
                  {day.daysAway >= 0 ? <div className={s.whenSub}>{day.daysAway <= 1 ? showDay(day.date, { weekday: "short", month: "short", day: "numeric" }) : relativeDay(day.daysAway)}</div> : null}
                  {day.daysAway < 0 ? <div className={s.whenTag}><Tag tone="neg">{spanOf(day.daysAway)} overdue</Tag></div> : null}
                </div>

                <div className={s.card}>
                  {day.items.map((item) => (
                    <Link key={item.id} href={item.href ?? `/operations/lead/${item.personId}`} className={s.item}>
                      <div style={{ minWidth: 0 }}>
                        <div className={s.what}>{item.what}</div>
                        <div className={s.who}>
                          {item.personName}
                          {item.kind === "date"
                            ? ` · ${item.address ?? "contract date"}${item.whenText ? ` · ${item.whenText}` : ""}`
                            : item.side ? ` · ${item.side === "buy" ? "buying" : "selling"}` : ""}
                          {item.kind === "step" && item.owner
                            ? ` · ${item.owner === "client" ? "waiting on them" : item.owner === "agent" ? "waiting on you" : `waiting on ${item.ownerName ?? "someone else"}`}`
                            : ""}
                        </div>
                      </div>

                      <div className={s.side}>
                        {item.kind === "date" ? <Tag tone={item.checked ? "none" : "warn"}>{item.checked ? "Contract date" : "Not checked yet"}</Tag> : null}
                        {/* The distinction the page is built around. */}
                        {item.visibleToThem ? (
                          <span title="On a page they can open"><Tag tone="info">They can see this</Tag></span>
                        ) : (
                          <Tag>Your note</Tag>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Counted rather than drawn. Twenty-two empty cells tell you
              nothing; one sentence tells you the month is open. */}
          {sum.clearDays > 0 ? (
            <p className={s.clear}>{sum.clearDays} of the next {HORIZON} days have nothing on them.</p>
          ) : null}
        </>
      ) : null}

      {/* Said plainly rather than left for the agent to discover by not seeing
          their appointments here. */}
      <div style={{ marginTop: 32 }}>
        <Notice tone="info" title="Booked calls are not here">
          Booking runs through Cal.com and this deployment has no key for it, so nothing in the product can see them yet. A calendar that quietly omitted half of them would be worse than one that says so.
        </Notice>
      </div>
    </main>
  );
}
