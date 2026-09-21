import "server-only";
import { randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import {
  momentsFor, actionable, MOMENTS,
  type Lifecycle, type Mood, type MomentId, type MomentState,
  type MomentStatus, type RecordedMoment,
} from "@/lib/core/referral";

/**
 * Referral moments, read for one relationship and across all of them.
 *
 * The arithmetic is entirely in `lib/core/referral.ts`; this layer does two
 * things and no more. It assembles a `Lifecycle` from columns, and it records
 * a decision the agent has taken.
 *
 * WHAT IS NOT STORED IS THE POINT. Only decisions are written. Whether a
 * moment is DUE is derived on every read from the lifecycle and the clock, so
 * a relationship that closed six months ago starts surfacing its six-month ask
 * without anything having run, and nothing can go stale in the way a stored
 * queue goes stale — the failure where a cadence looks fine on screen because
 * the rows are all still there, and the job that writes them stopped in March.
 */

const MOMENT_IDS = new Set<string>(MOMENTS.map((m) => m.id));
const STATES = new Set<MomentState>(["waiting", "due", "sent", "acted", "declined", "held"]);

/**
 * The lead columns the engine needs, and nothing else.
 *
 * `client_token` is read as a boolean rather than carried: whether a plan is
 * published is the fact the engine wants, and the token itself is a capability
 * that has no business travelling into a referral calculation.
 */
export const LIFECYCLE_COLUMNS =
  "id,name,email,side,stage,closed_on,mood,mood_at,client_token,figure_id,referred_by" as const;

export interface Relationship {
  leadId: string;
  name: string | null;
  email: string | null;
  stage: string | null;
  life: Lifecycle;
  statuses: MomentStatus[];
  /** Due or held, strongest first, with the silent moment removed. */
  todo: MomentStatus[];
}

function lifecycleOf(row: Record<string, unknown>): Lifecycle {
  return {
    stage: (row.stage as string | null) ?? "",
    closedOn: (row.closed_on as string | null) ?? null,
    /* A recorded figure is the readout: it is what the assessment produced and
       what the person was shown. */
    readoutDelivered: row.figure_id != null,
    planPublished: row.client_token != null,
    mood: ((row.mood as string | null) ?? null) as Mood,
  };
}

const shapeRecorded = (r: Record<string, unknown>): RecordedMoment => ({
  momentId: r.moment_id as MomentId,
  occurrence: Number(r.occurrence ?? 0),
  state: r.state as MomentState,
});

/** Every moment for one relationship, decided and derived. */
export async function momentsForLead(
  leadId: string,
  now: Date = new Date(),
): Promise<DbResult<Relationship | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const lead = await boundedRead(
    db.from("rift_leads").select(LIFECYCLE_COLUMNS)
      .eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "the relationship",
  );
  if (!lead.ok) return lead;
  const row = ("data" in lead ? lead.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);

  const decided = await boundedRead(
    db.from("rift_referral_moments").select("moment_id,occurrence,state")
      .eq("lead_id", leadId).limit(200),
    "the referral decisions",
  );

  /* The moments render even if the decisions do not. Losing them means every
     moment reads as undecided, which overstates the work rather than hiding
     it — the safe direction for a list whose job is to be complete. */
  const recorded = decided.ok && "data" in decided
    ? (decided.data as Record<string, unknown>[]).map(shapeRecorded)
    : [];

  const life = lifecycleOf(row);
  const statuses = momentsFor(life, recorded, now);

  return done({
    leadId,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    stage: (row.stage as string | null) ?? null,
    life,
    statuses,
    todo: actionable(statuses),
  });
}

/**
 * Everything wanting a decision, across every live relationship.
 *
 * Bounded at 500 relationships, which is far beyond one agent's book and is
 * there so a runaway read cannot become the reason the Studio page does not
 * render. Archived leads are excluded; somebody filed away is not somebody to
 * ask for a review.
 */
export async function referralQueue(now: Date = new Date()): Promise<DbResult<Relationship[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const leads = await boundedRead(
    db.from("rift_leads").select(LIFECYCLE_COLUMNS)
      .eq("agent_id", agentId).is("archived_at", null).limit(500),
    "the relationships",
  );
  if (!leads.ok) return leads;
  const rows = ("data" in leads ? leads.data : []) as Record<string, unknown>[];
  if (rows.length === 0) return done([]);

  const decided = await boundedRead(
    db.from("rift_referral_moments").select("lead_id,moment_id,occurrence,state")
      .in("lead_id", rows.map((r) => r.id as string)).limit(2000),
    "the referral decisions",
  );
  const byLead = new Map<string, RecordedMoment[]>();
  if (decided.ok && "data" in decided) {
    for (const r of decided.data as Record<string, unknown>[]) {
      const key = r.lead_id as string;
      const list = byLead.get(key) ?? [];
      list.push(shapeRecorded(r));
      byLead.set(key, list);
    }
  }

  const out: Relationship[] = [];
  for (const row of rows) {
    const id = row.id as string;
    const life = lifecycleOf(row);
    const statuses = momentsFor(life, byLead.get(id) ?? [], now);
    const todo = actionable(statuses);
    if (todo.length === 0) continue;
    out.push({
      leadId: id,
      name: (row.name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      stage: (row.stage as string | null) ?? null,
      life, statuses, todo,
    });
  }

  /* Strongest single moment first, so the top of the list is the best thing
     available to do rather than the person who happens to have the most. */
  out.sort((a, b) => (b.todo[0]?.moment.strength ?? 0) - (a.todo[0]?.moment.strength ?? 0));
  return done(out);
}

/**
 * Record a decision about one moment.
 *
 * Upserted on `(lead_id, moment_id, occurrence)`, which the migration makes
 * unique, so a retried request produces one answer rather than two rows that
 * disagree and leave the reader to pick.
 */
export async function recordMoment(input: {
  leadId: string;
  momentId: MomentId;
  occurrence: number;
  state: MomentState;
  note?: string | null;
}): Promise<DbResult<null>> {
  if (!MOMENT_IDS.has(input.momentId)) return failed(`unknown moment: ${input.momentId}`);
  if (!STATES.has(input.state)) return failed(`unknown state: ${input.state}`);
  if (!Number.isInteger(input.occurrence) || input.occurrence < 0) {
    return failed("occurrence must be a whole number");
  }

  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const r = await boundedWrite(
    db.from("rift_referral_moments").upsert({
      agent_id: agentId,
      lead_id: input.leadId,
      moment_id: input.momentId,
      occurrence: input.occurrence,
      state: input.state,
      note: input.note?.trim() || null,
      decided_at: new Date().toISOString(),
    }, { onConflict: "lead_id,moment_id,occurrence" }),
    "the decision",
  );
  return r.ok ? done(null) : r;
}

/**
 * Record the private satisfaction check.
 *
 * The one write that decides whether anything public may ever be asked of this
 * person, so it takes only the three answers the gate understands and `null`
 * to un-ask. There is no path here that sets it to a default.
 */
export async function recordMood(leadId: string, mood: Mood): Promise<DbResult<null>> {
  if (mood !== null && mood !== "good" && mood !== "mixed" && mood !== "bad") {
    return failed(`not an answer to the check: ${String(mood)}`);
  }

  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const r = await boundedWrite(
    db.from("rift_leads")
      .update({ mood, mood_at: mood === null ? null : new Date().toISOString() })
      .eq("id", leadId).eq("agent_id", agentId),
    "the satisfaction check",
  );
  return r.ok ? done(null) : r;
}

/**
 * Record the closing date, which starts the post-closing cadence.
 *
 * Separate from the stage change on purpose: see the column comment in the
 * migration. A stage edit two years later must not move somebody's
 * anniversaries.
 */
export async function recordClosing(leadId: string, closedOn: string | null): Promise<DbResult<null>> {
  if (closedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(closedOn)) {
    return failed("a closing date must be a plain calendar date");
  }

  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const r = await boundedWrite(
    db.from("rift_leads").update({ closed_on: closedOn }).eq("id", leadId).eq("agent_id", agentId),
    "the closing date",
  );
  return r.ok ? done(null) : r;
}

/**
 * Who this relationship sent, and who sent them.
 *
 * D5.5 in docs/benchmark.md asks that a referred lead be linked to its
 * referrer and that the link be "visible and countable". Countable is the
 * operative word: this returns the count and the names, so advocacy can be
 * read off a screen rather than inferred.
 */
export interface ReferralLinks {
  referrer: { id: string; name: string | null } | null;
  sent: { id: string; name: string | null; stage: string | null }[];
}

/**
 * This person's own handle.
 *
 * The column has a database default, so every lead minted since the migration
 * already has one and this is a plain read. The write below is the safety net
 * for two cases that do exist: a row created while the deploy was ahead of the
 * migration, and anything the backfill missed.
 *
 * Twelve random bytes as hex. Not guessable, and it does not need to be — the
 * token authorises nothing. Somebody who guessed one could credit a referral
 * to a stranger, which is worth about as much as it sounds.
 */
export async function referralTokenFor(leadId: string): Promise<DbResult<string>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const read = await boundedRead(
    db.from("rift_leads").select("referral_token").eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "the referral handle",
  );
  if (!read.ok) return read as DbResult<string>;

  const existing = "data" in read
    ? (read.data as { referral_token: string | null } | null)?.referral_token ?? null
    : null;
  if (existing) return done(existing);

  const token = randomBytes(12).toString("hex");
  const wrote = await boundedWrite(
    db.from("rift_leads").update({ referral_token: token })
      .eq("id", leadId).eq("agent_id", agentId),
    "the referral handle",
  );
  if (!wrote.ok) return wrote as DbResult<string>;
  return done(token);
}

export async function referralLinks(leadId: string): Promise<DbResult<ReferralLinks>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const [mine, theirs] = await Promise.all([
    boundedRead(
      db.from("rift_leads").select("referred_by").eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
      "the referrer",
    ),
    boundedRead(
      db.from("rift_leads").select("id,name,stage").eq("referred_by", leadId).eq("agent_id", agentId).limit(100),
      "the people they sent",
    ),
  ]);

  const sent = theirs.ok && "data" in theirs
    ? (theirs.data as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        name: (r.name as string | null) ?? null,
        stage: (r.stage as string | null) ?? null,
      }))
    : [];

  const referrerId = mine.ok && "data" in mine
    ? ((mine.data as { referred_by: string | null } | null)?.referred_by ?? null)
    : null;

  let referrer: ReferralLinks["referrer"] = null;
  if (referrerId) {
    const r = await boundedRead(
      db.from("rift_leads").select("id,name").eq("id", referrerId).eq("agent_id", agentId).maybeSingle(),
      "the referrer",
    );
    const row = r.ok && "data" in r ? (r.data as { id: string; name: string | null } | null) : null;
    if (row) referrer = { id: row.id, name: row.name };
  }

  return done({ referrer, sent });
}
