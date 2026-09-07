import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { sequenceFor, resolveChannel, type Enrolment, type StopId } from "@/lib/core/nurture";
import { BUY_FUNNEL } from "@/lib/core/funnel";
import type { Band } from "@/lib/core/lead";

/**
 * The cadence, running.
 *
 * The engine in lib/core/nurture.ts decides WHAT is owed. This decides what has
 * actually been sent, and the difference is where every duplicate-send bug
 * lives. The guarantee is a unique constraint on (enrolment, step): a retry, a
 * double cron fire, or two workers racing cannot send the same email twice, and
 * no amount of application-level care can promise that.
 *
 * A reply stops the sequence immediately, not after the current step. Software
 * that keeps sending once somebody has answered proves there was never a person
 * on this end, and in a referral business that is unrecoverable.
 */

export async function enrol(leadId: string, band: Band, phoneConsent: boolean): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_enrolments")
      .upsert({ agent_id, lead_id: leadId, band, phone_consent: phoneConsent }, { onConflict: "lead_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) return failed(error.message);
    if (data) return done({ id: data.id as string });

    const { data: existing } = await db.from("rift_enrolments").select("id").eq("lead_id", leadId).maybeSingle();
    return existing ? done({ id: existing.id as string }) : failed("enrolment could not be created or found");
  } catch (e) {
    return failed(e);
  }
}

/** Any stop condition. Immediate — the queue is recomputed, not drained. */
export async function stop(leadId: string, reason: StopId): Promise<DbResult<{ stopped: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db
      .from("rift_enrolments")
      .update({ stopped_at: new Date().toISOString(), stop_reason: reason })
      .eq("lead_id", leadId)
      .is("stopped_at", null);
    if (error) return failed(error.message);
    return done({ stopped: true as const });
  } catch (e) {
    return failed(e);
  }
}

export interface DueTouch {
  enrolmentId: string;
  leadId: string;
  name: string;
  email: string | null;
  band: Band;
  stepId: string;
  says: string;
  gives: string;
  auto: boolean;
  channel: "email" | "text" | "call" | "task";
  downgraded: string | null;
  daysLate: number;
  /**
   * The figures this person was actually shown, and the link to them.
   *
   * Carried because a touch without them cannot be written. The runner used to
   * send zeroes — "Buying in your County takes $0 at the table" — which is
   * worse than sending nothing at all: it is a message that proves nobody is
   * paying attention, delivered to somebody deciding whether to trust us with
   * their finances.
   */
  figures: Record<string, string | number> | null;
  shareToken: string | null;
  county: string | null;
  /** How far they got, for the recovery touch. */
  answered: number;
  of: number;
  side: "buy" | "sell";
}

/**
 * What is owed right now.
 *
 * Computed from the sequence definition against what has been sent, rather than
 * stored as a schedule. A stored schedule goes stale the moment a sequence is
 * edited, and then somebody receives day-3 of a cadence that no longer exists.
 */
export async function due(now = new Date()): Promise<DbResult<DueTouch[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_enrolments")
      .select("id,lead_id,band,entered_at,phone_consent,rift_leads(name,email,assessment_id,side),rift_touches(step_id)")
      .eq("agent_id", agent_id)
      .is("stopped_at", null);
    if (error) return failed(error.message);

    const rows = (data ?? []) as unknown as {
      id: string; lead_id: string; band: Band; entered_at: string; phone_consent: boolean;
      rift_leads: { name: string | null; email: string | null; assessment_id: string | null; side: "buy" | "sell" } | null;
      rift_touches: { step_id: string }[];
    }[];

    /* One query for the whole queue rather than one per enrolment. */
    const assessmentIds = rows
      .map((r) => r.rift_leads?.assessment_id)
      .filter((x): x is string => Boolean(x));

    /* How many questions each person actually answered. The recovery touch is
       the only one that needs it, and it is the only touch that can reach the
       largest population in the funnel — so it is worth the query. */
    const progress = new Map<string, number>();
    if (assessmentIds.length) {
      const { data: ans } = await db
        .from("rift_answers")
        .select("assessment_id")
        .in("assessment_id", assessmentIds);
      for (const a of (ans ?? []) as { assessment_id: string }[]) {
        progress.set(a.assessment_id, (progress.get(a.assessment_id) ?? 0) + 1);
      }
    }

    const snap = new Map<string, { figures: Record<string, string | number>; token: string; county: string | null }>();
    if (assessmentIds.length) {
      const { data: reads } = await db
        .from("rift_readouts")
        .select("assessment_id,figures,share_token,created_at,rift_assessments(county)")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: false });
      for (const r of (reads ?? []) as unknown as {
        assessment_id: string; figures: Record<string, string | number>; share_token: string;
        rift_assessments: { county: string | null } | null;
      }[]) {
        if (!snap.has(r.assessment_id)) {
          snap.set(r.assessment_id, {
            figures: r.figures,
            token: r.share_token,
            county: r.rift_assessments?.county ?? null,
          });
        }
      }
    }

    const out: DueTouch[] = [];
    for (const row of rows) {
      const daysIn = Math.floor((now.getTime() - new Date(row.entered_at).getTime()) / 86_400_000);
      const sent = new Set(row.rift_touches?.map((t) => t.step_id) ?? []);

      const e: Enrolment = {
        leadId: row.lead_id,
        name: row.rift_leads?.name ?? row.rift_leads?.email ?? "Someone",
        band: row.band,
        daysIn,
        stopped: null,
        phoneConsent: row.phone_consent,
        done: [...sent],
      };

      const seq = sequenceFor(e.band);
      const pending = seq.steps.filter((s) => !sent.has(s.id) && s.day <= daysIn);
      if (!pending.length) continue;

      const step = pending[0];
      const { channel, downgraded } = resolveChannel(step, e.phoneConsent);
      const s = row.rift_leads?.assessment_id ? snap.get(row.rift_leads.assessment_id) : undefined;

      out.push({
        enrolmentId: row.id,
        leadId: row.lead_id,
        name: e.name,
        email: row.rift_leads?.email ?? null,
        band: e.band,
        stepId: step.id,
        says: step.says,
        gives: step.gives,
        auto: step.auto,
        channel,
        downgraded,
        daysLate: daysIn - step.day,
        figures: s?.figures ?? null,
        shareToken: s?.token ?? null,
        county: s?.county ?? null,
        answered: row.rift_leads?.assessment_id ? progress.get(row.rift_leads.assessment_id) ?? 0 : 0,
        /* The buyer funnel's length. Read from the definition rather than
           hard-coded, so editing the funnel cannot make this sentence lie. */
        of: BUY_FUNNEL.questions.filter((q) => q.enabled).length,
        side: row.rift_leads?.side ?? "buy",
      });
    }

    /* Most overdue first. A queue sorted by anything else is a to-do list. */
    return done(out.sort((a, b) => b.daysLate - a.daysLate));
  } catch (e) {
    return failed(e);
  }
}

/**
 * Records that a step went out.
 *
 * Written BEFORE the send, and treated as the lock. If the send then fails the
 * row is updated to `failed` and surfaces as an agent task — which is strictly
 * better than the reverse order, where a crash between sending and recording
 * sends the same message again on the next run.
 */
export async function claimStep(enrolmentId: string, stepId: string, channel: DueTouch["channel"], downgraded: string | null): Promise<DbResult<{ claimed: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db.from("rift_touches").insert({
      enrolment_id: enrolmentId, step_id: stepId, channel,
      downgraded_reason: downgraded, outcome: "sent",
    });
    if (error) {
      /* A unique violation means somebody else already claimed it. That is the
         constraint doing its job, not a failure. */
      if (error.code === "23505") return done({ claimed: false });
      return failed(error.message);
    }
    return done({ claimed: true });
  } catch (e) {
    return failed(e);
  }
}

export async function markTouch(enrolmentId: string, stepId: string, outcome: "sent" | "skipped" | "failed", detail?: string) {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db
      .from("rift_touches")
      .update({ outcome, detail: detail ?? null })
      .eq("enrolment_id", enrolmentId)
      .eq("step_id", stepId);
    if (error) return failed(error.message);
    return done({ ok: true });
  } catch (e) {
    return failed(e);
  }
}
