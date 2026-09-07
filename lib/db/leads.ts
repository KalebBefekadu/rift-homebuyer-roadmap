import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { scoreLead, type LeadInput, type LeadScore } from "@/lib/core/lead";
import { captureOpError } from "@/lib/monitoring/capture";
import { CONSENT_VERSION } from "@/lib/core/privacy";
import { enrol } from "./nurture";

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
  assessmentId: string;
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
    const { data, error } = await db
      .from("rift_leads")
      .insert({
        agent_id,
        assessment_id: input.assessmentId,
        side: input.side,
        name: input.name ?? null,
        email: input.email ?? null,
        phone,
        score: score.score,
        band: score.band,
        signals: score.signals as never,
      })
      .select("id")
      .single();
    if (error) return failed(error.message);

    const consents: Record<string, unknown>[] = [];
    if (input.email && input.emailConsentWording) {
      consents.push({
        agent_id, assessment_id: input.assessmentId, kind: "email",
        wording: input.emailConsentWording, version: CONSENT_VERSION, granted: true,
        ip: input.ip ?? null, user_agent: input.userAgent ?? null,
      });
    }
    if (input.phone && input.phoneConsent) {
      /* Recorded whether granted or refused. A refusal is evidence too — it is
         what proves the number was never called. */
      consents.push({
        agent_id, assessment_id: input.assessmentId, kind: "phone",
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
  /** Why the cadence stopped, or null while it is still running. */
  stopped: string | null;
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
      .select("id,name,email,side,score,band,signals,created_at,human_replied_at,rift_enrolments(stop_reason)")
      .eq("agent_id", agent_id)
      .order("score", { ascending: false })
      .limit(limit);
    if (error) return failed(error.message);
    return done((data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string | null,
      email: r.email as string | null,
      side: r.side as "buy" | "sell",
      score: (r.score as number) ?? 0,
      band: (r.band as string) ?? "nurture",
      signals: (r.signals as unknown[]) ?? [],
      createdAt: r.created_at as string,
      humanRepliedAt: r.human_replied_at as string | null,
      stopped: (r as unknown as { rift_enrolments?: { stop_reason: string | null }[] })
        .rift_enrolments?.[0]?.stop_reason ?? null,
    })));
  } catch (e) {
    return failed(e);
  }
}
