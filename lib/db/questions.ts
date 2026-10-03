import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { withTimeout } from "@/lib/core/timeout";
import { isUuid } from "@/lib/core/ids";
import { captureOpError } from "@/lib/monitoring/capture";
import {
  CODE_WORDING, cleanCustomAnswers, customFor, diffWording, mergedAsks, wordingErrors, wordingFromRows, wordingToRows,
  type CustomQuestion, type Wording,
} from "@/lib/core/question-wording";
import type { SavedPlan } from "@/lib/core/saved-plan";
import type { AskDef } from "@/lib/core/asks";
import type { InputKey, ValueDef } from "@/lib/core/values";

/**
 * The only reader and writer of the values' question wording, its versions
 * and the answers to the agent's own questions (D37). Rules:
 * lib/core/question-wording.ts. Migration 20260929400000.
 */

const MISSING = /rift_question|rift_custom_answers|question_version_id|does not exist|schema cache|rift_publish_questions/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export interface VersionSummary { id: string; version: number; note: string | null; by: string; at: string }

export interface PublishedWording {
  /** Null when nothing is published, or it could not be read: the code's own words. */
  versionId: string | null;
  version: number;
  wording: Wording;
  /** Why the code's words are shown instead of the published ones, when that is the case. */
  degraded: string | null;
}

const CODE: PublishedWording = { versionId: null, version: 0, wording: CODE_WORDING, degraded: null };

/**
 * A public page waits this long for the published words, then asks in the
 * code's. A visitor reads a question slightly differently worded; they never
 * see a page that failed because a wording table was slow. Shorter than the
 * read deadline because the fallback costs almost nothing.
 */
const PUBLIC_DEADLINE_MS = 1_200;
/** How long an instance reuses what it read: one query per page view is not needed for words that change a few times a year. */
const FRESH_MS = 20_000;
/** A failed read is retried sooner, and reported at most this often per instance. */
const RETRY_MS = 5_000;

let memo: { until: number; value: PublishedWording } | null = null;

/** Publishing on this instance shows the new words at once; others within FRESH_MS. */
export const forgetPublishedWording = () => { memo = null; };

async function latest(db: NonNullable<ReturnType<typeof serviceClient>>, agentId: string): Promise<DbResult<(VersionSummary & { wording: Wording }) | null>> {
  const v = await boundedRead(
    db.from("rift_question_versions").select("id,version,note,actor_label,created_at").eq("agent_id", agentId).order("version", { ascending: false }).limit(1).maybeSingle(),
    "the published questions",
  );
  if (!v.ok) return v;
  const row = ("data" in v ? v.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  return withRows(db, row);
}

async function withRows(db: NonNullable<ReturnType<typeof serviceClient>>, row: Record<string, unknown>): Promise<DbResult<VersionSummary & { wording: Wording }>> {
  const w = await boundedRead(
    db.from("rift_question_wordings").select("key,kind,type,title,why,unit,options,sides,value_ids,position,enabled").eq("version_id", row.id as string).limit(200),
    "the question wording",
  );
  if (!w.ok) return w;
  return done({ ...summary(row), wording: wordingFromRows(rows(w)) });
}

const summary = (r: Record<string, unknown>): VersionSummary => ({
  id: r.id as string, version: r.version as number, note: (r.note as string | null) ?? null, by: r.actor_label as string, at: r.created_at as string,
});

/**
 * The words a public page asks in. Never fails: a missing database, a
 * missing table, a timeout or an error all give the code's own wording, and
 * the page records that (a null version) as what the visitor saw.
 */
export async function publishedWording(): Promise<PublishedWording> {
  if (memo && Date.now() < memo.until) return memo.value;
  const keep = (value: PublishedWording, ms: number) => { memo = { until: Date.now() + ms, value }; return value; };

  const db = serviceClient();
  if (!db) return keep({ ...CODE, degraded: "no database configured" }, FRESH_MS);
  const read = async () => {
    const agentId = await currentAgentId();
    if (!agentId) return null;
    return latest(db, agentId);
  };
  const { value, timedOut } = await withTimeout(read(), PUBLIC_DEADLINE_MS, null);
  if (timedOut || !value) {
    const why = timedOut ? "the published questions did not load in time" : "no agent row to read questions for";
    if (timedOut) captureOpError(new Error(why), { op: "questions.public" });
    return keep({ ...CODE, degraded: why }, RETRY_MS);
  }
  if (!value.ok) {
    /* Before the migration there is simply nothing published. */
    if (MISSING.test(value.error)) return keep(CODE, FRESH_MS);
    captureOpError(new Error(value.error), { op: "questions.public" });
    return keep({ ...CODE, degraded: "the published questions did not load" }, RETRY_MS);
  }
  if (!("data" in value) || !value.data) return keep(CODE, FRESH_MS);
  return keep({ versionId: value.data.id, version: value.data.version, wording: value.data.wording, degraded: null }, FRESH_MS);
}

/** What a value page carries of the published wording. */
export interface ValueWording {
  defs: Partial<Record<InputKey, AskDef>>;
  custom: CustomQuestion[];
  versionId: string | null;
}

/**
 * What a value page needs from the published wording: its own questions in
 * the published words, the agent's questions for its side (the dialog narrows
 * them to the values in the plan), and the version to record on a lead.
 */
export async function valueWording(def: ValueDef): Promise<ValueWording> {
  const p = await publishedWording();
  return {
    defs: mergedAsks(p.wording, def.asks),
    custom: p.wording.custom.filter((q) => q.enabled && q.sides.includes(def.side)),
    versionId: p.versionId,
  };
}

async function scope() {
  const db = serviceClient();
  if (!db) return { db: null, agentId: null, why: "no database configured" } as const;
  const agentId = await currentAgentId();
  if (!agentId) return { db: null, agentId: null, why: "not signed in" } as const;
  return { db, agentId, why: null } as const;
}

/** Every published version, newest first. Null when the tables are not there yet. */
export async function questionVersions(): Promise<DbResult<VersionSummary[] | null>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const r = await boundedRead(
    s.db.from("rift_question_versions").select("id,version,note,actor_label,created_at").eq("agent_id", s.agentId).order("version", { ascending: false }).limit(200),
    "the question versions",
  );
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  return done(rows(r).map(summary));
}

/** One version's wording, for the agent. Null when there is no such version. */
export async function questionVersion(version: number): Promise<DbResult<(VersionSummary & { wording: Wording }) | null>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  if (!Number.isInteger(version) || version < 1) return done(null);
  const v = await boundedRead(
    s.db.from("rift_question_versions").select("id,version,note,actor_label,created_at").eq("agent_id", s.agentId).eq("version", version).maybeSingle(),
    "that version",
  );
  if (!v.ok) return MISSING.test(v.error) ? done(null) : v;
  const row = ("data" in v ? v.data : null) as Record<string, unknown> | null;
  return row ? withRows(s.db, row) : done(null);
}

export async function publishQuestions(input: { wording: Wording; expectedVersion: number; note: string | null; by: string; requestId: string }): Promise<DbResult<{ version: number }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  if (!isUuid(input.requestId)) return failed("That request could not be read; reload and publish again");
  const errors = wordingErrors(input.wording);
  if (errors.length) return failed(errors[0]!);
  const now = await latest(s.db, s.agentId);
  if (!now.ok) return MISSING.test(now.error) ? failed("Editing questions needs database migration 20260929400000") : now;
  const current = "data" in now && now.data ? now.data : null;
  if ((current?.version ?? 0) !== input.expectedVersion) {
    return failed(`Version ${current?.version ?? 0} was published since this page loaded. Reload to see it; your edits here are not saved`);
  }
  if (!diffWording(current?.wording ?? CODE_WORDING, input.wording).length) return failed("Nothing has changed since the published version");
  const version = input.expectedVersion + 1;
  const w = await boundedWrite(
    s.db.rpc("rift_publish_questions", {
      p_agent: s.agentId, p_version: version, p_note: input.note?.trim().slice(0, 300) || null,
      p_by: input.by.slice(0, 120), p_request: input.requestId, p_rows: wordingToRows(input.wording),
    }),
    "publishing the questions",
  );
  if (!w.ok) {
    if (/published since/.test(w.error)) return failed("Another version was published since this page loaded. Reload to see it; your edits here are not saved");
    return MISSING.test(w.error) ? failed("Editing questions needs database migration 20260929400000") : w;
  }
  forgetPublishedWording();
  return done({ version });
}

/** The version a lead saw, and their answers to the agent's own questions, for the lead record. */
export interface LeadQuestions {
  version: number | null;
  answers: { question: string; answer: string; version: number | null; at: string }[];
}

export async function leadQuestions(leadId: string): Promise<DbResult<LeadQuestions | null>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  if (!isUuid(leadId)) return done(null);
  const [lead, answers] = await Promise.all([
    boundedRead(s.db.from("rift_leads").select("question_version_id").eq("id", leadId).eq("agent_id", s.agentId).maybeSingle(), "the wording they saw"),
    boundedRead(s.db.from("rift_custom_answers").select("question,answer_label,version_id,created_at").eq("lead_id", leadId).eq("agent_id", s.agentId).order("created_at").limit(50), "their answers to your questions"),
  ]);
  for (const r of [lead, answers]) if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  const versionId = (("data" in lead ? lead.data : null) as { question_version_id: string | null } | null)?.question_version_id ?? null;
  const ids = [...new Set([versionId, ...rows(answers).map((a) => a.version_id as string)].filter((x): x is string => Boolean(x)))];
  const numbers = new Map<string, number>();
  if (ids.length) {
    const v = await boundedRead(s.db.from("rift_question_versions").select("id,version").in("id", ids), "the versions");
    if (!v.ok) return v;
    for (const r of rows(v)) numbers.set(r.id as string, r.version as number);
  }
  return done({
    version: versionId ? numbers.get(versionId) ?? null : null,
    answers: rows(answers).map((a) => ({ question: a.question as string, answer: a.answer_label as string, version: numbers.get(a.version_id as string) ?? null, at: a.created_at as string })),
  });
}

/**
 * The agent's own questions are answered once, soon after the plan is
 * saved, by whoever holds the plan's private link: the credential "delete
 * all of it" already accepts. A day, so a link forwarded weeks later cannot
 * add words to somebody's record.
 */
const ANSWER_WINDOW_MS = 24 * 3_600_000;

export async function recordCustomAnswers(token: string, raw: unknown): Promise<DbResult<{ saved: number }>> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return failed("That link is not one of ours");
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const l = await boundedRead(
    db.from("rift_leads").select("id,agent_id,plan,plan_saved_at,question_version_id").eq("plan_token", token).maybeSingle(),
    "the saved plan",
  );
  if (!l.ok) return MISSING.test(l.error) ? skipped("questions are not set up on this deployment") : l;
  const lead = ("data" in l ? l.data : null) as { id: string; agent_id: string; plan: SavedPlan | null; plan_saved_at: string | null; question_version_id: string | null } | null;
  if (!lead?.plan || !lead.plan_saved_at) return failed("That link is not one of ours");
  if (Date.now() - new Date(lead.plan_saved_at).getTime() > ANSWER_WINDOW_MS) return failed("These questions can only be answered on the day the plan is saved");
  if (!lead.question_version_id) return done({ saved: 0 });

  const w = await boundedRead(
    db.from("rift_question_wordings").select("key,kind,type,title,why,unit,options,sides,value_ids,position,enabled").eq("version_id", lead.question_version_id).eq("agent_id", lead.agent_id).limit(200),
    "the questions",
  );
  if (!w.ok) return w;
  /* Only what this person was asked: the version their page showed, their
     side, the values in their plan. */
  const asked = customFor(wordingFromRows(rows(w)), lead.plan.side, lead.plan.values.map((v) => v.tool));
  const answers = cleanCustomAnswers(asked, raw);
  if (!answers.length) return done({ saved: 0 });
  const ins = await boundedWrite(
    db.from("rift_custom_answers").upsert(answers.map((a) => ({
      agent_id: lead.agent_id, lead_id: lead.id, version_id: lead.question_version_id,
      question_key: a.key, question: a.question, answer: a.answer, answer_label: a.label,
    })), { onConflict: "lead_id,question_key", ignoreDuplicates: true }),
    "your answers",
  );
  if (!ins.ok) return ins;
  return done({ saved: answers.length });
}
