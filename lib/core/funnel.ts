/**
 * Rift prototype — editable funnels.
 *
 * The agent can reword, reorder, hide and extend the questions a visitor is
 * asked. What he cannot do is break the arithmetic, and that constraint is the
 * whole design of this file.
 *
 * Two classes of question:
 *
 *   CORE    — bound to a field the compute engine reads (`bound`). The wording,
 *             help text, order and option LABELS are the agent's. The option
 *             VALUES and the field binding are not, because cashToClose() and
 *             matchPrograms() read them. Core questions can be reworded and
 *             moved; a required one cannot be removed, because removing it
 *             would silently produce a wrong number rather than no number.
 *
 *   CUSTOM  — anything the agent invents. Captured onto the lead record and
 *             shown to him in Studio. Never feeds a calculation, so it can
 *             never make a figure wrong. This is the escape hatch, and keeping
 *             it inert is what makes the escape hatch safe.
 *
 * That split is the reason this feature is cheap rather than dangerous.
 */

export type FieldType = "choice" | "slider" | "select" | "text" | "boolean";

export interface Option {
  label: string;
  /** Machine value. Editable only on custom questions. */
  value: string;
}

export interface Question {
  id: string;
  kind: "core" | "custom";
  type: FieldType;
  /** The compute field this writes to. null on custom questions, always. */
  bound: string | null;
  /** Shown as the question. The agent's words. */
  title: string;
  /** Optional second line explaining why we ask. Converts better than nothing. */
  description?: string;
  /** Small grey label above the question. */
  topic: string;
  options?: Option[];
  /** Short label beside a slider's value. The section topic is not a label. */
  fieldLabel?: string;
  /** "$" formats as money; anything else is appended to the number. */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Placeholder for text questions. */
  placeholder?: string;
  /** Required questions cannot be switched off. */
  required: boolean;
  enabled: boolean;
}

export interface Change {
  at: string;
  what: string;
}

export interface Funnel {
  side: "buy" | "sell";
  name: string;
  /**
   * Bumped on every save. A lead stores the version it answered, because a
   * readout produced under v3 has to keep making sense after the agent ships
   * v5 — otherwise last Tuesday's answers get silently reinterpreted against
   * questions that person was never asked.
   */
  version: number;
  updatedAt: string;
  /** Newest first, capped. Enough to answer "what changed and when". */
  changes: Change[];
  questions: Question[];
}

/* ------------------------------------------------------------------ *
 * Defaults — what ships before the agent touches anything
 * ------------------------------------------------------------------ */

export const BUY_FUNNEL: Funnel = {
  side: "buy",
  name: "Buyer readiness",
  version: 1,
  updatedAt: "2026-08-14",
  changes: [{ at: "2026-08-14", what: "Shipped" }],
  questions: [
    {
      id: "timing", kind: "core", type: "choice", bound: "timing", topic: "Your goal",
      title: "When would you like to be in a home?",
      required: true, enabled: true,
      options: [
        { label: "In the next 3 months", value: "In the next 3 months" },
        { label: "3 to 9 months", value: "3 to 9 months" },
        { label: "9 to 18 months", value: "9 to 18 months" },
        { label: "Just exploring", value: "Just exploring" },
      ],
    },
    {
      id: "county", kind: "core", type: "select", bound: "county", topic: "Your goal",
      title: "Which Georgia county are you looking in?",
      description: "Assistance programs are county-specific. This is the question that unlocks the most money.",
      required: true, enabled: true,
    },
    {
      id: "ownership", kind: "core", type: "choice", bound: "ownership", topic: "Your goal",
      title: "Have you owned a home in the last three years?",
      description: "Most programs only count a home you lived in. An investment property is a different question, and the answer is program by program.",
      required: true, enabled: true,
      options: [
        { label: "No, I haven't owned anything", value: "none" },
        { label: "Yes — it was where I lived", value: "primary" },
        { label: "Yes — but it was a rental or investment property", value: "investment" },
      ],
    },
    {
      id: "price", kind: "core", type: "slider", fieldLabel: "Target price", unit: "$", bound: "price", topic: "The numbers",
      title: "What price range are you thinking about?",
      min: 0, max: 700_000, step: 5_000, required: true, enabled: true,
    },
    {
      id: "savings", kind: "core", type: "slider", fieldLabel: "Saved so far", unit: "$", bound: "savings", topic: "The numbers",
      title: "How much do you have saved for this?",
      description: "The gap between your savings and what closing actually costs is what decides your timeline. We never share this.",
      min: 0, max: 120_000, step: 500, required: true, enabled: true,
    },
    {
      id: "rate", kind: "core", type: "slider", fieldLabel: "Each month", unit: "$", bound: "monthlySaving", topic: "The numbers",
      title: "How much can you put aside each month?",
      min: 0, max: 3_000, step: 50, required: true, enabled: true,
    },
    {
      id: "who", kind: "core", type: "text", bound: "who", topic: "Your household",
      title: "Is anyone else part of this decision?",
      description: "The person who didn't answer these questions is usually the one who stalls it. Better to bring them in now.",
      placeholder: "Their name", required: false, enabled: true,
    },
  ],
};

export const SELL_FUNNEL: Funnel = {
  side: "sell",
  name: "Seller reality",
  version: 1,
  updatedAt: "2026-08-14",
  changes: [{ at: "2026-08-14", what: "Shipped" }],
  questions: [
    {
      id: "timing", kind: "core", type: "choice", bound: "timing", topic: "Your goal",
      title: "When would you like to have sold?",
      required: true, enabled: true,
      options: [
        { label: "In the next 3 months", value: "In the next 3 months" },
        { label: "3 to 9 months", value: "3 to 9 months" },
        { label: "9 to 18 months", value: "9 to 18 months" },
        { label: "Just exploring", value: "Just exploring" },
      ],
    },
    {
      id: "county", kind: "core", type: "select", bound: "county", topic: "Your goal",
      title: "Which county is the home in?",
      description: "Transfer tax, exemptions and appeal deadlines are all county-level.",
      required: true, enabled: true,
    },
    {
      id: "price", kind: "core", type: "slider", fieldLabel: "Likely sale price", unit: "$", bound: "price", topic: "The numbers",
      title: "What do you think it would sell for?",
      min: 100_000, max: 1_200_000, step: 5_000, required: true, enabled: true,
    },
    {
      id: "payoff", kind: "core", type: "slider", fieldLabel: "Still owed", unit: "$", bound: "payoff", topic: "The numbers",
      title: "How much do you still owe on it?",
      min: 0, max: 900_000, step: 5_000, required: true, enabled: true,
    },
    {
      id: "owned", kind: "core", type: "slider", fieldLabel: "Years owned", unit: "years", bound: "yearsOwned", topic: "The numbers",
      title: "How long have you owned it?",
      description: "This decides whether the capital gains exclusion applies, and whether exemptions you never filed are worth chasing.",
      min: 0, max: 40, step: 1, required: true, enabled: true,
    },
    {
      id: "who", kind: "core", type: "text", bound: "who", topic: "Your household",
      title: "Is anyone else part of this decision?",
      placeholder: "Their name", required: false, enabled: true,
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Ownership — the nuance the old yes/no question flattened
 * ------------------------------------------------------------------ */

export type Ownership = "none" | "primary" | "investment";

/**
 * Georgia first-time-buyer definitions almost always turn on an ownership
 * interest in a PRIMARY RESIDENCE within three years. A rental or investment
 * property frequently does not disqualify — but "frequently" is not "never",
 * and it varies by administrator. So we match optimistically and say plainly
 * that a lender decides.
 */
export function firstTimeFrom(o: Ownership) {
  return o !== "primary";
}

/**
 * How an ownership answer reads back to the person who gave it.
 *
 * Lives here rather than inline in a page because two surfaces render it and a
 * third will: the readout, the share link, and eventually the email. Three
 * copies of the same phrasing is three chances for one of them to describe
 * somebody's situation slightly wrong.
 */
export const OWN_LABEL: Record<Ownership, string> = {
  none: "no home owned in three years",
  primary: "owned a home you lived in",
  investment: "owned an investment property only",
};

export const OWNERSHIP_CAVEAT: Record<Ownership, string | null> = {
  none: null,
  primary: null,
  investment:
    "You owned an investment property. Most Georgia programs only count a home you lived in, so we have matched you as a first-time buyer — but this is exactly the kind of thing a program administrator decides case by case. Ask a participating lender before you count on it.",
};

/* ------------------------------------------------------------------ *
 * Editing
 * ------------------------------------------------------------------ */

export function canRemove(q: Question) {
  return q.kind === "custom" || !q.required;
}

export function newCustom(topic = "About you"): Question {
  return {
    id: `custom-${Math.random().toString(36).slice(2, 8)}`,
    kind: "custom", type: "choice", bound: null, topic,
    title: "", description: "", required: false, enabled: true,
    options: [{ label: "", value: "opt-1" }, { label: "", value: "opt-2" }],
  };
}

export function move(qs: Question[], id: string, dir: -1 | 1): Question[] {
  const i = qs.findIndex((q) => q.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= qs.length) return qs;
  const out = [...qs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
