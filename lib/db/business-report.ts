import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import type { AttributionRow, LeadRow } from "@/lib/core/business-report";

/**
 * What the business report counts, read in two queries.
 *
 * Every lead (with only the columns the report needs) and every first touch.
 * Counting is in lib/core/business-report.ts, so this is a read and a shape
 * and nothing else. Two reads rather than one per figure on purpose: Reports
 * used to open a dozen at once and spend its whole deadline waiting for the
 * event loop, which is how it came to say "did not load" with a database that
 * answered in fifty milliseconds.
 */

export interface BusinessRead {
  leads: LeadRow[];
  attributions: AttributionRow[];
  /** Rows beyond the read limits, so a count may be short and the page says so. */
  truncated: boolean;
}

const LEAD_LIMIT = 5000;
const ATTRIBUTION_LIMIT = 20_000;

export async function businessRead(): Promise<DbResult<BusinessRead>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const [leads, attributions] = await Promise.all([
    boundedReport(
      db.from("rift_leads").select("id,source,stage,session_id,created_at,archived_at,closed_on,lead_input")
        .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(LEAD_LIMIT),
      "the leads",
    ),
    boundedReport(
      db.from("rift_attributions").select("session_id,first_source,first_medium,first_referrer,first_ref,first_at")
        .eq("agent_id", agentId).order("first_at", { ascending: false }).limit(ATTRIBUTION_LIMIT),
      "the visits",
    ),
  ]);
  if (!leads.ok) return leads;
  if (!attributions.ok) return attributions;

  const leadRows = ("data" in leads ? leads.data : []) as unknown as Record<string, unknown>[];
  const attrRows = ("data" in attributions ? attributions.data : []) as unknown as Record<string, unknown>[];

  return done({
    leads: leadRows.map((r) => {
      const raw = (r.lead_input as { value?: unknown } | null)?.value;
      /* Finite and positive, the same test the forward view uses: a null deal
         size is "nobody said", not a deal worth nothing. */
      const known = typeof raw === "number" && Number.isFinite(raw) && raw > 0;
      return {
        id: r.id as string, source: r.source as string, stage: (r.stage as string | null) ?? null,
        sessionId: (r.session_id as string | null) ?? null, createdAt: r.created_at as string, archived: r.archived_at != null,
        closedOn: (r.closed_on as string | null) ?? null, value: known ? (raw as number) : null,
      };
    }),
    attributions: attrRows.map((r) => ({
      sessionId: r.session_id as string, source: (r.first_source as string | null) ?? null, medium: (r.first_medium as string | null) ?? null,
      referrer: (r.first_referrer as string | null) ?? null, ref: (r.first_ref as string | null) ?? null, firstAt: r.first_at as string,
    })),
    truncated: leadRows.length >= LEAD_LIMIT || attrRows.length >= ATTRIBUTION_LIMIT,
  });
}
