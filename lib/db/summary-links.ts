import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { clientRecords, type Membership, type RecordSection } from "./client";
import {
  PART_SECTIONS, isSummaryToken, linkState, summaryError, withoutMoney, type SummaryLinkView, type SummaryPart,
} from "@/lib/core/summary-link";

/**
 * Read-only summary links (ACCESS-02). The token is 32 random bytes, shown to
 * the member once and stored only as its SHA-256. The summary is the member's
 * own records page, cut to the parts they chose and read with only the scopes
 * those parts need, so nothing else can leak into it.
 */

const NOT_YET = "Sharing a summary needs a database update that has not been applied yet (migration 20260927030000).";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSummaryLink(m: Membership, parts: unknown, label: unknown, days: unknown): Promise<DbResult<{ token: string }>> {
  const bad = summaryError(parts, label, days, m.scopes);
  if (bad) return failed(bad);
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
  const w = await boundedWrite(
    db.from("rift_summary_links").insert({
      agent_id: m.agentId, journey_id: m.journeyId, created_by: m.memberId,
      token_hash: hash(token), parts, label: String(label).trim(), expires_at: expiresAt,
    }),
    "the summary link",
  );
  if (!w.ok) return /rift_summary_links/.test(w.error) ? failed(NOT_YET) : w;
  return done({ token });
}

/** The member's own links: a member sees and revokes only what they made. */
export async function mySummaryLinks(m: Membership): Promise<DbResult<SummaryLinkView[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_summary_links").select("id,label,parts,expires_at,revoked_at,created_at")
      .eq("journey_id", m.journeyId).eq("created_by", m.memberId).order("created_at", { ascending: false }).limit(50),
    "your summary links",
  );
  if (!r.ok) return /rift_summary_links/.test(r.error) ? done([]) : r;
  return done((("data" in r ? r.data : []) as Record<string, unknown>[]).map((x) => ({
    id: x.id as string, label: x.label as string, parts: x.parts as SummaryPart[],
    expiresAt: x.expires_at as string, createdAt: x.created_at as string,
    state: linkState({ expiresAt: x.expires_at as string, revokedAt: x.revoked_at as string | null }),
  })));
}

export async function revokeSummaryLink(m: Membership, id: string): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const w = await boundedWrite(
    db.from("rift_summary_links").update({ revoked_at: new Date().toISOString() })
      .eq("id", id).eq("journey_id", m.journeyId).eq("created_by", m.memberId).is("revoked_at", null).select("id"),
    "revoking the link",
  );
  if (!w.ok) return w;
  if (!(("data" in w ? w.data : []) as unknown[]).length) return failed("That link was already stopped, or is not yours");
  return done({ id });
}

export type OpenedSummary =
  | { state: "live"; label: string; sharedBy: string; journeyLabel: string; agentName: string; expiresAt: string; sections: RecordSection[] }
  | { state: "expired" | "revoked" | "unknown" };

/** What a summary link shows, or why it shows nothing. */
export async function openSummary(token: string): Promise<DbResult<OpenedSummary>> {
  if (!isSummaryToken(token)) return done({ state: "unknown" });
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_summary_links").select("journey_id,agent_id,created_by,parts,label,expires_at,revoked_at")
      .eq("token_hash", hash(token)).maybeSingle(),
    "the summary",
  );
  if (!r.ok) return /rift_summary_links/.test(r.error) ? done({ state: "unknown" }) : r;
  const link = ("data" in r ? r.data : null) as {
    journey_id: string; agent_id: string; created_by: string; parts: SummaryPart[]; label: string; expires_at: string; revoked_at: string | null;
  } | null;
  if (!link) return done({ state: "unknown" });
  const state = linkState({ expiresAt: link.expires_at, revokedAt: link.revoked_at });
  if (state !== "live") return done({ state });

  const [member, journey, agent] = await Promise.all([
    boundedRead(db.from("rift_journey_members").select("id,role,scopes,display_name,revoked_at").eq("id", link.created_by).maybeSingle(), "who shared it"),
    boundedRead(db.from("rift_journeys").select("id,label,side").eq("id", link.journey_id).maybeSingle(), "the move"),
    boundedRead(db.from("rift_agents").select("name").eq("id", link.agent_id).maybeSingle(), "the agent"),
  ]);
  const mem = member.ok && "data" in member ? member.data as { id: string; role: Membership["role"]; scopes: Membership["scopes"]; display_name: string | null; revoked_at: string | null } | null : null;
  const j = journey.ok && "data" in journey ? journey.data as { id: string; label: string; side: Membership["side"] } | null : null;
  /* A member who has lost access can no longer share: their links stop too. */
  if (!mem || mem.revoked_at || !j) return done({ state: "revoked" });
  const agentName = (agent.ok && "data" in agent ? (agent.data as { name: string | null } | null)?.name : null) ?? "their agent";

  /* Read with only what the chosen parts need: homes lets the homes read
     through; money and search are never granted, so the brief, offers and
     their documents are not even fetched. */
  const scoped: Membership = {
    memberId: mem.id, journeyId: j.id, agentId: link.agent_id, role: mem.role,
    scopes: link.parts.includes("homes") && mem.scopes.includes("homes") ? ["homes"] : [],
    name: mem.display_name ?? "A member of the household", journeyLabel: j.label, side: j.side,
    agentName, agentEmail: null, agentPhone: null,
  };
  const rec = await clientRecords(scoped);
  if (!rec.ok || !("data" in rec)) return rec as DbResult<never>;
  const wanted = new Set(link.parts.flatMap((p) => PART_SECTIONS[p]));
  return done({
    state: "live", label: link.label, sharedBy: scoped.name, journeyLabel: j.label, agentName,
    expiresAt: link.expires_at, sections: rec.data.sections.filter((s) => wanted.has(s.title)).map((s) => ({ ...s, lines: s.lines.map(withoutMoney) })),
  });
}
