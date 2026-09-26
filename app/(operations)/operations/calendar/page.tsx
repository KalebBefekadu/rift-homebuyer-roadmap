import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { datedCommitments } from "@/lib/db/plan";
import { rulesOrDefaults } from "@/lib/db/settings";
import { buildAgenda, summariseAgenda, agendaHeadline } from "@/lib/core/agenda";
import { Ico } from "@/components/rift/icons";
import { OpsNav } from "../OpsNav";
import { Unavailable } from "../Unavailable";

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
 * different fact, and the one that decides what he does first.
 */
export default async function CalendarPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const [read, rules] = await Promise.all([
    datedCommitments(),
    rulesOrDefaults(agent.agentId),
  ]);

  const items = read.ok && "data" in read ? read.data : [];
  const days = buildAgenda(items, new Date(), HORIZON);
  const s = summariseAgenda(days, HORIZON);

  return (
    <>
      <OpsNav agentName={agent.name} undecided={rules.undecided.length} />

      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 780 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>
          What&rsquo;s coming
        </h1>
        <p className="t-md c-2" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.6 }}>
          {agendaHeadline(s)}
        </p>

        {/* A read that failed must never render as a clear month. Of all the
            ways this page can be wrong, "you have nothing to do" is the
            expensive one. */}
        {!read.ok ? (
          <div className="card p-4" style={{ marginTop: 20, borderColor: "var(--neg, #b3261e)" }}>
            <div className="row gap-2"><Ico.alert size={15} className="c-neg" />
              <span className="t-sm w6">This is not an empty calendar.</span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 8 }}>
              The dates could not be read, so nothing below is complete: {read.error}
            </p>
          </div>
        ) : "skipped" in read ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">{read.reason}.</p>
          </div>
        ) : days.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">
              Nothing has a date on it. Dates come from the one thing you owe somebody next, and
              from the steps on their plan. Both are set on a person&rsquo;s record.
            </p>
            <Link href="/operations/clients" className="btn btn-p btn-sm" style={{ marginTop: 12 }}>
              Find someone
            </Link>
          </div>
        ) : (
          <>
            <div className="col gap-4" style={{ marginTop: 26 }}>
              {days.map((day) => (
                <section key={day.date}>
                  <div className="row gap-2" style={{ marginBottom: 9 }}>
                    <span className={`t-2xs w6 ${day.daysAway < 0 ? "c-neg" : day.daysAway === 0 ? "c-brand" : "c-4"}`}
                      style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
                      {day.label}
                    </span>
                    <span className="t-2xs c-4">{day.items.length}</span>
                  </div>

                  <div className="card" style={{ overflow: "hidden" }}>
                    {day.items.map((item, i) => (
                      <Link key={item.id} href={`/operations/lead/${item.personId}`}
                        className="between gap-3"
                        style={{
                          padding: "12px 16px", gap: 12, alignItems: "flex-start",
                          borderBottom: i === day.items.length - 1 ? 0 : "1px solid var(--line-3)",
                        }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t-sm w5" style={{ lineHeight: 1.45 }}>{item.what}</div>
                          <div className="t-xs c-4" style={{ marginTop: 3 }}>
                            {item.personName} · {item.side === "buy" ? "buying" : "selling"}
                            {item.kind === "step" && item.owner
                              ? ` · ${item.owner === "client" ? "waiting on them" : item.owner === "agent" ? "waiting on you" : `waiting on ${item.ownerName ?? "someone else"}`}`
                              : ""}
                          </div>
                        </div>

                        <div className="row gap-2" style={{ flex: "none" }}>
                          {/* The distinction the page is built around. */}
                          {item.visibleToThem ? (
                            <span className="chip chip-brand t-2xs" title="On a page they can open">
                              <Ico.share size={10} />They can see this
                            </span>
                          ) : (
                            <span className="chip t-2xs">Your note</span>
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
            {s.clearDays > 0 ? (
              <p className="t-xs c-4" style={{ marginTop: 24 }}>
                {s.clearDays} of the next {HORIZON} days have nothing on them.
              </p>
            ) : null}
          </>
        )}

        {/* Said plainly rather than left for him to discover by not seeing
            his appointments here. */}
        <p className="t-xs c-4" style={{ marginTop: 26, lineHeight: 1.6, maxWidth: 560 }}>
          Booked calls are not here. Booking runs through Cal.com and this deployment has no key
          for it, so nothing in the product can see them yet, and a calendar that quietly
          omitted half of them would be worse than one that says so.
        </p>
      </main>
    </>
  );
}
