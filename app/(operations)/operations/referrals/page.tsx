import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { referralQueue, type Relationship } from "@/lib/db/referral";
import { momentTiming, serviceCheck } from "@/lib/core/referral";
import { inDays } from "@/lib/core/deadline";
import { daysUntil } from "@/lib/core/day";
import { PageHead, Section, Notice, Empty, Stats, Stat } from "../ui";
import { Tag } from "../_business/Tag";
import { MoodCheck, MomentRow } from "./Moment";
import s from "./moment.module.css";

export const metadata: Metadata = { title: "Advocacy" };
export const dynamic = "force-dynamic";

/** How many people the first screen holds. A queue is for working through, not for scrolling. */
const SHOWN = 8;

/**
 * The end of the loop, which is also the start of it.
 *
 * `docs/vision.md` puts this plainly: "The closing is a beginning. Every
 * closing must produce a review, a referral path, and a durable reason to
 * return."
 *
 * WHAT THIS SCREEN DOES NOT DO.
 *
 * It does not send anything. Every moment here is a prompt and a record, and
 * the words are Kaleb's. A product that fired a templated "would you leave me
 * a review" at somebody three days after handing them their keys would be
 * spending a relationship he earned to save him a minute.
 *
 * It also never lists the moment whose ask is to say nothing (`under_contract`),
 * and since the asks got windows it lists only moments that are open today:
 * somebody Kaleb has not picked up is not a relationship to ask from, and a
 * closing-day ask seven months late is not a closing-day ask. What is left is
 * short on purpose.
 */
export default async function ReferralsPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const now = new Date();
  const q = await referralQueue(now);

  /* Three outcomes, three different sentences. "It did not work", "there is
     nowhere to read from" and "there is genuinely nothing to do" are different
     facts about the world, and collapsing them into one empty state is how a
     product tells somebody their book is quiet when the database is down. */
  const failed = !q.ok ? q.error : null;
  const unavailable = q.ok && "skipped" in q ? q.reason : null;
  const people = q.ok && "data" in q ? q.data : [];

  const owed = people.filter((p) => serviceCheck(p.life.mood).followUp);
  const asking = people.filter((p) => p.todo.some((m) => m.state === "due"));
  const held = people.filter((p) => p.todo.some((m) => m.state === "held"));
  const closingSoon = asking.filter((p) => p.todo.some((m) => m.state === "due" && m.closesInDays !== null && m.closesInDays <= 3));

  return (
    <main className="shell-w">
      <PageHead
        title="Advocacy"
        lede="Who is worth asking for a review or an introduction today, and why now. Nothing here sends anything; the words are yours."
      />

      {failed ? (
        <Notice tone="neg" title="The queue did not load">
          {failed}. That is not the same as having nothing to do; we do not know either way.
        </Notice>
      ) : unavailable ? (
        <Notice tone="warn" title="Nothing to read from">{unavailable}.</Notice>
      ) : people.length === 0 ? (
        <Empty title="Nobody is worth asking today">
          An ask appears when something earns it: they got their numbers while you were working together, you closed
          with them, or thirty days, six months or a year have passed since. Each stays open for a couple of weeks,
          so an empty list means the timing is not right for anyone yet, not that there is nobody to ask.
        </Empty>
      ) : (
        <>
          <Stats>
            <Stat label="Follow up first" value={owed.length} tone={owed.length ? "warn" : undefined} hint="Owed a call, not an ask" />
            <Stat label="Ask now" value={asking.length} hint={asking.length === 1 ? "person with an open ask" : "people with an open ask"} />
            <Stat label="Closing within 3 days" value={closingSoon.length} tone={closingSoon.length ? "warn" : undefined} hint="Asks about to be lost" />
            <Stat label="Held back" value={held.length} hint="By you, until you say" />
          </Stats>

          {owed.length ? (
            <Section
              title="Follow up first"
              hint="They told you something is not right. Put it right before anyone asks them for anything. This never changes whether they are asked for a review: everyone is asked the same way."
            >
              <div className={s.stackGap}>
                {owed.map((p) => <Person key={p.leadId} p={p} now={now} followUp />)}
              </div>
            </Section>
          ) : null}

          {asking.length ? (
            <Section
              title="Ask now"
              hint="Strongest first, then the ask closing soonest. An ask drops off the list when its window passes."
            >
              <div className={s.stackGap}>
                {asking.slice(0, SHOWN).map((p) => <Person key={p.leadId} p={p} now={now} />)}
              </div>
              {asking.length > SHOWN ? (
                <details className={s.more}>
                  <summary>{asking.length - SHOWN} more {asking.length - SHOWN === 1 ? "person" : "people"}</summary>
                  <div className={s.stackGap}>
                    {asking.slice(SHOWN).map((p) => <Person key={p.leadId} p={p} now={now} />)}
                  </div>
                </details>
              ) : null}
            </Section>
          ) : (
            <Section title="Ask now">
              <Empty title="Nothing is open to ask today">
                The next one appears when a closing happens or one of the thirty-day, six-month or anniversary marks
                comes round.
              </Empty>
            </Section>
          )}

          {held.length ? (
            <Section title="Held back" hint="You chose to wait on these. They stay here until you record what happened.">
              <details className={s.more} style={{ marginTop: 0 }}>
                <summary>{held.length} {held.length === 1 ? "person" : "people"}</summary>
                <div className={s.stackGap}>
                  {held.map((p) => <Person key={p.leadId} p={p} now={now} heldOnly />)}
                </div>
              </details>
            </Section>
          ) : null}
        </>
      )}
    </main>
  );
}

function Person({ p, now, followUp, heldOnly }: { p: Relationship; now: Date; followUp?: boolean; heldOnly?: boolean }) {
  const name = (p.name ?? "").trim() || p.email || "No name on file";
  const check = serviceCheck(p.life.mood);
  const moments = p.todo.filter((m) => (heldOnly ? m.state === "held" : m.state === "due"));
  const closedAgo = p.life.closedOn ? inDays(daysUntil(p.life.closedOn, now)) : null;

  return (
    <article className={s.person}>
      <div className={s.personHead}>
        <Link href={`/operations/lead/${p.leadId}`} className={s.personName}>{name}</Link>
        {p.stage ? <Tag>{p.stage}</Tag> : null}
        {closedAgo ? <span className={s.personMeta}>Closed {closedAgo}</span> : null}
        {check.followUp ? <Tag tone={p.life.mood === "bad" ? "neg" : "warn"}>{check.label}</Tag> : null}
      </div>

      {/* The service check is drawn once somebody has closed or while a
          follow-up is owed. It raises follow-ups; it never decides who is
          asked for a review. Once answered well it is a quiet line, not a card. */}
      {p.life.mood === "good" && !followUp ? (
        <details className={`${s.check} ${s.checkQuiet}`}>
          <summary className={s.checkTitle} style={{ cursor: "pointer" }}>Private check: it went well</summary>
          <MoodCheck leadId={p.leadId} mood={p.life.mood} name={name} />
        </details>
      ) : followUp || p.life.closedOn ? <MoodCheck leadId={p.leadId} mood={p.life.mood} name={name} /> : null}

      {followUp ? null : moments.map((m) => {
        const t = momentTiming(m, now);
        return (
          <MomentRow
            key={`${m.moment.id}:${m.occurrence}`}
            leadId={p.leadId}
            momentId={m.moment.id}
            occurrence={m.occurrence}
            label={m.moment.label}
            ask={m.moment.ask}
            why={m.moment.why}
            state={m.state}
            blockedBecause={m.blockedBecause}
            review={m.moment.review}
            timing={t.timing}
            closing={t.closing}
          />
        );
      })}
    </article>
  );
}
