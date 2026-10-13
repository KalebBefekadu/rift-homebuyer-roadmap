import { GEORGIA_TZ, dayIn } from "./day";
/**
 * What AI may cost, and whether a call may be made (Blueprint v5 §10.2,
 * decision D16, AUTO-06).
 *
 * One hard monthly limit across every AI use: $50 for the pilot, enforced
 * here in code rather than trusted to a dashboard somebody checks. Inside it,
 * each workflow has its own share (§10.2: "limits per workflow and per
 * month"), and the one a stranger can start has a daily ceiling too. A call is
 * made only when what has been spent plus a reserve for the call stays under
 * every limit that applies; otherwise the feature says so and the manual path
 * carries on (a failed or refused read leaves the form, DOC-02).
 *
 * Every call is recorded with its workflow, model, prompt version, tokens and
 * cost, and nothing about the person: the record is how the limit is kept,
 * not a log of what anybody sent.
 *
 * AI never produces a customer-facing number (AGENTS.md rule 1). The three
 * workflows here read a document for a person to check, compare two official
 * pages for a person to review, or draft a campaign's words for the agent to
 * edit and save (a drafted digit is dropped: lib/core/campaign-draft.ts).
 *
 * Pure: no I/O.
 */

export type AiWorkflow = "offer-extraction" | "program-compare" | "campaign-draft";
export const AI_WORKFLOWS: AiWorkflow[] = ["offer-extraction", "program-compare", "campaign-draft"];

/** What each workflow is called when it says it is unavailable. */
export const AI_LABEL: Record<AiWorkflow, string> = {
  "offer-extraction": "Automatic reading",
  "program-compare": "Automatic comparison",
  "campaign-draft": "Drafting with AI",
};

/** D16: $50 a month across all AI for the pilot. Raised by Kaleb, in code, on purpose. */
export const MONTHLY_LIMIT_CENTS = 5_000;

/**
 * Per million tokens, in cents, from Anthropic's published first-party
 * prices. A model not listed here cannot be called: an unpriced call is an
 * uncounted one.
 */
export const PRICE_CENTS_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5": { input: 500, output: 2_500, cacheRead: 50, cacheWrite: 625 },
  "claude-opus-4-8": { input: 500, output: 2_500, cacheRead: 50, cacheWrite: 625 },
  "claude-sonnet-5": { input: 200, output: 1_000, cacheRead: 20, cacheWrite: 250 },
  "claude-haiku-4-5": { input: 100, output: 500, cacheRead: 10, cacheWrite: 125 },
};

/** The model each workflow uses (D16: the smallest that does the job; offers need a larger one). */
export const MODEL_FOR: Record<AiWorkflow, string> = {
  "offer-extraction": "claude-opus-5",
  "program-compare": "claude-haiku-4-5",
  "campaign-draft": "claude-haiku-4-5",
};

/** Held back before a call, since its cost is only known afterwards. Generous on purpose. */
export const RESERVE_CENTS: Record<AiWorkflow, number> = {
  "offer-extraction": 150,
  "program-compare": 20,
  "campaign-draft": 10,
};

/**
 * Each workflow's share of the month (D41). They add up to the monthly limit.
 *
 * One shared pot meant the offer upload, the only AI anybody can start without
 * signing in, could spend the whole month, and the weekly program-page
 * comparison then stopped with it: a stranger's script switching off the
 * check that keeps assistance figures honest (audit 12 Oct §3 I). With shares,
 * the worst it can do is use up its own.
 */
export const SHARE_CENTS: Record<AiWorkflow, number> = {
  "offer-extraction": 3_000,
  "program-compare": 1_000,
  "campaign-draft": 1_000,
};

/**
 * A day's ceiling, on the public workflow only. A real offer read costs about
 * 20 cents, so $6 a day is far more than this business receives; a script
 * that gets past the upload pass spends at most this much before tomorrow,
 * and the share lasts the rest of the week for the people it is for.
 */
export const DAILY_CENTS: Partial<Record<AiWorkflow, number>> = {
  "offer-extraction": 600,
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** What a call cost, rounded up to the cent so the running total never under-counts. */
export function costCents(model: string, u: Usage): number {
  const p = PRICE_CENTS_PER_MTOK[model];
  if (!p) throw new Error(`no price recorded for ${model}; it cannot be used until one is`);
  const raw = (u.input_tokens * p.input + u.output_tokens * p.output
    + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1_000_000;
  return Math.ceil(raw);
}

export type Allowance =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "over-limit"; say: string };

/** What has been spent, in cents: this month in all, this month on the workflow, and today on it. */
export interface Spent { month: number; workflow: number; today: number }

/** Whether a call may be made now. The tightest limit decides, and the words say which kind. */
export function allowance(opts: { configured: boolean; spent: Spent; workflow: AiWorkflow; limitCents?: number }): Allowance {
  const { workflow, spent } = opts;
  const label = AI_LABEL[workflow];
  if (!opts.configured) return { ok: false, reason: "not-configured", say: `${label} is not switched on yet.` };
  const reserve = RESERVE_CENTS[workflow];
  const limit = opts.limitCents ?? MONTHLY_LIMIT_CENTS;
  if (spent.month + reserve > limit || spent.workflow + reserve > SHARE_CENTS[workflow]) {
    return { ok: false, reason: "over-limit", say: `${label} has reached this month's limit.` };
  }
  const daily = DAILY_CENTS[workflow];
  if (daily !== undefined && spent.today + reserve > daily) {
    return { ok: false, reason: "over-limit", say: `${label} has reached today's limit and starts again tomorrow.` };
  }
  return { ok: true };
}

/** The first moment of this calendar month in Georgia, for "spent this month". */
export function monthStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: GEORGIA_TZ, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  /* 04:00 UTC is midnight Eastern in summer and 11pm the evening before in
     winter. In winter that counts the last hour of the old month against the
     new one: the boundary can only tighten the limit, never loosen it. */
  return `${y}-${m}-01T04:00:00Z`;
}

/**
 * The first moment of today in Georgia, for "spent today". The same 04:00 UTC
 * boundary as monthStart, with the same direction of error.
 */
export function dayStart(now = new Date()): string {
  return `${dayIn(now, GEORGIA_TZ)}T04:00:00Z`;
}
