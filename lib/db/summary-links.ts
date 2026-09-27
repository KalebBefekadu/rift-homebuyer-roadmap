import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { readProgress } from "./progress";
import { readDeadlines } from "./deadlines";
import { afterClose, visitedStages, type Progress, type Stage, type WorkstreamView } from "@/lib/core/progress";
import { expiryFrom, linkState, readScopes, tokenShape, type LinkState, type SummaryLink, type SummaryScope } from "@/lib/core/summary-link";

/**
 * The only reader and writer of rift_summary_links (ACCESS-02). Rules:
 * lib/core/summary-link.ts. A token is shown once, when it is made, and never
 * stored, logged or listed.
 */

const MISSING = /rift_summary_links|does not exist|schema cache/;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSummaryLink(input: { journeyId: string; label: string; scopes: unknown[]; days: number; by: string }): Promise<DbResult<{ token: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const scopes = readScopes(input.scopes);
  if (!scopes.length) return failed("Choose what the link may show");
  const label = input.label.trim().slice(0, 80);
  if (!label) return failed("Say who the link is for");
  const j = await boundedRead(db.from("rift_journeys").select("id").eq("id", input.journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  if (!("data" in j) || !j.data) return failed("That journey is not yours");
  const token = randomBytes(32).toString("base64url");
  const w = await boundedWrite(db.from("rift_summary_links").insert({
    agent_id: agentId, journey_id: input.journeyId, token_hash: hash(token), label, scopes,
    expires_at: expiryFrom(new Date(), input.days), created_by: input.by.slice(0, 120),
  }), "the summary link");
  if (!w.ok) return MISSING.test(w.error) ? failed("Summary links need migration 20260927020000") : w;
  return done({ token });
}

export async function summaryLinksFor(journeyId: string): Promise<DbResult<SummaryLink[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const r = await boundedRead(db.from("rift_summary_links").select("id,label,scopes,expires_at,revoked_at,created_at")
    .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(50), "the summary links");
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  return done((("data" in r ? r.data : []) as { id: string; label: string; scopes: SummaryScope[]; expires_at: string; revoked_at: string | null; created_at: string }[])
    .map((x) => ({ id: x.id, label: x.label, scopes: x.scopes, expiresAt: x.expires_at, revokedAt: x.revoked_at, createdAt: x.created_at })));
}

export async function revokeSummaryLink(id: string, by: string): Promise<DbResult<true>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");
  const w = await boundedWrite(db.from("rift_summary_links").update({ revoked_at: new Date().toISOString(), revoked_by: by.slice(0, 120) })
    .eq("id", id).eq("agent_id", agentId).is("revoked_at", null), "the summary link");
  return w.ok ? done(true) : w;
}

export interface Summary {
  state: LinkState;
  label: string;
  journeyLabel: string;
  scopes: SummaryScope[];
  expiresAt: string;
  progress: Progress | null;
  visited: Stage[];
  contract: { address: string; work: WorkstreamView[]; closed: boolean } | null;
  dates: { label: string; when: string; missed: boolean }[];
}

/** What a summary link opens. Only its scopes are read. */
export async function openSummary(token: string, now = new Date()): Promise<DbResult<Summary | null>> {
  if (!tokenShape(token)) return done(null);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(db.from("rift_summary_links").select("agent_id,journey_id,label,scopes,expires_at,revoked_at")
    .eq("token_hash", hash(token)).maybeSingle(), "the summary");
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const link = ("data" in r ? r.data : null) as { agent_id: string; journey_id: string; label: string; scopes: SummaryScope[]; expires_at: string; revoked_at: string | null } | null;
  if (!link) return done(null);
  const state = linkState({ expiresAt: link.expires_at, revokedAt: link.revoked_at }, now);
  const base: Summary = { state, label: link.label, journeyLabel: "", scopes: link.scopes, expiresAt: link.expires_at, progress: null, visited: [], contract: null, dates: [] };
  if (state !== "live") return done(base);

  const j = await boundedRead(db.from("rift_journeys").select("label").eq("id", link.journey_id).eq("agent_id", link.agent_id).maybeSingle(), "the journey");
  if (!j.ok) return j;
  base.journeyLabel = (("data" in j ? j.data : null) as { label: string } | null)?.label ?? "";
  const p = await readProgress(link.journey_id, link.agent_id, now);
  if (!p.ok || !("data" in p)) return p as DbResult<never>;
  const rec = p.data;
  if (link.scopes.includes("progress")) {
    base.progress = rec.progress;
    base.visited = visitedStages(rec.events);
    const after = afterClose(rec.contracts, rec.open);
    base.contract = rec.open ? { address: rec.open.address, work: rec.open.work, closed: false }
      : after ? { address: after.contract.address, work: after.work, closed: true } : null;
  }
  if (link.scopes.includes("dates") && rec.open) {
    const d = await readDeadlines(link.journey_id, link.agent_id, now);
    if (d.ok && "data" in d) {
      base.dates = d.data.deadlines.filter((x) => x.transactionId === rec.open!.id && x.kind === "contractual" && x.view.verified)
        .map((x) => ({ label: x.label, when: x.view.when, missed: x.view.missed }));
    }
  }
  return done(base);
}
