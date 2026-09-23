import "server-only";
import { journeyTablesMissing } from "./journeys";
import { captureOpError } from "@/lib/monitoring/capture";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { RETENTION } from "@/lib/core/privacy";
import { markAbandoned } from "./recovery";
import { boundedWrite, boundedRead } from "./bounded";

/**
 * Enforcing the retention schedule.
 *
 * `RETENTION` in lib/core/privacy.ts is rendered to every visitor at the bottom
 * of their readout. It is a promise, and a promise with no job behind it is a
 * paragraph. This is the job.
 *
 * Deletion here means DELETION. Not a flag, not an anonymised row, not an
 * archive table: the specification says so in the customer's own words
 * ("Deleted outright: not anonymised, not archived") and a soft delete would
 * make that sentence false while looking like compliance.
 *
 * The one period this cannot decide is the client record's. It has a legal
 * floor set by Georgia licence law and the brokerage, so it is a business rule
 * with a stated owner, and this job refuses to touch client records until
 * somebody has actually chosen the number.
 */

/** Kept in one place so the job and the promise cannot drift. */
export const WINDOWS = {
  /** An assessment nobody came back to. */
  unconverted: { days: 18 * 30, rule: "unconverted" },
  /** A part-finished assessment with no contact details. */
  abandoned: { days: 30, rule: "abandoned" },
  /** Funnel measurement: question ids and dwell, never answers. */
  analytics: { days: 24 * 30, rule: "analytics" },
} as const;

export interface SweepResult {
  assessments: number;
  answers: number;
  events: number;
  attributions: number;
  /** People, deleted deliberately rather than by cascade. */
  leads: number;
  /** Marked abandoned rather than deleted: still recoverable. */
  marked: number;
  /** Anything the job deliberately did not touch, and why. */
  held: string[];
}

export async function sweep(now = new Date()): Promise<DbResult<SweepResult>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured, so nothing was deleted");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const held: string[] = [];

  try {
    /* Mark, before deleting anything.
       
       An assessment quiet for a day is abandoned; one quiet for a month with no
       contact details is deleted. Marking is not deletion and must not become
       it: an abandonment deleted immediately destroys the recovery
       opportunity, and one never marked leaves the agent staring at a queue
       that never empties. */
    const { data: quiet } = await db
      .from("rift_assessments")
      .select("id")
      .eq("agent_id", agent_id)
      .is("completed_at", null)
      .is("abandoned_at", null)
      .lte("started_at", ago(1));

    let marked = 0;
    for (const q of ((quiet ?? []) as { id: string }[])) {
      const r = await markAbandoned(q.id);
      if (r.ok && !("skipped" in r)) marked += 1;
    }

    /* Abandoned, no contact details. The strictest window, and deliberately so:
       this is the most sensitive data in the product: a stranger's finances,
       with no relationship attached and no way to ask them about it. */
    const { data: orphans, error: orphanErr } = await db
      .from("rift_assessments")
      .select("id,rift_leads(id)")
      .eq("agent_id", agent_id)
      .is("completed_at", null)
      .lte("started_at", ago(WINDOWS.abandoned.days));
    if (orphanErr) return failed(orphanErr.message);

    const orphanIds = ((orphans ?? []) as unknown as { id: string; rift_leads: { id: string }[] }[])
      .filter((a) => !a.rift_leads?.length)
      .map((a) => a.id);

    /* Completed but never converted. Kept far longer, because a buyer who
       answered "9 to 18 months" is still inside their own stated timeline:
       deleting at ninety days would throw away the person the product exists
       for. */
    const { data: cold, error: coldErr } = await db
      .from("rift_assessments")
      .select("id")
      .eq("agent_id", agent_id)
      .not("completed_at", "is", null)
      .lte("started_at", ago(WINDOWS.unconverted.days));
    if (coldErr) return failed(coldErr.message);

    const coldIds = ((cold ?? []) as { id: string }[]).map((c) => c.id);
    const doomed = [...new Set([...orphanIds, ...coldIds])];

    let answers = 0;
    if (doomed.length) {
      const { count } = await db
        .from("rift_answers")
        .select("*", { count: "exact", head: true })
        .in("assessment_id", doomed);
      answers = count ?? 0;

      /* Answers cascade from the assessment, so one delete is enough, and one
         delete is safer than two, because a partial sweep that removed the
         assessment and left the answers would leave orphaned finances behind. */
      const { error } = await db.from("rift_assessments").delete().in("id", doomed);
      if (error) return failed(error.message);
    }

    /* Telemetry, on its own clock. Separate from answers on purpose: the two
       have different lifetimes precisely because they are different kinds of
       record, and a single sweep window would quietly merge them. */
    const { count: evCount } = await db
      .from("rift_events")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent_id)
      .lte("at", ago(WINDOWS.analytics.days));
    const { error: evErr } = await db
      .from("rift_events").delete().eq("agent_id", agent_id).lte("at", ago(WINDOWS.analytics.days));
    if (evErr) return failed(evErr.message);

    /* Attribution follows analytics: it is the same kind of record about the
       same visit, and keeping it after the events it explains would leave a
       channel history for a person whose visit has been forgotten. */
    const { count: atCount } = await db
      .from("rift_attributions")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agent_id)
      .lte("first_at", ago(WINDOWS.analytics.days));
    const { error: atErr } = await db
      .from("rift_attributions").delete().eq("agent_id", agent_id).lte("first_at", ago(WINDOWS.analytics.days));
    if (atErr) return failed(atErr.message);

    /* Leads, deliberately.
       
       They used to disappear as a cascade from the assessment: the person,
       their score, their enrolment and every touch already sent, removed as a
       side effect of a foreign key default that the retention policy never
       described. That is now SET NULL, so this is the only place a person is
       deleted and it has to say so.
       
       Only leads with no reply and no live sequence: somebody the agent has
       spoken to, or is still following up, is a relationship rather than an
       expired record, whatever its age. */
    const { data: coldLeads } = await db
      .from("rift_leads")
      .select("id,rift_enrolments(stopped_at)")
      .eq("agent_id", agent_id)
      .is("human_replied_at", null)
      .lte("created_at", ago(WINDOWS.unconverted.days));

    const quietLeads = ((coldLeads ?? []) as unknown as {
      id: string; rift_enrolments: { stopped_at: string | null }[];
    }[])
      .filter((l) => !l.rift_enrolments?.some((e) => e.stopped_at === null))
      .map((l) => l.id);

    /* A lead with a journey is being worked, whatever its reply column says:
       the agent started a buying or selling goal on it. The database refuses
       to delete it anyway (rift_journeys.origin_lead_id is RESTRICT), and one
       refused row would fail the whole sweep, so it is left out here and
       said so below. A missing table (a deploy ahead of its migration) means
       no journeys exist. */
    let working = new Set<string>();
    if (quietLeads.length) {
      const { data: j, error: jErr } = await db
        .from("rift_journeys").select("origin_lead_id").eq("agent_id", agent_id).in("origin_lead_id", quietLeads);
      if (jErr && !journeyTablesMissing(jErr.message)) return failed(jErr.message);
      working = new Set(((j ?? []) as { origin_lead_id: string }[]).map((r) => r.origin_lead_id));
    }
    const deletableLeads = quietLeads.filter((id) => !working.has(id));

    if (deletableLeads.length) {
      const { error } = await db.from("rift_leads").delete().in("id", deletableLeads);
      if (error) return failed(error.message);
    }

    held.push(
      "Leads with a recorded reply, a live sequence or a journey are untouched. Those are relationships, not expired records.",
      "Client records are untouched. The period has a legal floor and is the broker's to set.",
      "Consent records are untouched. They outlive the relationship because they are what proves the contact was lawful.",
    );

    return done({
      assessments: doomed.length,
      answers,
      leads: deletableLeads.length,
      events: evCount ?? 0,
      attributions: atCount ?? 0,
      marked,
      held,
    });
  } catch (e) {
    return failed(e);
  }
}

/**
 * A person asking to be forgotten, now, without waiting for a schedule.
 *
 * "Delete all of it" from the readout means this.
 *
 * This used to say it was "the same deletion the sweep performs, triggered by
 * the person rather than by time", and that was true on the day it was
 * written: rift_leads.assessment_id cascaded, so removing the assessment took
 * the lead with it. 20260908000000 changed the cascade to SET NULL: for a
 * good reason, because the retention sweep was destroying relationships the
 * agent was still working, and updated the sweep to delete leads explicitly.
 *
 * It did not update this function, which shares the mechanism. From that
 * migration onward, clicking "Delete all of it" removed the assessment, the
 * events and the attribution, and left the person's NAME, EMAIL, PHONE and
 * CONSENT RECORD in place, while the page said: "Deleted. Nothing about this
 * visit is left on this device or on our side."
 *
 * Nothing threw. The endpoint returned ok. The docblock above described the
 * behaviour the code had lost, which is the only reason it read as correct.
 *
 * Three rules now, and they are worth stating because they are judgement
 * rather than mechanism:
 *
 *   * The LEAD goes. A person who asks to be erased is not a relationship the
 *     agent gets to keep on the grounds that he might want it.
 *   * The CONSENT RECORD goes with them. The sweep deliberately keeps consent
 *     records, because they are the evidence that contact was lawful, but
 *     that argument only holds while there is somebody for them to be evidence
 *     about. Keeping proof of permission to email an address you have just
 *     destroyed is retention with no purpose left in it.
 *   * A reply or a live sequence does NOT protect a row here, unlike in the
 *     sweep. There the question is "has this expired"; here the person has
 *     asked, and "we were in the middle of something" is not an answer to that.
 */
export async function forget(sessionId: string): Promise<DbResult<{ deleted: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    /* Bounded, because a person waiting on "delete all of it" is entitled to
       an answer. A hang here reads as the request being ignored, which is the
       worst possible impression to leave on this particular button. */
    const read = await boundedRead(
      db.from("rift_assessments").select("id").eq("agent_id", agent_id).eq("session_id", sessionId),
      "the deletion lookup",
    );
    if (!read.ok) return read;
    const ids = (("data" in read ? read.data : []) as { id: string }[]).map((r) => r.id);

    /* Leads FIRST, and the order is the whole point.
       
       rift_leads.assessment_id is SET NULL on delete, so removing the
       assessments before collecting the leads that point at them severs the
       only link between the two and leaves the person permanently
       unfindable: deleted from their own point of view, present in the
       table. Two queries: the leads that came from these assessments, and
       the leads that carry this session directly, which is the only handle a
       capture with no assessment behind it has ever had. */
    const byAssessment = ids.length
      ? await boundedRead(
          db.from("rift_leads").select("id").eq("agent_id", agent_id).in("assessment_id", ids),
          "the lead lookup",
        )
      : null;
    if (byAssessment && !byAssessment.ok) return byAssessment;

    /* `session_id` on rift_leads arrived with 20260920020000, which is run by
       hand. If this deploys first, asking for the column returns an error:
       and failing the whole request would leave the person with a delete
       button that does nothing at all, which is strictly worse than the
       partial erasure this is fixing. So a missing column degrades to "no
       leads found by session", the assessment-side deletion below still runs,
       and the gap is reported rather than swallowed. */
    const bySession = await boundedRead(
      db.from("rift_leads").select("id").eq("agent_id", agent_id).eq("session_id", sessionId),
      "the lead lookup",
    );
    if (!bySession.ok) {
      if (!/session_id/.test(bySession.error)) return bySession;
      captureOpError(new Error(bySession.error), {
        op: "retention.forget.noSessionColumn",
        extra: { migration: "20260920020000_rift_forget_reaches_the_lead" },
      });
    }

    const rows = (r: { ok: boolean } | null) =>
      r && "data" in r ? (((r as { data?: { id: string }[] }).data ?? [])).map((x) => x.id) : [];
    const leadIds = [...new Set([...rows(byAssessment), ...rows(bySession)])];

    if (leadIds.length) {
      /* Journeys FIRST. A journey refuses to let its lead be deleted
         (origin_lead_id is RESTRICT, so a future transaction file is never
         removed as a side effect), which is right for everything except a
         person asking to be forgotten. Their journeys today hold a search
         brief, invitations and a shortlist, no transaction record, so they
         go too, and everything under them cascades from the journey. When
         transaction records exist this is where the broker's hold rule
         belongs (first-migration-proposal, "deletion compatibility"). */
      const journeys = await boundedWrite(
        db.from("rift_journeys").delete().eq("agent_id", agent_id).in("origin_lead_id", leadIds),
        "their journeys");
      if (!journeys.ok && !journeyTablesMissing(journeys.error)) return journeys;

      /* rift_enrolments cascades from the lead, so the sequence stops by
         construction rather than by remembering to stop it. */
      const gone = await boundedWrite(
        db.from("rift_leads").delete().in("id", leadIds), "the lead deletion");
      if (!gone.ok) return gone;
    }

    if (ids.length) {
      const deleted = await boundedWrite(
        db.from("rift_assessments").delete().in("id", ids), "the deletion");
      if (!deleted.ok) return deleted;
    }

    /* Consent, by both handles, for the same reason as the lead. */
    if (ids.length) {
      await boundedWrite(
        db.from("rift_consents").delete().eq("agent_id", agent_id).in("assessment_id", ids),
        "the consent record");
    }
    await boundedWrite(
      db.from("rift_consents").delete().eq("agent_id", agent_id).eq("session_id", sessionId),
      "the consent record");

    await boundedWrite(
      db.from("rift_events").delete().eq("agent_id", agent_id).eq("session_id", sessionId), "the events");
    await boundedWrite(
      db.from("rift_attributions").delete().eq("session_id", sessionId), "the attribution");

    /* The retention promise names five categories. Four are cleared here; the
       client record is the one that is not ours to discard, and the privacy
       page says so in those words rather than quietly excluding it. */
    void RETENTION;
    /* Counts the person, not the paperwork. "deleted: 0" on a session that
       had a lead and no assessment was the old answer, and the route turns
       that into "nothing was stored on our side to remove". */
    return done({ deleted: ids.length + leadIds.length });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Is anything still here that should already be gone?
 *
 * This exists because `/api/health` used to answer "is the retention job
 * working?" with "is CRON_SECRET set?": and those turned out to be different
 * questions in the worst possible way. The secret was set, the check was
 * green, and the job had never run once because the route did not accept the
 * verb the scheduler sends.
 *
 * So this checks the outcome instead of the plumbing. If the sweep is running,
 * nothing is ever meaningfully past its date; if it stops for any reason:
 * a wrong verb, a revoked key, a scheduler someone disabled: this goes red on
 * its own, without anybody having predicted the specific way it would break.
 *
 * It answers yes or no and never a count. Health is public, and "how many
 * people are in this funnel" is not a number a public endpoint should hand to
 * whoever asks.
 */
export async function overdue(now = new Date()): Promise<DbResult<{ overdue: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  /* A day of slack on every window. A sweep that runs at 3am is briefly, and
     correctly, behind a record that aged out at midnight, and a health check
     that goes red every night between midnight and three is a health check
     people learn to ignore. */
  const grace = 1;

  try {
    /* The strictest window first, and the only one that needs a join: a
       part-finished assessment with nobody attached to it. That is the most
       sensitive data in the product: a stranger's finances with no
       relationship and no way to ask them about it, and it is the window that
       would go red soonest if the sweep stopped. Checked separately because a
       lead attached to it means it is not an orphan and its clock is a
       different one. */
    const orphans = await boundedRead(
      db.from("rift_assessments").select("id,rift_leads(id)")
        .eq("agent_id", agent_id).is("completed_at", null)
        .lte("started_at", ago(WINDOWS.abandoned.days + grace)).limit(20),
      "the abandoned retention check",
    );
    if (!orphans.ok) return orphans;
    const rows = ("data" in orphans ? orphans.data : []) as unknown as
      { id: string; rift_leads: { id: string }[] }[];
    if (rows.some((a) => !a.rift_leads?.length)) return done({ overdue: true });

    /* Sequential with an early exit, not Promise.all. One row anywhere is the
       whole answer, so running all three concurrently buys nothing and pays
       for every query every time, and the last of them is the only one
       without an index behind it. Cheapest and most likely to trip first. */
    const events = await boundedRead(
      db.from("rift_events").select("id")
        .eq("agent_id", agent_id).lte("at", ago(WINDOWS.analytics.days + grace)).limit(1),
      "the analytics retention check",
    );
    if (!events.ok) return events;
    if ((("data" in events ? events.data : []) as unknown[]).length) return done({ overdue: true });

    const cold = await boundedRead(
      db.from("rift_assessments").select("id")
        .eq("agent_id", agent_id).not("completed_at", "is", null)
        .lte("started_at", ago(WINDOWS.unconverted.days + grace)).limit(1),
      "the unconverted retention check",
    );
    if (!cold.ok) return cold;
    if ((("data" in cold ? cold.data : []) as unknown[]).length) return done({ overdue: true });

    const attributions = await boundedRead(
      db.from("rift_attributions").select("session_id")
        .eq("agent_id", agent_id).lte("first_at", ago(WINDOWS.analytics.days + grace)).limit(1),
      "the attribution retention check",
    );
    if (!attributions.ok) return attributions;
    if ((("data" in attributions ? attributions.data : []) as unknown[]).length) {
      return done({ overdue: true });
    }

    return done({ overdue: false });
  } catch (e) {
    return failed(e);
  }
}
