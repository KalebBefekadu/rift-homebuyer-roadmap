import "server-only";
import { serviceClient } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { isUuid } from "@/lib/core/ids";
import { contactKey, cleanContact, type Contact } from "@/lib/core/contacts";
import type { Workstream } from "@/lib/core/progress";

/**
 * Who to ask about a contract's workstream (audit portals-2026-10, decision
 * 3). The agent's own records: nothing here is selected by the portal.
 */
export async function contactsFor(agentId: string, transactionIds: string[]): Promise<DbResult<Record<string, Contact>>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const ids = transactionIds.filter(isUuid);
  if (!ids.length) return done({});
  const r = await boundedReport(
    db.from("rift_contract_contacts").select("transaction_id,workstream,name,email,created_at")
      .eq("agent_id", agentId).in("transaction_id", ids).order("created_at", { ascending: false }).limit(500),
    "the contract contacts",
  );
  /* A deploy ahead of its migration has no contacts, not a broken page. */
  if (!r.ok) return /rift_contract_contacts/.test(r.error) ? done({}) : r;
  const out: Record<string, Contact> = {};
  for (const c of ("data" in r ? r.data : []) as { transaction_id: string; workstream: Workstream; name: string | null; email: string }[]) {
    const k = contactKey(c.transaction_id, c.workstream);
    if (!out[k]) out[k] = { name: c.name, email: c.email };
  }
  return done(out);
}

export async function addContact(agentId: string, input: { journeyId: string; transactionId: string; workstream: Workstream; name: string | null; email: string }): Promise<DbResult<{ saved: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const c = cleanContact(input.name, input.email);
  if (!c) return failed("That email address does not look right.");
  if (!isUuid(input.journeyId) || !isUuid(input.transactionId)) return failed("Reload the page and try again");
  const w = await boundedWrite(
    db.from("rift_contract_contacts").insert({
      agent_id: agentId, journey_id: input.journeyId, transaction_id: input.transactionId,
      workstream: input.workstream, name: c.name, email: c.email,
    }),
    "the contact",
  );
  if (!w.ok) return w as DbResult<never>;
  return done({ saved: true as const });
}
