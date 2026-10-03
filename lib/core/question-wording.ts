/**
 * The words of the values' questions as the agent publishes them (D37), laid
 * over the code's own (lib/core/asks.ts), and the agent's own questions.
 *
 * Two kinds of change are possible and they are kept apart on purpose:
 *
 * WORDING of a built-in question: its title, the "why we ask" line, the label
 * beside a money figure, and the label and hint of each choice. Never its
 * type, its choice values, its limits, its fallback or the answer it feeds.
 * Those decide what a figure is computed from, and a wording editor that could
 * reach them would let a label change move somebody's cash to close. So the
 * merge below copies words and nothing else, and it copies them by option
 * VALUE, so a relabelled "3.5%" still sends 3.5 to the compute.
 *
 * CUSTOM questions: the agent's own, optional, asked after a plan is saved.
 * They feed nothing (rule 5). The type says so (`bound?: never`, and a key
 * that starts `x_`, which no InputKey does) and so does the database
 * (`custom_questions_are_inert`, `custom_keys_cannot_name_an_input`).
 *
 * Everything here arrives from a form, so `cleanWording` rebuilds it field
 * by field rather than trusting its shape, the same rule as a saved plan.
 *
 * Pure: no React, no I/O.
 */

import { ASKS, type AskDef } from "./asks";
import { VALUES, type InputKey, type ValueSide } from "./values";

export const QUESTION_SIDES: { id: ValueSide; label: string }[] = [
  { id: "buy", label: "Buyers" },
  { id: "sell", label: "Sellers" },
  { id: "abroad", label: "Buying from abroad" },
];

export const LIMITS = {
  title: { min: 3, max: 160 },
  why: 300,
  unit: 40,
  optionLabel: 80,
  hint: 80,
  note: 300,
  /** More than this and the saved dialog becomes a second form. */
  custom: 6,
  customOptions: { min: 2, max: 8 },
  textAnswer: 300,
} as const;

/** The words of one built-in question. Nothing a figure is computed from. */
export interface BuiltinWording {
  title: string;
  why: string | null;
  /** Money questions only: the label beside the figure. */
  unitLabel: string | null;
  /** Choice questions whose labels may change (see `optionsEditable`), matched by value. */
  options: { value: string; label: string; hint: string | null }[];
}

/** No InputKey starts with `x_`, so a custom key can never be mistaken for one. */
export type CustomKey = `x_${string}`;
export const CUSTOM_KEY = /^x_[a-z0-9]{6,24}$/;
const OPTION_VALUE = /^[a-z0-9]{1,16}$/;

export interface CustomQuestion {
  key: CustomKey;
  type: "choice" | "text";
  title: string;
  why: string | null;
  /** Choice only. The value is an id that never changes, so a relabel keeps its answers. */
  options: { value: string; label: string }[];
  sides: ValueSide[];
  /** Asked only when the saved plan holds one of these values; empty means any on its sides. */
  values: string[];
  enabled: boolean;
  /** A custom question feeds no compute input, ever (rule 5). */
  bound?: never;
}

export interface Wording {
  /** Only the questions whose words differ from the code's. */
  builtin: Partial<Record<InputKey, BuiltinWording>>;
  /** In the order a visitor is asked them. */
  custom: CustomQuestion[];
}

export const CODE_WORDING: Wording = { builtin: {}, custom: [] };

export const INPUT_KEYS = Object.keys(ASKS) as InputKey[];

/**
 * County's labels are the county names the programs and tax tables are
 * matched on; renaming "Fulton" would show a visitor a county that is not the
 * one computed. Every other choice question's labels are words.
 */
export const optionsEditable = (key: InputKey) => ASKS[key].type === "choice" && key !== "county";

/** The code's words for a question, in the same shape as an edit. */
export function codeWording(key: InputKey): BuiltinWording {
  const a = ASKS[key];
  return {
    title: a.title,
    why: a.why ?? null,
    unitLabel: a.type === "money" ? a.unitLabel ?? null : null,
    options: optionsEditable(key) ? (a.options ?? []).map((o) => ({ value: o.value, label: o.label, hint: o.hint ?? null })) : [],
  };
}

export const wordingOf = (w: Wording, key: InputKey): BuiltinWording => w.builtin[key] ?? codeWording(key);

const sameBuiltin = (a: BuiltinWording, b: BuiltinWording) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A question as a visitor sees it: the code's definition with only the words
 * replaced. Type, param, choice values, slider, limits and fallback always
 * come from the code.
 */
export function mergeAsk(key: InputKey, w: Wording): AskDef {
  const def = ASKS[key];
  const bw = w.builtin[key];
  if (!bw) return def;
  const merged: AskDef = { ...def, title: bw.title };
  if (bw.why) merged.why = bw.why; else delete merged.why;
  if (def.type === "money" && bw.unitLabel) merged.unitLabel = bw.unitLabel;
  if (def.options && optionsEditable(key)) {
    merged.options = def.options.map((o) => {
      const x = bw.options.find((p) => p.value === o.value);
      if (!x) return o;
      return x.hint ? { value: o.value, label: x.label, hint: x.hint } : { value: o.value, label: x.label };
    });
  }
  return merged;
}

/** The questions a page asks, as published. */
export function mergedAsks(w: Wording, keys: readonly InputKey[] = INPUT_KEYS): Partial<Record<InputKey, AskDef>> {
  const out: Partial<Record<InputKey, AskDef>> = {};
  for (const k of keys) out[k] = mergeAsk(k, w);
  return out;
}

const text = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const orNull = (s: string) => (s ? s : null);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Rebuilds wording from anything: a form, a stored row, an old version.
 * Unknown keys, option values the code does not have, and any field that is
 * not a word are dropped rather than refused, so a version saved before a
 * release removed an option still loads. A built-in edit identical to the
 * code's words is dropped too: it is not an edit, and keeping it would pin
 * the question to today's words when a release improves them.
 */
export function cleanWording(raw: unknown): Wording {
  const r = obj(raw);
  const b = obj(r.builtin);
  const builtin: Partial<Record<InputKey, BuiltinWording>> = {};
  for (const key of INPUT_KEYS) {
    if (!(key in b)) continue;
    const x = obj(b[key]);
    const code = codeWording(key);
    const given = Array.isArray(x.options) ? x.options.map(obj) : [];
    const bw: BuiltinWording = {
      /* An emptied title means "the code's", never a blank question. */
      title: text(x.title, LIMITS.title.max) || code.title,
      why: "why" in x ? orNull(text(x.why, LIMITS.why)) : code.why,
      unitLabel: ASKS[key].type === "money" ? orNull(text(x.unitLabel, LIMITS.unit)) ?? code.unitLabel : null,
      options: code.options.map((o) => {
        const p = given.find((g) => g.value === o.value);
        if (!p) return o;
        return { value: o.value, label: text(p.label, LIMITS.optionLabel) || o.label, hint: "hint" in p ? orNull(text(p.hint, LIMITS.hint)) : o.hint };
      }),
    };
    if (!sameBuiltin(bw, code)) builtin[key] = bw;
  }

  const custom: CustomQuestion[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.custom) ? r.custom : []) {
    if (custom.length >= LIMITS.custom) break;
    const x = obj(item);
    const key = typeof x.key === "string" ? x.key : "";
    if (!CUSTOM_KEY.test(key) || seen.has(key)) continue;
    seen.add(key);
    const type = x.type === "text" ? "text" : "choice";
    const sides = QUESTION_SIDES.map((s) => s.id).filter((s) => Array.isArray(x.sides) && x.sides.includes(s));
    const values = Array.isArray(x.values)
      ? [...new Set(x.values.filter((v): v is string => typeof v === "string"))].filter((id) => VALUES.some((v) => v.id === id && v.live && sides.includes(v.side)))
      : [];
    const optSeen = new Set<string>();
    const options = type === "choice" && Array.isArray(x.options)
      ? x.options.map(obj).flatMap((o) => {
        const value = typeof o.value === "string" && OPTION_VALUE.test(o.value) ? o.value : "";
        if (!value || optSeen.has(value)) return [];
        optSeen.add(value);
        return [{ value, label: text(o.label, LIMITS.optionLabel) }];
      }).slice(0, LIMITS.customOptions.max)
      : [];
    /* Built field by field: a `bound`, a `param` or anything else sent with
       it never reaches the stored question. */
    custom.push({ key: key as CustomKey, type, title: text(x.title, LIMITS.title.max), why: orNull(text(x.why, LIMITS.why)), options, sides, values, enabled: x.enabled !== false });
  }
  return { builtin, custom };
}

/** What stops a set of wording being published, in words. */
export function wordingErrors(w: Wording): string[] {
  const errors: string[] = [];
  for (const [key, bw] of Object.entries(w.builtin) as [InputKey, BuiltinWording][]) {
    if (bw.title.length < LIMITS.title.min) errors.push(`"${ASKS[key].title}" needs a question of at least ${LIMITS.title.min} characters`);
    if (bw.options.some((o) => !o.label)) errors.push(`Every choice in "${bw.title}" needs a label`);
    const labels = bw.options.map((o) => o.label.toLowerCase());
    if (new Set(labels).size !== labels.length) errors.push(`Two choices in "${bw.title}" read the same`);
  }
  if (w.custom.length > LIMITS.custom) errors.push(`At most ${LIMITS.custom} of your own questions`);
  w.custom.forEach((q, i) => {
    const name = q.title ? `"${q.title}"` : `Your question ${i + 1}`;
    if (q.title.length < LIMITS.title.min) errors.push(`${name} needs a question of at least ${LIMITS.title.min} characters`);
    if (!q.sides.length) errors.push(`${name} needs at least one side that asks it`);
    if (q.type === "choice") {
      if (q.options.length < LIMITS.customOptions.min) errors.push(`${name} needs at least ${LIMITS.customOptions.min} choices`);
      if (q.options.some((o) => !o.label)) errors.push(`Every choice in ${name} needs a label`);
      const labels = q.options.map((o) => o.label.toLowerCase());
      if (new Set(labels).size !== labels.length) errors.push(`Two choices in ${name} read the same`);
    }
  });
  return errors;
}

export interface Change {
  /** The question, in the words it had before (or now, when it is new). */
  question: string;
  what: string;
  from?: string;
  to?: string;
}

const show = (s: string | null) => s ?? "(none)";
const SIDE_LABEL = Object.fromEntries(QUESTION_SIDES.map((s) => [s.id, s.label])) as Record<ValueSide, string>;
const valueName = (id: string) => VALUES.find((v) => v.id === id)?.name ?? id;
const audience = (q: CustomQuestion) =>
  `${q.sides.map((s) => SIDE_LABEL[s]).join(", ")}${q.values.length ? `, when their plan has ${q.values.map(valueName).join(" or ")}` : ""}`;

/** Every difference between two versions, as the agent reads it before publishing. */
export function diffWording(from: Wording, to: Wording): Change[] {
  const out: Change[] = [];
  for (const key of INPUT_KEYS) {
    const a = wordingOf(from, key), b = wordingOf(to, key);
    if (sameBuiltin(a, b)) continue;
    const question = a.title;
    if (a.title !== b.title) out.push({ question, what: "Question", from: a.title, to: b.title });
    if (a.why !== b.why) out.push({ question, what: "Why we ask", from: show(a.why), to: show(b.why) });
    if (a.unitLabel !== b.unitLabel) out.push({ question, what: "Label beside the amount", from: show(a.unitLabel), to: show(b.unitLabel) });
    for (const o of b.options) {
      const p = a.options.find((x) => x.value === o.value);
      if (!p) continue;
      if (p.label !== o.label) out.push({ question, what: "Choice", from: p.label, to: o.label });
      if (p.hint !== o.hint) out.push({ question, what: `Hint under "${o.label}"`, from: show(p.hint), to: show(o.hint) });
    }
  }

  const before = new Map(from.custom.map((q) => [q.key, q]));
  const after = new Map(to.custom.map((q) => [q.key, q]));
  for (const q of from.custom) if (!after.has(q.key)) out.push({ question: q.title, what: "Removed" });
  for (const q of to.custom) {
    const p = before.get(q.key);
    if (!p) { out.push({ question: q.title, what: "Added", to: `${q.type === "text" ? "Short answer" : `${q.options.length} choices`}, asked of ${audience(q)}${q.enabled ? "" : ", off"}` }); continue; }
    const question = p.title;
    if (p.title !== q.title) out.push({ question, what: "Question", from: p.title, to: q.title });
    if (p.why !== q.why) out.push({ question, what: "Why we ask", from: show(p.why), to: show(q.why) });
    if (p.type !== q.type) out.push({ question, what: "Kind of answer", from: p.type === "text" ? "Short answer" : "Choice", to: q.type === "text" ? "Short answer" : "Choice" });
    const pl = p.options.map((o) => o.label).join(" / "), ql = q.options.map((o) => o.label).join(" / ");
    if (pl !== ql) out.push({ question, what: "Choices", from: pl || "(none)", to: ql || "(none)" });
    if (audience(p) !== audience(q)) out.push({ question, what: "Who is asked", from: audience(p), to: audience(q) });
    if (p.enabled !== q.enabled) out.push({ question, what: q.enabled ? "Turned back on" : "Turned off" });
  }
  /* Order among the questions both versions have: a new one appearing
     between two others is not a move. */
  const common = (list: CustomQuestion[]) => list.filter((q) => before.has(q.key) && after.has(q.key)).map((q) => q.key);
  const was = common(from.custom), now = common(to.custom);
  if (was.join() !== now.join()) out.push({ question: "Your questions", what: "Order", from: was.map((k) => before.get(k)!.title).join(", "), to: now.map((k) => after.get(k)!.title).join(", ") });
  return out;
}

/** The agent's questions a person saving a plan on this side is asked. */
export function customFor(w: Wording, side: ValueSide, planValues: readonly string[]): CustomQuestion[] {
  return w.custom.filter((q) => q.enabled && q.sides.includes(side) && (!q.values.length || q.values.some((v) => planValues.includes(v))));
}

export interface CustomAnswer {
  key: CustomKey;
  /** The question and the answer in the words they were shown, not a reference to them. */
  question: string;
  answer: string;
  label: string;
}

/**
 * The answers a visitor sent, kept only when each is to a question they were
 * asked and says something one of its choices says. Nothing here is ever an
 * Answers entry: these never reach a compute (rule 5).
 */
export function cleanCustomAnswers(asked: readonly CustomQuestion[], raw: unknown): CustomAnswer[] {
  const r = obj(raw);
  const out: CustomAnswer[] = [];
  for (const q of asked) {
    const v = r[q.key];
    if (q.type === "choice") {
      const o = q.options.find((x) => x.value === v);
      if (o) out.push({ key: q.key, question: q.title, answer: o.value, label: o.label });
    } else {
      const t = text(v, LIMITS.textAnswer);
      if (t) out.push({ key: q.key, question: q.title, answer: t, label: t });
    }
  }
  return out;
}

/** A row of rift_question_wordings, as the publish command takes it. */
export interface WordingRow {
  key: string;
  kind: "builtin" | "custom";
  bound: string | null;
  type: "choice" | "money" | "text";
  title: string;
  why: string | null;
  unit: string | null;
  options: { value: string; label: string; hint?: string | null }[];
  sides: string[];
  value_ids: string[];
  position: number;
  enabled: boolean;
}

export function wordingToRows(w: Wording): WordingRow[] {
  const rows: WordingRow[] = [];
  for (const [key, bw] of Object.entries(w.builtin) as [InputKey, BuiltinWording][]) {
    rows.push({ key, kind: "builtin", bound: key, type: ASKS[key].type, title: bw.title, why: bw.why, unit: bw.unitLabel, options: bw.options, sides: [], value_ids: [], position: 0, enabled: true });
  }
  w.custom.forEach((q, i) => rows.push({
    key: q.key, kind: "custom", bound: null, type: q.type, title: q.title, why: q.why, unit: null,
    options: q.options, sides: q.sides, value_ids: q.values, position: i, enabled: q.enabled,
  }));
  return rows;
}

export function wordingFromRows(rows: readonly Record<string, unknown>[]): Wording {
  const builtin: Record<string, unknown> = {};
  const custom: { position: number; q: Record<string, unknown> }[] = [];
  for (const r of rows) {
    if (r.kind === "builtin" && typeof r.key === "string") {
      builtin[r.key] = { title: r.title, why: r.why ?? null, unitLabel: r.unit ?? null, options: r.options ?? [] };
    } else if (r.kind === "custom") {
      custom.push({ position: Number(r.position ?? 0), q: { key: r.key, type: r.type, title: r.title, why: r.why ?? null, options: r.options ?? [], sides: r.sides ?? [], values: r.value_ids ?? [], enabled: r.enabled !== false } });
    }
  }
  return cleanWording({ builtin, custom: custom.sort((a, b) => a.position - b.position).map((c) => c.q) });
}

/**
 * What each answer feeds, said to the agent beside the words he can change,
 * so it is plain why the rest is locked. Descriptive only: the compute reads
 * lib/core/asks.ts and lib/core/compute.ts, never this.
 */
export const FEEDS: Record<InputKey, string> = {
  county: "programs, property taxes and closing fees",
  ownership: "first-time buyer status for programs",
  price: "the loan, cash to close, monthly cost and timeline",
  downPct: "the down payment, loan size and mortgage insurance",
  savings: "how far they are from ready",
  monthlySaving: "how many months until they are ready",
  income: "program income limits and what fits",
  household: "program income limits, which rise with household size",
  credit: "program credit minimums",
  occupation: "programs for particular jobs",
  loanType: "which loan's rules apply",
  debts: "what fits, through the debt-to-income guideline",
  comfort: "what fits: the price their payment reaches",
  salePrice: "every seller figure: commission, costs and what they keep",
  payoff: "what they keep after the loan is paid off",
  commission: "selling costs and what they keep",
  yearsOwned: "exemptions and appeal deadlines",
  homestead: "exemptions they may be missing",
  age65: "senior exemptions",
  roof: "what to fix before listing",
  systems: "what to fix before listing",
  finish: "what to fix before listing",
  status: "what they can own, finance and close from abroad",
  use: "costs and return: living in it or renting it out",
};

/** The live values on a side that ask a built-in question, in D20 order. */
export const askedBy = (key: InputKey, side: ValueSide) => VALUES.filter((v) => v.live && v.side === side && v.asks.includes(key));

/** Each built-in question a side asks, once, in the order its values first ask it. */
export const sideKeys = (side: ValueSide): InputKey[] =>
  [...new Set(VALUES.filter((v) => v.live && v.side === side).flatMap((v) => v.asks))];
