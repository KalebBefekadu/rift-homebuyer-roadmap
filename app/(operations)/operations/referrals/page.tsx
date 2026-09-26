import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { OpsNav } from "../OpsNav";
import { referralQueue } from "@/lib/db/referral";
import { serviceCheck } from "@/lib/core/referral";
import { Ico } from "@/components/rift/icons";
import { MoodCheck, MomentRow } from "./Moment";

export const metadata: Metadata = { title: "Advocacy" };
export const dynamic = "force-dynamic";

/**
 * The end of the loop, which is also the start of it.
 *
 * `docs/vision.md` puts this plainly: "The closing is a beginning. Every
 * closing must produce a review, a referral path, and a durable reason to
 * return. A closing that produces none of those is a failed closing,
 * regardless of the commission." `docs/benchmark.md` weights it at 15 out of
 * 100 and the shipped product scored approximately nothing, because the engine
 * that describes all of it had no database behind it and no screen in front.
 *
 * WHAT THIS SCREEN DOES NOT DO.
 *
 * It does not send anything. Every moment here is a prompt and a record, and
 * the words are Kaleb's. A product that fired a templated "would you leave me
 * a review" at somebody three days after handing them their keys would be
 * spending a relationship he earned to save him a minute, and the one thing
 * that makes any of these asks land is that they read like a person wrote
 * them, because a person did.
 *
 * It also never lists the moment whose ask is to say nothing. `under_contract`
 * is a real moment with a real trigger and its instruction is "Nothing. Say
 * congratulations and go quiet": thirty days of anxiety is not a window to
 * ask for anything. Putting it in a queue of work would invite exactly the
 * contact it exists to prevent, so `actionable()` drops it and the client
 * record still shows it, so the restraint reads as deliberate.
 */
export default async function ReferralsPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const q = await referralQueue();

  /* Three outcomes, three different sentences. "It did not work", "there is
     nowhere to read from" and "there is genuinely nothing to do" are different
     facts about the world, and collapsing them into one empty state is how a
     product tells somebody their book is quiet when the database is down. */
  const failed = !q.ok ? q.error : null;
  const unavailable = q.ok && "skipped" in q ? q.reason : null;
  const people = q.ok && "data" in q ? q.data : [];

  return (
    <>
      <OpsNav agentName={agent.name} />

      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 780 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>
          Advocacy
        </h1>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          Eight moments where an ask is reasonable, and the reason each one is reasonable
          then rather than a week either side. Nothing here sends anything. The words are
          yours.
        </p>

        {failed ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-neg" style={{ flex: "none", marginTop: 2 }} />
              <div>
                <div className="t-sm w6">This did not load.</div>
                <p className="t-xs c-3" style={{ marginTop: 4 }}>{failed}.</p>
                <p className="t-xs c-4" style={{ marginTop: 6 }}>
                  That is not the same as having nothing to do; we do not know either way.
                </p>
              </div>
            </div>
          </div>
        ) : unavailable ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
              <div>
                <div className="t-sm w6">Nothing to read from.</div>
                <p className="t-xs c-3" style={{ marginTop: 4 }}>{unavailable}.</p>
              </div>
            </div>
          </div>
        ) : people.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="t-sm w6">Nothing is due.</div>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              Moments arrive on their own: when a plan is published, when somebody closes,
              thirty days after that, six months after that, and every year on the date.
              An empty list here means the timing is not right for anyone yet, not that
              there is nobody to ask.
            </p>
          </div>
        ) : (
          <div className="col gap-4" style={{ marginTop: 22 }}>
            {people.map((p) => {
              const name = (p.name ?? "").trim() || "This person";
              const check = serviceCheck(p.life.mood);
              return (
                <section key={p.leadId} className="col gap-2">
                  <div className="between wrap gap-2">
                    <div className="row gap-2 wrap">
                      <Link href={`/operations/lead/${p.leadId}`} className="t-md w6">{name}</Link>
                      {p.stage ? <span className="chip">{p.stage}</span> : null}
                      {p.life.closedOn ? <span className="chip chip-pos">Closed {p.life.closedOn}</span> : null}
                      {check.followUp ? <span className="chip chip-warn">{check.label}</span> : null}
                    </div>
                    <span className="t-xs c-4">
                      {p.todo.length} {p.todo.length === 1 ? "moment" : "moments"}
                    </span>
                  </div>

                  {/* The service check is drawn once somebody has closed, or
                      while a follow-up is owed. It raises follow-ups; it never
                      decides who is asked for a review. */}
                  {p.life.closedOn || check.followUp ? (
                    <MoodCheck leadId={p.leadId} mood={p.life.mood} name={name} />
                  ) : null}

                  {p.todo.map((s) => (
                    <MomentRow
                      key={`${s.moment.id}:${s.occurrence}`}
                      leadId={p.leadId}
                      momentId={s.moment.id}
                      occurrence={s.occurrence}
                      label={s.moment.label}
                      ask={s.moment.ask}
                      why={s.moment.why}
                      state={s.state}
                      blockedBecause={s.blockedBecause}
                      review={s.moment.review}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
