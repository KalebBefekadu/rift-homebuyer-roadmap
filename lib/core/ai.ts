/**
 * What AI may cost, and whether a call may be made (Blueprint v5 §10.2,
 * decision D16, AUTO-06).
 *
 * One hard monthly limit across every AI use: $50 for the pilot, enforced
 * here in code rather than trusted to a dashboard somebody checks. A call is
 * made only when what has been spent this month plus a reserve for the call
 * stays under the limit; otherwise the feature says so and the manual path
 * carries on (a failed or refused read leaves the form, DOC-02).
 *
 * Every call is recorded with its workflow, model, prompt version, tokens and
 * cost, and nothing about the person: the record is how the limit is kept,
 * not a log of what anybody sent.
 *
 * AI never produces a customer-facing number (AGENTS.md rule 1). The two
 * workflows here read a document for a person to check, or compare two
 * official pages for a person to review.
 *
 * Pure: no I/O.
 */

export type AiWorkflow = "offer-extraction" | "program-compare";
export const AI_WORKFLOWS: AiWorkflow[] = ["offer-extraction", "program-compare"];

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
};

/** Held back before a call, since its cost is only known afterwards. Generous on purpose. */
export const RESERVE_CENTS: Record<AiWorkflow, number> = {
  "offer-extraction": 150,
  "program-compare": 20,
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

/** Whether a call may be made now. */
export function allowance(opts: { configured: boolean; spentCents: number; workflow: AiWorkflow; limitCents?: number }): Allowance {
  if (!opts.configured) return { ok: false, reason: "not-configured", say: "Automatic reading is not switched on yet." };
  const limit = opts.limitCents ?? MONTHLY_LIMIT_CENTS;
  if (opts.spentCents + RESERVE_CENTS[opts.workflow] > limit) {
    return { ok: false, reason: "over-limit", say: "Automatic reading has reached this month's limit." };
  }
  return { ok: true };
}

/** The first moment of this calendar month in Georgia, for "spent this month". */
export function monthStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  /* 04:00 UTC is midnight Eastern in summer and 11pm the evening before in
     winter. In winter that counts the last hour of the old month against the
     new one: the boundary can only tighten the limit, never loosen it. */
  return `${y}-${m}-01T04:00:00Z`;
}
