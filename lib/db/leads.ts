import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { scoreLead, type LeadInput, type LeadScore } from "@/lib/core/lead";
import { captureOpError } from "@/lib/monitoring/capture";
import { withTimeout, WRITE_DEADLINE_MS } from "@/lib/core/timeout";
import { CONSENT_VERSION } from "@/lib/core/privacy";
import { enrol } from "./nurture";
import { currentVersionId } from "./funnel";

/**
 * Capture, consent, and lead scoring.
 *
 * Two rules from the specification are load-bearing here and both are easy to
 * lose in a hurry:
 *
 * THE SCORE'S ARITHMETIC IS STORED, not just its total. An agent who cannot see
 * why a lead ranks where it does stops trusting the ranking inside a week, and
 * a ranking nobody trusts is worse than none — it still costs attention.
 *
 * CONSENT STORES ITS OWN WORDING. Not a reference to a version, the actual
 * text. Wording changes; what somebody agreed to does not, and the only reason
 * to keep the record at all is to be able to show what they saw.
 */

export interface CaptureInput {
  /**
   * Null when the lead did not come from an assessment — somebody asking for
   * a readout they were sent, or booking straight from the landing page. An
   * empty string here used to reach Postgres as an invalid uuid and fail the
   * whole capture, losing the lead at the single most valuable moment in the
   * funnel: a stranger volunteering their address.
   */
  assessmentId: string | null;
  side: "buy" | "sell";
  name?: string;
  email?: string;
  phone?: string;
  /** Present only when a phone number is. */
  phoneConsent?: { granted: boolean; wording: string };
  emailConsentWording?: string;
  lead: LeadInput;
  ip?: string;
  userAgent?: string;
}

export async function captureLead(input: CaptureInput): Promise<DbResult<{ id: string; score: LeadScore }>> {
  /* Scoring is pure and happens regardless of the database, so the caller can
     always act on the result even when nothing is being stored. */
  const score = scoreLead(input.lead);

  const db = serviceClient();
  if (!db) return skipped("no database configured — the lead was scored but not stored");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  /* A phone number without written consent is not stored at all. Holding a
     number you may not lawfully call is pure liability: it cannot be used, and
     it still has to be disclosed and deleted. */
  const phone = input.phone && input.phoneConsent?.granted ? input.phone : null;

  try {
    /* Bounded: the visitor is watching a button spin. A capture that cannot
       finish in six seconds will not finish, and telling them so is better
       than holding the page — the readout they came for is already theirs. */
    const insert = Promise.resolve(
      db
      .from("rift_leads")
      .insert({
        agent_id,
        assessment_id: input.assessmentId || null,
        side: input.side,
        name: input.name ?? null,
        email: input.email ?? null,
        phone,
        score: score.score,
        band: score.band,
        signals: score.signals as never,
        /* The same pin as the assessment. A lead outlives the assessment row
           under some retention rules, so it carries its own. */
        funnel_version_id: await currentVersionId(input.side),
        /* Kept so the score can be recomputed as recency decays. Without it a
           three-week-old lead keeps the urgency it earned on the day. */
        lead_input: input.lead as never,
      })
      .select("id")
      .single(),
    );
    const { value: created, timedOut } = await withTimeout(insert, WRITE_DEADLINE_MS, null);
    if (timedOut) return failed("the lead did not save in time");
    const { data, error } = created!;
    if (error) return failed(error.message);

    const consents: Record<string, unknown>[] = [];
    if (input.email && input.emailConsentWording) {
      consents.push({
        agent_id, assessment_id: input.assessmentId || null, kind: "email",
        wording: input.emailConsentWording, version: CONSENT_VERSION, granted: true,
        ip: input.ip ?? null, user_agent: input.userAgent ?? null,
      });
    }
    if (input.phone && input.phoneConsent) {
      /* Recorded whether granted or refused. A refusal is evidence too — it is
         what proves the number was never called. */
      consents.push({
        agent_id, assessment_id: input.assessmentId || null, kind: "phone",
        wording: input.phoneConsent.wording, version: CONSENT_VERSION,
        granted: input.phoneConsent.granted,
        ip: input.ip ?? null, user_agent: input.userAgent ?? null,
      });
    }
    if (consents.length) {
      const { error: cErr } = await db.from("rift_consents").insert(consents as never[]);
      /* A lead saved without its consent record is a lead nobody may contact.
         Fail loudly rather than keep a row that cannot lawfully be used. */
      if (cErr) return failed(`lead stored but consent was not: ${cErr.message}`);
    }

    /* Enrolled the moment they are captured. A lead that is scored, stored and
       then never followed up is the failure this whole cadence exists to
       prevent, and leaving enrolment to a separate step means it is the step
       that gets forgotten. Failure to enrol does not fail the capture — the
       relationship is more important than the sequence. */
    const enrolled = await enrol(data.id as string, score.band, Boolean(phone));
    if (!enrolled.ok) {
      captureOpError(new Error(enrolled.error), { op: "lead.enrol", extra: { band: score.band } });
    }

    return done({ id: data.id as string, score });
  } catch (e) {
    return failed(e);
  }
}

/**
 * The score as it stands now, not as it stood at capture.
 *
 * Recency is one of the six signals and it decays. Recomputing on read is what
 * keeps "call today" meaning today — and `capturedScore` is kept beside it,
 * because the gap between what a lead was worth on arrival and what it is
 * worth now is exactly the thing an agent should be able to see.
 *
 * Falls back to the stored values for leads captured before the inputs were
 * kept. They will read as slightly too urgent until they age out, which is a
 * better failure than refusing to rank them at all.
 */
function rescore(
  input: LeadInput | null,
  createdAt: string,
  stored: { score: number; band: string; signals: unknown[] },
) {
  if (!input) return { ...stored, capturedScore: stored.score, stale: true };

  const hoursSince = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  const now = scoreLead({ ...input, hoursSince });
  return {
    score: now.score,
    band: now.band as string,
    signals: now.signals as unknown[],
    capturedScore: stored.score,
    stale: false,
  };
}

export interface RankedLead {
  id: string;
  name: string | null;
  email: string | null;
  side: "buy" | "sell";
  score: number;
  band: string;
  signals: unknown[];
  createdAt: string;
  humanRepliedAt: string | null;
  /** What it scored on arrival. The difference from `score` is the decay. */
  capturedScore: number;
  /** True for leads captured before their inputs were kept. */
  stale: boolean;
  /** What the speed-to-lead clock needs, rather than a guess at it. */
  completion: number;
  contactable: boolean;
  hoursSince: number;
  /** Why the cadence stopped, or null while it is still running. */
  stopped: string | null;
  /**
   * The figures they were actually shown.
   *
   * "Who to call" without "what about" is half a tool: the agent opens the
   * phone and then has to go and find the numbers the person is holding. These
   * come from the readout snapshot, so what the agent reads is exactly what is
   * on the other person's screen — not a fresh computation that has since
   * moved and would have them talking past each other.
   */
  figures: Record<string, string | number> | null;
  shareToken: string | null;
}

/**
 * Records that a person has replied to this lead.
 *
 * `human_replied_at` was read by the speed-to-lead clock in three places and
 * written in none, so every lead stayed "waiting" forever and the breach count
 * could only ever grow. An agent who replied within a minute watched the
 * product tell him he was late, which is the fastest way to make him stop
 * looking at it.
 *
 * Idempotent by design: the FIRST reply is the one the clock measures, so a
 * second click cannot quietly improve the number. Speed to lead is about the
 * first response, and a metric you can retroactively flatter is not a metric.
 */
export async function markReplied(leadId: string, at = new Date()): Promise<DbResult<{ repliedAt: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  try {
    const { data, error } = await db
      .from("rift_leads")
      .update({ human_replied_at: at.toISOString() })
      .eq("id", leadId)
      .is("human_replied_at", null)
      .select("human_replied_at")
      .maybeSingle();
    if (error) return failed(error.message);

    if (data?.human_replied_at) return done({ repliedAt: data.human_replied_at as string });

    /* Already recorded. Report the original rather than pretending nothing
       happened — the caller wants to know when, not whether it just changed. */
    const { data: existing } = await db
      .from("rift_leads").select("human_replied_at").eq("id", leadId).maybeSingle();
    return existing?.human_replied_at
      ? done({ repliedAt: existing.human_replied_at as string })
      : failed("no such lead");
  } catch (e) {
    return failed(e);
  }
}

/** Ranked by what the answers say, never by when they arrived. */
export async function rankedLeads(limit = 50): Promise<DbResult<RankedLead[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_leads")
      .select("id,name,email,side,score,band,signals,lead_input,created_at,human_replied_at,assessment_id,rift_enrolments(stop_reason)")
      .eq("agent_id", agent_id)
      /* Ordered by the stored score only to bound the query. The list is
         re-sorted below on the recomputed score, because that is the one the
         agent acts on and the two diverge as leads age. */
      .order("score", { ascending: false })
      .limit(limit);
    if (error) return failed(error.message);

    /* One extra query for the whole page rather than one per lead. A list view
       that fans out per row is the classic way a fast page becomes a slow one
       the week somebody gets busy. */
    const assessmentIds = (data ?? [])
      .map((r) => r.assessment_id as string | null)
      .filter((x): x is string => Boolean(x));

    const snapshots = new Map<string, { figures: Record<string, string | number>; token: string }>();
    if (assessmentIds.length) {
      const { data: reads } = await db
        .from("rift_readouts")
        .select("assessment_id,figures,share_token,created_at")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: false });
      for (const row of (reads ?? []) as { assessment_id: string; figures: Record<string, string | number>; share_token: string }[]) {
        /* Newest first, so the first write per assessment wins and later
           snapshots do not overwrite it. */
        if (!snapshots.has(row.assessment_id)) {
          snapshots.set(row.assessment_id, { figures: row.figures, token: row.share_token });
        }
      }
    }

    return done((data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      side: r.side as "buy" | "sell",
      ...rescore(r.lead_input as LeadInput | null, r.created_at as string, {
        score: (r.score as number) ?? 0,
        band: (r.band as string) ?? "nurture",
        signals: (r.signals as unknown[]) ?? [],
      }),
      createdAt: r.created_at as string,
      humanRepliedAt: r.human_replied_at as string | null,
      stopped: (r as unknown as { rift_enrolments?: { stop_reason: string | null }[] })
        .rift_enrolments?.[0]?.stop_reason ?? null,
      figures: snapshots.get(r.assessment_id as string)?.figures ?? null,
      shareToken: snapshots.get(r.assessment_id as string)?.token ?? null,
      completion: (r.lead_input as LeadInput | null)?.completion ?? 0,
      /* From the row, not assumed. A lead with neither an email nor a phone
         number cannot be replied to, and counting it as a breach would make
         the agent look late for somebody unreachable. */
      contactable: Boolean(r.email || r.name),
      hoursSince: Math.max(0, (Date.now() - new Date(r.created_at as string).getTime()) / 3_600_000),
    })).sort((a, b) => b.score - a.score));
  } catch (e) {
    return failed(e);
  }
}
