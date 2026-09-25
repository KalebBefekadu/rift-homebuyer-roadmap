import "server-only";
import { createHash } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyFor, journeyTablesMissing } from "./journeys";
import { briefStartFromPlan, type SavedPlan } from "@/lib/core/saved-plan";
import {
  briefErrors, buildPackage, canonicalPackage, disagreementOn, statusOf, SEARCH_SCHEMA_VERSION,
  type Cadence, type Response, type SearchBrief, type SearchCriterion, type SearchPackage, type SearchStatus,
} from "@/lib/core/search";

/**
 * The search brief and its Matrix package, on the agent's side.
 *
 * Revisions are written with the number the caller expects to be next. If
 * somebody else (the buyer, on their page) saved one in between, the insert is
 * refused by the database and the agent is told to reload, rather than one
 * edit silently landing on top of another.
 *
 * Approval and confirmation go through two SQL functions
 * (supabase/migrations/20260923030000_rift_search.sql) because the rules that
 * matter there (only the latest revision, one waiting approval, the same
 * request twice records once) must hold under a double click and a retry.
 */

export interface Revision {
  id: string;
  revision: number;
  brief: SearchBrief;
  note: string | null;
  authorKind: "agent" | "client";
  authorLabel: string;
  createdAt: string;
}

export interface ResponseRow {
  id: string;
  revisionId: string;
  memberId: string;
  name: string;
  response: Response;
  note: string | null;
  createdAt: string;
}

export interface PackageRow {
  id: string;
  revisionId: string;
  revision: number;
  cadence: Cadence;
  pkg: SearchPackage;
  status: "manual-action-needed" | "active-confirmed" | "paused" | "superseded" | "cancelled";
  approvedAt: string;
  approvedBy: string;
  externalRef: string | null;
  externalUrl: string | null;
  confirmedAt: string | null;
  confirmNote: string | null;
  endedAt: string | null;
}

export interface SearchState {
  revisions: Revision[];
  /** Responses to the LATEST revision only. */
  responses: ResponseRow[];
  active: PackageRow | null;
  pending: PackageRow | null;
  history: PackageRow[];
  status: SearchStatus;
  /** Household disagreement on the latest revision, in words. Blocks approval. */
  disagreement: string[];
}

const REV_COLUMNS = "id,revision,criteria,questions,note,author_kind,author_label,created_at";
const PKG_COLUMNS =
  "id,revision_id,cadence,package,status,approved_at,approved_by,external_ref,external_url,confirmed_at,confirm_note,ended_at";

export function shapeRevision(r: Record<string, unknown>): Revision {
  return {
    id: r.id as string,
    revision: r.revision as number,
    brief: { criteria: (r.criteria as SearchCriterion[]) ?? [], questions: (r.questions as string[]) ?? [] },
    note: (r.note as string | null) ?? null,
    authorKind: r.author_kind as "agent" | "client",
    authorLabel: r.author_label as string,
    createdAt: r.created_at as string,
  };
}

function shapePackage(r: Record<string, unknown>, revisionNo: Map<string, number>): PackageRow {
  return {
    id: r.id as string,
    revisionId: r.revision_id as string,
    revision: revisionNo.get(r.revision_id as string) ?? (r.package as SearchPackage).revision,
    cadence: r.cadence as Cadence,
    pkg: r.package as SearchPackage,
    status: r.status as PackageRow["status"],
    approvedAt: r.approved_at as string,
    approvedBy: r.approved_by as string,
    externalRef: (r.external_ref as string | null) ?? null,
    externalUrl: (r.external_url as string | null) ?? null,
    confirmedAt: (r.confirmed_at as string | null) ?? null,
    confirmNote: (r.confirm_note as string | null) ?? null,
    endedAt: (r.ended_at as string | null) ?? null,
  };
}

export const packageHash = (pkg: SearchPackage) => createHash("sha256").update(canonicalPackage(pkg)).digest("hex");

const EMPTY: SearchState = {
  revisions: [], responses: [], active: null, pending: null, history: [], status: "draft", disagreement: [],
};

/**
 * Everything the agent's search panel needs, in three reads. `agentId` is
 * passed by callers that already resolved it (the Operations list), and
 * resolved here otherwise.
 */
export async function searchState(journeyId: string): Promise<DbResult<SearchState>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const [revs, pkgs] = await Promise.all([
    boundedRead(
      db.from("rift_search_revisions").select(REV_COLUMNS)
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("revision", { ascending: false }).limit(50),
      "the search brief",
    ),
    boundedRead(
      db.from("rift_search_packages").select(PKG_COLUMNS)
        .eq("journey_id", journeyId).eq("agent_id", agentId).order("approved_at", { ascending: false }).limit(30),
      "the Matrix search",
    ),
  ]);
  if (!revs.ok) return journeyTablesMissing(revs.error) ? done(EMPTY) : revs;
  if (!pkgs.ok) return journeyTablesMissing(pkgs.error) ? done(EMPTY) : pkgs;

  const revisions = (("data" in revs ? revs.data : []) as Record<string, unknown>[]).map(shapeRevision);
  const revisionNo = new Map(revisions.map((r) => [r.id, r.revision]));
  const packages = (("data" in pkgs ? pkgs.data : []) as Record<string, unknown>[]).map((r) => shapePackage(r, revisionNo));
  const active = packages.find((p) => p.status === "active-confirmed" || p.status === "paused") ?? null;
  const pending = packages.find((p) => p.status === "manual-action-needed") ?? null;
  const latest = revisions[0] ?? null;

  let responses: ResponseRow[] = [];
  if (latest) {
    const resp = await boundedRead(
      db.from("rift_search_responses").select("id,revision_id,member_id,response,note,created_at")
        .eq("revision_id", latest.id).eq("agent_id", agentId).order("created_at").limit(50),
      "the household's answers",
    );
    const rows = (resp.ok && "data" in resp ? resp.data : []) as Record<string, unknown>[];
    if (rows.length) {
      const names = await boundedRead(
        db.from("rift_journey_members").select("id,display_name,email").eq("agent_id", agentId)
          .in("id", [...new Set(rows.map((r) => r.member_id as string))]),
        "their names",
      );
      const byId = new Map(
        (names.ok && "data" in names ? (names.data as { id: string; display_name: string | null; email: string }[]) : [])
          .map((m) => [m.id, m.display_name?.trim() || m.email]),
      );
      responses = rows.map((r) => ({
        id: r.id as string, revisionId: r.revision_id as string, memberId: r.member_id as string,
        name: byId.get(r.member_id as string) ?? "A member", response: r.response as Response,
        note: (r.note as string | null) ?? null, createdAt: r.created_at as string,
      }));
    }
  }

  const disagreement = disagreementOn(responses.map((r) => ({ name: r.name, response: r.response, note: r.note })));
  const status = statusOf({
    latest: latest?.revision ?? null,
    active: active ? { revision: active.revision, status: active.status === "paused" ? "paused" : "active-confirmed" } : null,
    pending: pending ? { revision: pending.revision } : null,
  });

  return done({
    revisions, responses, active, pending, status, disagreement,
    history: packages.filter((p) => p !== active && p !== pending),
  });
}

/** Postgres refusals that mean "somebody saved first", in words. */
function conflict(msg: string): string | null {
  if (/out of order|rift_search_revisions_one_number|duplicate key/.test(msg)) {
    return "Somebody saved a newer version of this brief while you were editing. Reload to see it, then make your change again";
  }
  return null;
}

/**
 * Save the brief as a new revision written by the agent.
 *
 * `expectedLatest` is the revision the editor was showing. The database
 * refuses anything but latest + 1, so two saves from the same starting point
 * produce one revision and one "reload".
 */
export async function saveAgentRevision(
  journeyId: string, brief: SearchBrief, expectedLatest: number, note: string | null, authorLabel: string,
): Promise<DbResult<{ revision: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const errors = briefErrors(brief);
  if (errors.length) return failed(errors[0]!);
  if (!Number.isInteger(expectedLatest) || expectedLatest < 0) return failed("reload the page and try again");

  const j = await journeyFor(journeyId);
  if (!j.ok || !("data" in j)) return j as DbResult<never>;
  if (!j.data) return failed("that journey is not in your book");
  if (j.data.side !== "buy") return failed("A search brief belongs to a buying journey");

  const revision = expectedLatest + 1;
  const wrote = await boundedWrite(
    db.from("rift_search_revisions").insert({
      agent_id: agentId, journey_id: journeyId, revision, schema_version: SEARCH_SCHEMA_VERSION,
      criteria: brief.criteria, questions: brief.questions,
      note: note?.trim().slice(0, 2000) || null, author_kind: "agent", author_label: authorLabel.slice(0, 120) || "Agent",
    }),
    "the brief",
  );
  if (!wrote.ok) return failed(conflict(wrote.error) ?? wrote.error);
  return done({ revision });
}

/**
 * Approve the latest revision as a Matrix search. The package is built and
 * hashed HERE, from the stored revision, never taken from the browser: what
 * was approved is what Rift built from what was saved.
 */
export async function approveRevision(
  journeyId: string, revisionId: string, cadence: Cadence, requestId: string, approvedBy: string,
): Promise<DbResult<{ packageId: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  if (!["instant", "daily", "weekly"].includes(cadence)) return failed("Choose how often Matrix sends listings");

  const state = await searchState(journeyId);
  if (!state.ok || !("data" in state)) return state as DbResult<never>;
  const latest = state.data.revisions[0];
  if (!latest) return failed("There is no brief to approve yet");
  if (latest.id !== revisionId) {
    return failed(`The brief changed while you were reviewing it. Revision ${latest.revision} is the latest; review that one`);
  }

  const built = buildPackage(latest.brief, latest.revision, cadence, state.data.disagreement);
  if (!built.ok) return failed(built.blockers[0]!);

  const r = await boundedWrite(
    db.rpc("rift_approve_search_package", {
      p_agent: agentId, p_journey: journeyId, p_revision: revisionId, p_cadence: cadence,
      p_package: built.pkg, p_hash: packageHash(built.pkg), p_by: approvedBy.slice(0, 120) || "Agent", p_request: requestId,
    }),
    "the approval",
  );
  if (!r.ok) return failed(/brief changed/.test(r.error) ? "The brief changed while you were reviewing it. Reload and review the latest revision" : r.error);
  return done({ packageId: ("data" in r ? r.data : null) as unknown as string });
}

/**
 * The agent's record that he set the approved search up in Matrix. This is
 * what makes the status "active", and the words everywhere say it was his
 * confirmation, because Rift cannot see Matrix (AT11).
 */
export async function recordActivation(
  packageId: string, ref: string | null, url: string | null, note: string | null, requestId: string,
): Promise<DbResult<{ packageId: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const cleanRef = ref?.trim().slice(0, 200) || null;
  let cleanUrl: string | null = null;
  if (url?.trim()) {
    try {
      const u = new URL(url.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") return failed("The link must start with https://");
      cleanUrl = u.href.slice(0, 500);
    } catch {
      return failed("That link does not look right");
    }
  }
  if (!cleanRef && !cleanUrl) return failed("Give the saved search's name in Matrix, or its link, so it can be found again");

  const r = await boundedWrite(
    db.rpc("rift_confirm_search_package", {
      p_agent: agentId, p_package: packageId, p_ref: cleanRef, p_url: cleanUrl,
      p_note: note?.trim().slice(0, 1000) || null, p_request: requestId,
    }),
    "the confirmation",
  );
  if (!r.ok) {
    if (/brief changed after you approved/.test(r.error)) {
      return failed("The brief changed after you approved this search. Review and approve the latest revision, then set that one up");
    }
    return r;
  }
  return done({ packageId });
}

/** Paused or running again in Matrix, as the agent recorded it. */
export async function setSearchPaused(packageId: string, paused: boolean): Promise<DbResult<{ paused: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const wrote = await boundedWrite(
    db.from("rift_search_packages").update({ status: paused ? "paused" : "active-confirmed" })
      .eq("id", packageId).eq("agent_id", agentId).eq("status", paused ? "active-confirmed" : "paused").select("id"),
    "the search",
  );
  if (!wrote.ok) return wrote;
  if (!((("data" in wrote ? wrote.data : null) as unknown[] | null)?.length)) return failed("That search is not running or paused any more. Reload");
  return done({ paused });
}

/**
 * A starting point from the buyer's readout, so they are not asked again what
 * they already told the calculator (REQ-LEAD-04). Every item comes back
 * UNDECIDED with its source and date: a price used in a cost calculation is
 * not yet a search limit, and the buyer confirms which it is.
 */
export async function readoutStart(leadId: string): Promise<DbResult<{ criteria: SearchCriterion[]; from: string } | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");

  const lead = await boundedRead(
    db.from("rift_leads").select("assessment_id,side,plan,plan_saved_at").eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "the relationship",
  );
  if (!lead.ok) return lead;
  const row = ("data" in lead ? lead.data : null) as { assessment_id: string | null; side: string; plan: SavedPlan | null; plan_saved_at: string | null } | null;
  if (!row || row.side !== "buy") return done(null);

  /* LEAD-04: a buyer who came through the values has a saved plan, not a
     readout. The plan is used when there is no readout, or when it is the
     newer of the two: the latest thing they told us is what the agent starts
     from, with its own date. */
  const fromPlan = row.plan ? briefStartFromPlan(row.plan) : null;
  if (!row.assessment_id) return done(fromPlan);

  const readout = await boundedRead(
    db.from("rift_readouts").select("inputs,created_at,side").eq("assessment_id", row.assessment_id).eq("agent_id", agentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "their readout",
  );
  if (!readout.ok) return readout;
  const snap = ("data" in readout ? readout.data : null) as { inputs: Record<string, unknown>; created_at: string; side: string } | null;
  if (!snap || snap.side !== "buy") return done(fromPlan);
  if (fromPlan && row.plan_saved_at && row.plan_saved_at > snap.created_at) return done(fromPlan);

  const on = snap.created_at.slice(0, 10);
  const from = `readout of ${on}`;
  const base = { strength: "undecided" as const, statedBy: "Their readout", statedAt: on, sourceRef: from };
  const criteria: SearchCriterion[] = [];
  const price = Number(snap.inputs.price);
  if (Number.isFinite(price) && price > 0) {
    criteria.push({ id: "readout-price", field: "price", operator: "atMost", value: Math.round(price), unit: "USD", ...base });
  }
  const county = typeof snap.inputs.county === "string" ? snap.inputs.county.trim() : "";
  if (county && county.length <= 60) {
    criteria.push({ id: "readout-county", field: "geography", operator: "oneOf", value: [`${county} County`], unit: null, ...base });
  }
  return done(criteria.length ? { criteria, from } : fromPlan);
}

export interface SearchRow {
  journeyId: string;
  status: SearchStatus;
  latest: number | null;
  updatedAt: string | null;
}

/**
 * The status of every buying journey's search, for the Operations list. Two
 * reads for the whole book rather than one per journey.
 */
export async function searchStatuses(journeyIds: string[]): Promise<DbResult<Map<string, SearchRow>>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const out = new Map<string, SearchRow>();
  if (journeyIds.length === 0) return done(out);

  const [revs, pkgs] = await Promise.all([
    boundedRead(
      db.from("rift_search_revisions").select("journey_id,revision,created_at")
        .eq("agent_id", agentId).in("journey_id", journeyIds).order("revision", { ascending: false }).limit(2000),
      "the briefs",
    ),
    boundedRead(
      db.from("rift_search_packages").select("journey_id,revision_id,status,package")
        .eq("agent_id", agentId).in("journey_id", journeyIds).in("status", ["manual-action-needed", "active-confirmed", "paused"]),
      "the Matrix searches",
    ),
  ]);
  if (!revs.ok) return journeyTablesMissing(revs.error) ? done(out) : revs;
  if (!pkgs.ok) return journeyTablesMissing(pkgs.error) ? done(out) : pkgs;

  const latest = new Map<string, { revision: number; at: string }>();
  for (const r of ("data" in revs ? revs.data : []) as { journey_id: string; revision: number; created_at: string }[]) {
    if (!latest.has(r.journey_id)) latest.set(r.journey_id, { revision: r.revision, at: r.created_at });
  }
  const live = new Map<string, { active?: { revision: number; status: "active-confirmed" | "paused" }; pending?: { revision: number } }>();
  for (const p of ("data" in pkgs ? pkgs.data : []) as { journey_id: string; status: string; package: SearchPackage }[]) {
    const e = live.get(p.journey_id) ?? {};
    if (p.status === "manual-action-needed") e.pending = { revision: p.package.revision };
    else e.active = { revision: p.package.revision, status: p.status as "active-confirmed" | "paused" };
    live.set(p.journey_id, e);
  }
  for (const id of journeyIds) {
    const l = latest.get(id);
    const e = live.get(id) ?? {};
    out.set(id, {
      journeyId: id,
      latest: l?.revision ?? null,
      updatedAt: l?.at ?? null,
      status: statusOf({ latest: l?.revision ?? null, active: e.active ?? null, pending: e.pending ?? null }),
    });
  }
  return done(out);
}
