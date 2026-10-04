import "server-only";
import { serviceClient } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { shapeRevision, type Revision } from "./search";
import { canRespond, type Scope } from "@/lib/core/journey";
import { briefErrors, FIELDS, statusOf, SEARCH_SCHEMA_VERSION, type Response, type SearchBrief, type SearchCriterion, type SearchStatus } from "@/lib/core/search";
import { georgiaDay } from "@/lib/core/day";
import type { Membership } from "./portal";

/**
 * The search brief from a household member's side: reading it within their
 * scopes, confirming or asking for changes, and proposing a revision. Out of
 * portal.ts, which re-exports it; the membership check is portal.ts's.
 */
/* ------------------------------------------------------------------------ */
/* The brief, as a member sees it                                            */
/* ------------------------------------------------------------------------ */

export interface ClientBrief {
  revision: Revision | null;
  /** Criteria the member cannot see (money without the money scope) are removed, and counted. */
  hidden: number;
  /** The previous revision, projected the same way, for "what changed". */
  previous: Revision | null;
  myResponse: { response: Response; note: string | null; at: string } | null;
  status: SearchStatus;
  /** When the agent last recorded setting the search up. Never "Matrix says". */
  activeSince: string | null;
}

const hide = (rev: Revision, scopes: Scope[]): { rev: Revision; hidden: number } => {
  if (scopes.includes("money")) return { rev, hidden: 0 };
  const kept = rev.brief.criteria.filter((c) => !FIELDS[c.field].money);
  return { rev: { ...rev, brief: { ...rev.brief, criteria: kept } }, hidden: rev.brief.criteria.length - kept.length };
};

export async function clientBrief(m: Membership): Promise<DbResult<ClientBrief>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!m.scopes.includes("search")) return failed("Your agent has not shared the search with you");

  const [revs, pkgs, mine] = await Promise.all([
    boundedReport(
      db.from("rift_search_revisions").select("id,revision,criteria,questions,note,author_kind,author_label,created_at")
        .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).order("revision", { ascending: false }).limit(2),
      "your search",
    ),
    boundedReport(
      db.from("rift_search_packages").select("status,package,confirmed_at")
        .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).in("status", ["manual-action-needed", "active-confirmed", "paused"]),
      "your search",
    ),
    boundedReport(
      db.from("rift_search_responses").select("revision_id,response,note,created_at")
        .eq("journey_id", m.journeyId).eq("member_id", m.memberId).order("created_at", { ascending: false }).limit(1),
      "your answer",
    ),
  ]);
  if (!revs.ok) return revs;
  if (!pkgs.ok) return pkgs;
  const rows = (("data" in revs ? revs.data : []) as Record<string, unknown>[]).map(shapeRevision);
  const latest = rows[0] ? hide(rows[0], m.scopes) : null;
  const previous = rows[1] ? hide(rows[1], m.scopes).rev : null;

  const live = ("data" in pkgs ? pkgs.data : []) as { status: string; package: { revision: number }; confirmed_at: string | null }[];
  const active = live.find((p) => p.status !== "manual-action-needed");
  const pending = live.find((p) => p.status === "manual-action-needed");
  const status = statusOf({
    latest: rows[0]?.revision ?? null,
    active: active ? { revision: active.package.revision, status: active.status as "active-confirmed" | "paused" } : null,
    pending: pending ? { revision: pending.package.revision } : null,
  });

  const lastMine = mine.ok && "data" in mine ? ((mine.data as Record<string, unknown>[])[0] ?? null) : null;
  return done({
    revision: latest?.rev ?? null,
    hidden: latest?.hidden ?? 0,
    previous,
    myResponse: lastMine && rows[0] && lastMine.revision_id === rows[0].id
      ? { response: lastMine.response as Response, note: (lastMine.note as string | null) ?? null, at: lastMine.created_at as string }
      : null,
    status,
    activeSince: active?.confirmed_at ?? null,
  });
}

/**
 * Confirm the latest revision, or ask for changes to it. Against the exact
 * revision the member was shown: an answer to revision 3 after revision 4
 * exists is refused, so nobody confirms a brief they never read (AT22's rule,
 * applied here).
 */
export async function respondToBrief(
  m: Membership, revisionId: string, response: Response, note: string | null,
): Promise<DbResult<{ recorded: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!canRespond(m.role) || !m.scopes.includes("search")) return failed("Your access lets you read this, not answer it");
  if (response !== "confirmed" && response !== "changes-requested") return failed("Confirm it or ask for changes");
  const why = note?.trim() || null;
  if (response === "changes-requested" && !why) return failed("Say what should change");
  if (why && why.length > 1000) return failed("Keep it under 1,000 characters");

  const latest = await boundedReport(
    db.from("rift_search_revisions").select("id").eq("journey_id", m.journeyId).eq("agent_id", m.agentId)
      .order("revision", { ascending: false }).limit(1).maybeSingle(),
    "your search",
  );
  if (!latest.ok) return latest;
  const id = (("data" in latest ? latest.data : null) as { id: string } | null)?.id;
  if (!id || id !== revisionId) return failed("The search changed since you opened this page. Reload to see the latest version");

  const wrote = await boundedWrite(
    db.from("rift_search_responses").insert({
      agent_id: m.agentId, journey_id: m.journeyId, revision_id: revisionId, member_id: m.memberId, response, note: why,
    }),
    "your answer",
  );
  if (!wrote.ok) return wrote;
  return done({ recorded: true as const });
}

/**
 * A member proposes a change: a new revision authored by them. Attribution is
 * set HERE: a criterion they changed is "stated by" them, today, from the
 * client page, whatever the browser sent, so nobody can post a change that
 * reads as the agent's. Criteria they cannot see (money, without the scope)
 * are carried over untouched from the latest revision.
 */
export async function proposeRevision(
  m: Membership, submitted: SearchBrief, expectedLatest: number, note: string | null,
): Promise<DbResult<{ revision: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!canRespond(m.role) || !m.scopes.includes("search")) return failed("Your access lets you read this, not change it");

  const latestRead = await boundedReport(
    db.from("rift_search_revisions").select("id,revision,criteria,questions,note,author_kind,author_label,created_at")
      .eq("journey_id", m.journeyId).eq("agent_id", m.agentId).order("revision", { ascending: false }).limit(1).maybeSingle(),
    "your search",
  );
  if (!latestRead.ok) return latestRead;
  const latestRow = ("data" in latestRead ? latestRead.data : null) as Record<string, unknown> | null;
  const latest = latestRow ? shapeRevision(latestRow) : null;
  if ((latest?.revision ?? 0) !== expectedLatest) {
    return failed("The search changed since you opened this page. Reload to see the latest version, then make your change");
  }

  const today = georgiaDay();
  const before = new Map((latest?.brief.criteria ?? []).map((c) => [c.id, c]));
  const canSeeMoney = m.scopes.includes("money");
  const visible: SearchCriterion[] = submitted.criteria
    .filter((c) => canSeeMoney || !FIELDS[c.field]?.money)
    .map((c) => {
      const was = before.get(c.id);
      const same = was && JSON.stringify(was.value) === JSON.stringify(c.value) && was.operator === c.operator
        && was.strength === c.strength && was.field === c.field;
      return same ? was : { ...c, statedBy: `${m.name.slice(0, 60)} (buyer)`, statedAt: today, sourceRef: "client page" };
    });
  const carried = canSeeMoney ? [] : (latest?.brief.criteria ?? []).filter((c) => FIELDS[c.field].money);
  const brief: SearchBrief = { criteria: [...carried, ...visible], questions: submitted.questions ?? [] };
  const errors = briefErrors(brief);
  if (errors.length) return failed(errors[0]!);

  const revision = expectedLatest + 1;
  const wrote = await boundedWrite(
    db.from("rift_search_revisions").insert({
      agent_id: m.agentId, journey_id: m.journeyId, revision, schema_version: SEARCH_SCHEMA_VERSION,
      criteria: brief.criteria, questions: brief.questions, note: note?.trim().slice(0, 2000) || null,
      author_kind: "client", author_member_id: m.memberId, author_label: m.name.slice(0, 120),
    }),
    "your change",
  );
  if (!wrote.ok) {
    return /out of order|one_number|duplicate key/.test(wrote.error)
      ? failed("Somebody saved a change a moment ago. Reload to see it, then make yours")
      : wrote;
  }
  return done({ revision });
}
