import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedReport, boundedWrite } from "./bounded";
import {
  standingOf, readStatus, STATUSES, STATUS_RULES, EXPIRY_WARNING_DAYS,
  type Representation, type Standing, type Status as RepStatus,
} from "@/lib/core/representation";
import { georgiaDay } from "@/lib/core/day";
import { addNote } from "./notes";

/**
 * The representation agreement on a relationship: what is on file, recording
 * a paper event, and which agreements are about to lapse. Out of clients.ts,
 * which re-exports it, because it shares nothing with the board's reads.
 */

/* ------------------------------------------------------------------ *
 * Representation
 * ------------------------------------------------------------------ */

/**
 * The agreement on file, as it stands today.
 *
 * Read separately from the board rather than added to the board's column list
 * (SELECT_BASE in clients.ts), because this arrived after the migration for it
 * and every read there shares that list. Bolting three new columns onto the list would make each of
 * them a way for the roster to fail entirely on a deploy that landed first.
 */
export async function representationOf(leadId: string): Promise<DbResult<Representation>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const res = await boundedReport(
    db.from("rift_leads")
      .select("representation,representation_signed_on,representation_expires_on")
      .eq("id", leadId).eq("agent_id", agent_id).maybeSingle(),
    "the representation agreement",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<Representation>;

  const row = res.data as Record<string, unknown> | null;
  if (!row) return failed("no such person");

  return done({
    status: readStatus(row.representation),
    signedOn: (row.representation_signed_on as string | null) ?? null,
    expiresOn: (row.representation_expires_on as string | null) ?? null,
  });
}

/**
 * Record what the agreement now is.
 *
 * Writes a note, like a stage change does, because the history of when
 * representation moved is the part somebody would actually be asked about and
 * a column only holds the latest answer.
 *
 * The dates are cleared whenever the status is not `signed`. The database
 * enforces the same rule; doing it here too means the caller gets a coherent
 * row rather than a constraint violation for something it could have fixed.
 */
export async function setRepresentation(
  leadId: string,
  status: RepStatus,
  dates: { signedOn?: string | null; expiresOn?: string | null } = {},
): Promise<DbResult<{ status: RepStatus }>> {
  if (!(STATUSES as readonly string[]).includes(status)) return failed(`unknown status: ${status}`);

  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const signed = status === "signed";
  if (signed && !dates.signedOn) {
    return failed("a signed agreement needs the date it was signed. That is the part anyone would ask for");
  }

  const patch = {
    representation: status,
    representation_signed_on: signed ? dates.signedOn! : null,
    representation_expires_on: signed ? (dates.expiresOn || null) : null,
  };

  const res = await boundedWrite(
    db.from("rift_leads").update(patch).eq("id", leadId).eq("agent_id", agent_id).select("id").single(),
    "the representation agreement",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ status: RepStatus }>;

  const label = STATUS_RULES[status].label.toLowerCase();
  await addNote(leadId, "note", signed
    ? `Representation ${label} ${dates.signedOn}${dates.expiresOn ? `, expires ${dates.expiresOn}` : ", no end date"}.`
    : `Representation set to ${label}.`);

  return done({ status });
}

/**
 * Agreements running out, soonest first.
 *
 * docs/product.md: "Expiration is a monitored deadline that raises attention
 * before it lapses, not after." Includes those already lapsed, because an
 * agreement that ran out last week is more urgent than one running out next
 * week and a list that quietly drops it is worse than no list.
 */
export async function lapsingAgreements(now = new Date()): Promise<DbResult<Lapsing[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const horizon = georgiaDay(now, EXPIRY_WARNING_DAYS);

  const res = await boundedReport(
    db.from("rift_leads")
      .select("id,name,side,representation,representation_signed_on,representation_expires_on")
      .eq("agent_id", agent_id)
      .is("archived_at", null)
      .eq("representation", "signed")
      .not("representation_expires_on", "is", null)
      .lte("representation_expires_on", horizon)
      .order("representation_expires_on", { ascending: true })
      .limit(100),
    "agreements running out",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<Lapsing[]>;

  return done((res.data as Record<string, unknown>[]).map((r) => {
    const rep: Representation = {
      status: "signed",
      signedOn: (r.representation_signed_on as string | null) ?? null,
      expiresOn: (r.representation_expires_on as string | null) ?? null,
    };
    return {
      id: r.id as string,
      name: (r.name as string | null) ?? "Unnamed",
      side: (r.side as "buy" | "sell"),
      standing: standingOf(rep, now),
    };
  }));
}

export interface Lapsing {
  id: string;
  name: string;
  side: "buy" | "sell";
  standing: Standing;
}
