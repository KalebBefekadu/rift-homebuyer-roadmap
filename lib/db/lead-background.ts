import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedReport } from "./bounded";
import type { LeadInput, Signal } from "@/lib/core/lead";
import type { StopId } from "@/lib/core/nurture";

/**
 * What a person told the funnel, whether they agreed to be contacted, and
 * whether automatic follow-up is running: the three things the record used to
 * hold and show nowhere.
 *
 * Read beside `readLead`, not inside it. `readLead` is the record the agent
 * came for and must not wait on, or fail because of, three extra queries.
 * Each part here degrades on its own, and a part that could not be read says
 * so rather than reading as "no consent" or "not enrolled": over a failed
 * read those would tell the agent he may not contact somebody he may, or that
 * follow-up is off when it is running.
 */

export interface ConsentView {
  /** Null when they never answered the question, which is not the same as "no". */
  granted: boolean | null;
  at: string | null;
}

export interface FollowUp {
  band: string;
  enteredAt: string;
  stoppedAt: string | null;
  stopReason: StopId | null;
  phoneConsent: boolean;
  touches: number;
}

export interface Background {
  /** What they answered in the funnel; null for somebody added by hand. */
  funnel: LeadInput | null;
  signals: Signal[];
  humanRepliedAt: string | null;
  /** Null when consent could not be read. */
  consents: { email: ConsentView; phone: ConsentView; recorded: boolean } | null;
  /** "unread" when the read failed; null when they are not enrolled. */
  followUp: FollowUp | null | "unread";
}

export async function backgroundOf(leadId: string): Promise<DbResult<Background>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const lead = await boundedReport(
    db.from("rift_leads")
      .select("lead_input,signals,human_replied_at,assessment_id,session_id")
      .eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "what they told the funnel",
  );
  if (!lead.ok || !("data" in lead)) return lead as DbResult<Background>;
  const row = lead.data as {
    lead_input: LeadInput | null; signals: Signal[] | null; human_replied_at: string | null;
    assessment_id: string | null; session_id: string | null;
  } | null;
  if (!row) return failed("no such person");

  /* Consent is linked to the person by the assessment or the browser session
     they gave it in. Somebody added by hand has neither and no consent rows:
     what lets the agent contact them is the basis he wrote down, shown
     separately. */
  const conds = [
    row.assessment_id ? `assessment_id.eq.${row.assessment_id}` : null,
    row.session_id ? `session_id.eq.${row.session_id}` : null,
  ].filter(Boolean) as string[];

  const [consentRead, enrolRead] = await Promise.all([
    conds.length
      ? boundedReport(
          db.from("rift_consents").select("kind,granted,at").eq("agent_id", agentId)
            .or(conds.join(",")).order("at", { ascending: false }).limit(50),
          "their consent",
        )
      : Promise.resolve(null),
    boundedReport(
      db.from("rift_enrolments")
        .select("band,entered_at,stopped_at,stop_reason,phone_consent,rift_touches(id)")
        .eq("lead_id", leadId).eq("agent_id", agentId).maybeSingle(),
      "their follow-up",
    ),
  ]);

  let consents: Background["consents"];
  if (consentRead === null) {
    consents = { email: { granted: null, at: null }, phone: { granted: null, at: null }, recorded: false };
  } else if (!consentRead.ok || !("data" in consentRead)) {
    consents = null;
  } else {
    /* Newest answer per channel: somebody who ticked phone and later
       unticked it has said no, whatever the older row says. */
    const latest = (kind: string): ConsentView => {
      const r = (consentRead.data as { kind: string; granted: boolean; at: string }[]).find((c) => c.kind === kind);
      return r ? { granted: r.granted, at: r.at } : { granted: null, at: null };
    };
    consents = { email: latest("email"), phone: latest("phone"), recorded: (consentRead.data as unknown[]).length > 0 };
  }

  let followUp: Background["followUp"];
  if (!enrolRead.ok || !("data" in enrolRead)) followUp = "unread";
  else {
    const e = enrolRead.data as {
      band: string; entered_at: string; stopped_at: string | null; stop_reason: StopId | null;
      phone_consent: boolean; rift_touches: unknown[] | null;
    } | null;
    followUp = e ? {
      band: e.band, enteredAt: e.entered_at, stoppedAt: e.stopped_at, stopReason: e.stop_reason,
      phoneConsent: e.phone_consent, touches: e.rift_touches?.length ?? 0,
    } : null;
  }

  return done({
    funnel: row.lead_input ?? null,
    signals: Array.isArray(row.signals) ? row.signals : [],
    humanRepliedAt: row.human_replied_at,
    consents,
    followUp,
  });
}
