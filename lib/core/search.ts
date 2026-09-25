/**
 * The buyer's search brief, and the package the agent sets up in Matrix.
 *
 * Blueprint v4 §5 and journey contract B04. Kaleb named the work that repeats
 * most: translating what a buyer says into a Matrix/OneHome search, and then
 * redoing it every time they change their mind. This module is the part of
 * that which can be pure: what a criterion is allowed to say, what changed
 * between two versions, what cannot be approved yet, and what the agent
 * actually has to type into Matrix.
 *
 * Four rules carry most of the weight:
 *
 * A PREFERENCE IS NOT A FILTER. "Basement strongly preferred" excludes nothing.
 * Only a criterion the buyer called a requirement (`hard`) becomes a search
 * filter, and `undecided` blocks approval until somebody decides.
 *
 * THE PACKAGE SAYS HOW WELL EACH FILTER WORKS. Price and bedrooms are exact.
 * City boundaries, basements and HOA fees depend on how listings were entered,
 * so they are marked approximate. "Not on a major road" is not a field at all:
 * it becomes a manual check on every listing, never a silent omission.
 *
 * NOTHING HERE CLAIMS A SEARCH IS RUNNING. Rift has no write access to Matrix.
 * `statusOf` only reports "active" when the agent has recorded that he set it
 * up, and the words say it was confirmed by him rather than by Matrix.
 *
 * PLACES AND PROPERTY, NOT PEOPLE. A criterion describes a home or a place the
 * buyer chose. Wording about who lives nearby, school rankings or crime is
 * refused with an explanation (`refusedWording`), including inside free text,
 * so the free-text field is not a way around it.
 */

import { money } from "./compute";

export const SEARCH_SCHEMA_VERSION = 1;

export type Strength = "hard" | "preference" | "undecided";
export type Field =
  | "price" | "bedrooms" | "bathrooms" | "propertyType" | "geography"
  | "basement" | "garage" | "lotSize" | "hoa" | "otherPropertyAttribute";
export type Operator = "equals" | "atLeast" | "atMost" | "oneOf" | "avoids";
export type Unit = "USD" | "count" | "acres" | "USD/month" | "code" | null;

export interface SearchCriterion {
  id: string;
  field: Field;
  operator: Operator;
  value: string | number | string[];
  unit: Unit;
  strength: Strength;
  /** Who said it: "Kaleb", "Devon (buyer)", "Their readout". */
  statedBy: string;
  /** ISO date the buyer said it, not the date it was typed in. */
  statedAt: string;
  /** Where it came from: "call on 20 Sep", "client form", "readout of 3 Sep". */
  sourceRef: string;
}

export interface SearchBrief {
  criteria: SearchCriterion[];
  /** Things nobody has answered yet. Any open question blocks approval. */
  questions: string[];
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  hard: "Requirement",
  preference: "Preference",
  undecided: "Not decided",
};

export const PROPERTY_TYPES = {
  detached: "Single-family, detached",
  townhouse: "Townhouse",
  condo: "Condo",
  "multi-family": "Multi-family (2 to 4 units)",
  manufactured: "Manufactured",
  land: "Land or lot",
} as const;
export type PropertyType = keyof typeof PROPERTY_TYPES;

type ValueKind = "money" | "count" | "half" | "acres" | "codes" | "places" | "yesno" | "text";

interface FieldRule {
  label: string;
  operators: Operator[];
  unit: Unit;
  value: ValueKind;
  /** Financial. Hidden from household members who were not given the money scope. */
  money: boolean;
}

export const FIELDS: Record<Field, FieldRule> = {
  price: { label: "Price", operators: ["atMost", "atLeast", "equals"], unit: "USD", value: "money", money: true },
  bedrooms: { label: "Bedrooms", operators: ["atLeast"], unit: "count", value: "count", money: false },
  bathrooms: { label: "Bathrooms", operators: ["atLeast"], unit: "count", value: "half", money: false },
  propertyType: { label: "Type of home", operators: ["oneOf"], unit: "code", value: "codes", money: false },
  geography: { label: "Areas", operators: ["oneOf", "avoids"], unit: null, value: "places", money: false },
  basement: { label: "Basement", operators: ["equals"], unit: null, value: "yesno", money: false },
  garage: { label: "Garage spaces", operators: ["atLeast"], unit: "count", value: "count", money: false },
  lotSize: { label: "Lot size", operators: ["atLeast"], unit: "acres", value: "acres", money: false },
  hoa: { label: "HOA fee", operators: ["atMost"], unit: "USD/month", value: "money", money: true },
  otherPropertyAttribute: { label: "Other", operators: ["equals", "avoids"], unit: null, value: "text", money: false },
};

export const FIELD_ORDER: Field[] = [
  "price", "geography", "propertyType", "bedrooms", "bathrooms",
  "basement", "garage", "lotSize", "hoa", "otherPropertyAttribute",
];

const OPERATOR_WORDS: Record<Operator, string> = {
  equals: "", atLeast: "at least", atMost: "at most", oneOf: "", avoids: "not",
};

export const TEXT_MAX = 200;
export const PLACES_MAX = 20;
export const CRITERIA_MAX = 40;
export const QUESTION_MAX = 300;
export const QUESTIONS_MAX = 10;
const MONEY_MAX = 50_000_000;

/**
 * Wording Rift will not record as a search criterion.
 *
 * Fair housing, and blueprint finding F18: a search describes homes and places
 * the buyer chose, never the people who live there. School rankings and crime
 * are included because they are how that steering usually arrives in
 * practice. The buyer is free to research any of it; it simply does not go
 * into a filter the agent then runs on their behalf.
 *
 * Phrases, not bare words, so "white cabinets" and "near my church" are fine.
 */
const REFUSED: { pattern: RegExp; why: string }[] = [
  { pattern: /\bcrime\b|\bcriminal\b/i, why: "crime" },
  { pattern: /\b(safe|safest|safer|dangerous|sketchy|rough)\b.{0,25}\b(area|areas|neighbou?rhoods?|parts? of town|communit(y|ies)|streets?)\b/i, why: "how safe an area is" },
  { pattern: /\b(good|great|better|best|top|highly|high|well)[- ]?(rated|ranked)?\b.{0,15}\bschools?\b|\bschool (ratings?|rankings?|scores?|grades?)\b/i, why: "school quality" },
  { pattern: /\bfamily[- ]friendly\b|\b(no|without|fewer|lots of)\s+(kids|children|families|renters|tenants)\b/i, why: "who lives nearby" },
  { pattern: /\bsection\s*8\b|\bsubsidi[sz]ed housing\b|\blow[- ]income (area|neighbou?rhood|people)\b/i, why: "who lives nearby" },
  { pattern: /\b(diverse|diversity|ethnic|racial|race|demographics?|integrated|segregated)\b/i, why: "who lives nearby" },
  { pattern: /\b(christian|muslim|jewish|hindu|catholic|hispanic|latino|latina|asian|african|white|black|immigrant|foreign)s?\b.{0,20}\b(area|areas|neighbou?rhoods?|communit(y|ies)|people|famil(y|ies)|neighbou?rs?|residents?)\b/i, why: "who lives nearby" },
  { pattern: /\b(neighbou?rs?|neighbou?rhoods?|communit(y|ies)|area|residents?)\b.{0,20}\b(christian|muslim|jewish|hindu|catholic|hispanic|latino|latina|asian|african|white|black|immigrant|foreign)s?\b/i, why: "who lives nearby" },
  { pattern: /\b(young|older|elderly|retired)\s+(people|neighbou?rs?|residents?|crowd)\b/i, why: "who lives nearby" },
];

/** Null when the wording is fine; otherwise what kind of thing it describes. */
export function refusedWording(text: string): string | null {
  for (const r of REFUSED) if (r.pattern.test(text)) return r.why;
  return null;
}

export const REFUSAL_EXPLAINED =
  "Rift records features of a home and places the buyer chose. It cannot record preferences about " +
  "who lives nearby, school rankings or crime, and will not pass them into a search. The buyer is " +
  "free to research those themselves.";

const isFiniteNonNeg = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isIsoDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/** One criterion, checked against its field's rules. Null when it is valid. */
export function criterionError(c: SearchCriterion): string | null {
  const rule = FIELDS[c.field as Field];
  if (!rule) return "That is not a field Rift knows how to search on";
  if (!c.id || typeof c.id !== "string" || c.id.length > 64) return "Each criterion needs an id";
  if (!rule.operators.includes(c.operator)) return `${rule.label} cannot be "${OPERATOR_WORDS[c.operator] || c.operator}"`;
  if (c.unit !== rule.unit) return `${rule.label} is measured in ${rule.unit ?? "words"}`;
  if (!(["hard", "preference", "undecided"] as const).includes(c.strength)) return "Say whether it is a requirement or a preference";
  if (typeof c.statedBy !== "string" || !c.statedBy.trim() || c.statedBy.length > 80) return "Say who stated it";
  if (!isIsoDate(c.statedAt)) return "Say when it was stated";
  if (typeof c.sourceRef !== "string" || !c.sourceRef.trim() || c.sourceRef.length > 120) return "Say where it came from";

  const v = c.value;
  switch (rule.value) {
    case "money":
      if (!isFiniteNonNeg(v) || v > MONEY_MAX) return `${rule.label} must be a dollar amount`;
      if (v === 0 && c.field === "price") return "A price of $0 is not a price. Leave it out if it is unknown";
      return null;
    case "count":
      if (!isFiniteNonNeg(v) || !Number.isInteger(v) || v > 20) return `${rule.label} must be a whole number`;
      return null;
    case "half":
      if (!isFiniteNonNeg(v) || v > 20 || !Number.isInteger(v * 2)) return `${rule.label} must be a whole or half number`;
      return null;
    case "acres":
      if (!isFiniteNonNeg(v) || v > 1000 || v === 0) return "Lot size must be a number of acres";
      return null;
    case "yesno":
      if (v !== "yes" && v !== "no") return `${rule.label} must be yes or no`;
      return null;
    case "codes":
      if (!Array.isArray(v) || v.length === 0 || v.some((x) => !(x in PROPERTY_TYPES))) return "Choose at least one type of home";
      if (new Set(v).size !== v.length) return "Each type of home once";
      return null;
    case "places": {
      if (!Array.isArray(v) || v.length === 0 || v.length > PLACES_MAX) return `Name between 1 and ${PLACES_MAX} places`;
      for (const p of v) {
        if (typeof p !== "string" || !p.trim() || p.length > 80) return "Each place needs a name under 80 characters";
        const refused = refusedWording(p);
        if (refused) return `"${p}" describes ${refused}. ${REFUSAL_EXPLAINED}`;
      }
      return null;
    }
    case "text": {
      if (typeof v !== "string" || !v.trim() || v.length > TEXT_MAX) return `Describe it in under ${TEXT_MAX} characters`;
      const refused = refusedWording(v);
      if (refused) return `That describes ${refused}. ${REFUSAL_EXPLAINED}`;
      return null;
    }
  }
}

/** Whether a brief can be SAVED. Saving allows open questions and undecided items; approval does not. */
export function briefErrors(b: SearchBrief): string[] {
  const out: string[] = [];
  if (!Array.isArray(b.criteria) || !Array.isArray(b.questions)) return ["The brief is malformed"];
  if (b.criteria.length > CRITERIA_MAX) out.push(`Keep it under ${CRITERIA_MAX} criteria`);
  if (b.questions.length > QUESTIONS_MAX) out.push(`Keep it under ${QUESTIONS_MAX} open questions`);
  const ids = new Set<string>();
  for (const c of b.criteria) {
    const e = criterionError(c);
    if (e) out.push(e);
    if (ids.has(c.id)) out.push("Two criteria share an id");
    ids.add(c.id);
  }
  for (const q of b.questions) {
    if (typeof q !== "string" || !q.trim() || q.length > QUESTION_MAX) out.push(`Each open question needs to be under ${QUESTION_MAX} characters`);
    else if (refusedWording(q)) out.push(`An open question describes ${refusedWording(q)}. ${REFUSAL_EXPLAINED}`);
  }
  return out;
}

/**
 * What stops a revision from being approved as a search.
 *
 * Empty means it can be approved. Everything here is a question for the buyer
 * or the agent, never something Rift resolves by picking the likelier answer.
 */
export function approvalBlockers(b: SearchBrief, disagreement: string[] = []): string[] {
  const out = briefErrors(b);
  if (out.length) return out;

  if (b.criteria.length === 0) out.push("There is nothing to search on yet");
  if (!b.criteria.some((c) => c.strength === "hard")) {
    out.push("Nothing is marked as a requirement, so a search would return every listing in the MLS");
  }
  for (const c of b.criteria) {
    if (c.strength === "undecided") out.push(`${FIELDS[c.field].label}: decide whether "${describe(c)}" is a requirement or a preference`);
  }
  for (const q of b.questions) out.push(`Open question: ${q}`);

  const hardPrice = (op: Operator) =>
    b.criteria.filter((c) => c.field === "price" && c.operator === op && c.strength === "hard").map((c) => c.value as number);
  const maxes = hardPrice("atMost");
  const mins = hardPrice("atLeast");
  if (new Set(maxes).size > 1) out.push("There are two different maximum prices. Keep one");
  if (new Set(mins).size > 1) out.push("There are two different minimum prices. Keep one");
  if (maxes.length && mins.length && Math.min(...mins) > Math.min(...maxes)) {
    out.push("The minimum price is above the maximum");
  }
  const target = b.criteria.find((c) => c.field === "price" && c.operator === "equals");
  if (target && maxes.length && (target.value as number) > Math.min(...maxes)) {
    out.push("The target price is above the maximum");
  }

  const hardCounts = (f: Field) => new Set(b.criteria.filter((c) => c.field === f && c.strength === "hard").map((c) => c.value));
  for (const f of ["bedrooms", "bathrooms", "garage", "lotSize", "hoa"] as Field[]) {
    if (hardCounts(f).size > 1) out.push(`${FIELDS[f].label} is required twice with different values. Keep one`);
  }

  const wanted = new Set(b.criteria.filter((c) => c.field === "geography" && c.operator === "oneOf").flatMap((c) => (c.value as string[]).map((p) => p.toLowerCase().trim())));
  const avoided = b.criteria.filter((c) => c.field === "geography" && c.operator === "avoids").flatMap((c) => c.value as string[]);
  for (const p of avoided) if (wanted.has(p.toLowerCase().trim())) out.push(`${p} is both wanted and avoided`);

  for (const d of disagreement) out.push(d);
  return out;
}

/** Human wording for one criterion. `showMoney` false hides amounts from members without the money scope. */
export function describe(c: SearchCriterion, showMoney = true): string {
  const rule = FIELDS[c.field];
  if (rule.money && !showMoney) return `${rule.label}: kept private`;
  const v = c.value;
  switch (c.field) {
    case "price":
      if (c.operator === "equals") return `Target about ${money(v as number)}`;
      return `${c.operator === "atMost" ? "At most" : "At least"} ${money(v as number)}`;
    case "bedrooms": return `At least ${v} bedroom${v === 1 ? "" : "s"}`;
    case "bathrooms": return `At least ${v} bathroom${v === 1 ? "" : "s"}`;
    case "garage": return `At least ${v} garage space${v === 1 ? "" : "s"}`;
    case "lotSize": return `At least ${v} acre${v === 1 ? "" : "s"}`;
    case "hoa": return `HOA at most ${money(v as number)} a month`;
    case "basement": return v === "yes" ? "Has a basement" : "No basement";
    case "propertyType": return (v as PropertyType[]).map((t) => PROPERTY_TYPES[t]).join(", ");
    case "geography": return `${c.operator === "avoids" ? "Not in " : ""}${(v as string[]).join(", ")}`;
    case "otherPropertyAttribute": return `${c.operator === "avoids" ? "Avoid: " : ""}${v as string}`;
  }
}

export interface CriterionChange {
  kind: "added" | "removed" | "changed";
  before: SearchCriterion | null;
  after: SearchCriterion | null;
  /** Which parts changed, in words: "value", "strength". Empty for added/removed. */
  parts: string[];
}

/**
 * What changed between two revisions, matched by criterion id.
 *
 * Only what changed. A buyer confirming a new budget should see the budget,
 * not re-read their whole brief (acceptance AT09), and the agent updating
 * Matrix should see the exact edits he has to make there.
 */
export function diffBriefs(before: SearchBrief | null, after: SearchBrief): {
  changes: CriterionChange[]; questionsAdded: string[]; questionsResolved: string[];
} {
  const prev = new Map((before?.criteria ?? []).map((c) => [c.id, c]));
  const next = new Map(after.criteria.map((c) => [c.id, c]));
  const changes: CriterionChange[] = [];
  for (const [id, a] of next) {
    const b = prev.get(id);
    if (!b) { changes.push({ kind: "added", before: null, after: a, parts: [] }); continue; }
    const parts: string[] = [];
    if (JSON.stringify(b.value) !== JSON.stringify(a.value) || b.operator !== a.operator) parts.push("value");
    if (b.strength !== a.strength) parts.push("strength");
    if (parts.length) changes.push({ kind: "changed", before: b, after: a, parts });
  }
  for (const [id, b] of prev) if (!next.has(id)) changes.push({ kind: "removed", before: b, after: null, parts: [] });
  const pq = new Set(before?.questions ?? []);
  const nq = new Set(after.questions);
  return {
    changes,
    questionsAdded: after.questions.filter((q) => !pq.has(q)),
    questionsResolved: (before?.questions ?? []).filter((q) => !nq.has(q)),
  };
}

/* ------------------------------------------------------------------------ */
/* The package                                                               */
/* ------------------------------------------------------------------------ */

export type Enforcement = "exact" | "approximate" | "manual";
export type Cadence = "instant" | "daily" | "weekly";
export const CADENCE_LABEL: Record<Cadence, string> = {
  instant: "As soon as a listing matches",
  daily: "Once a day",
  weekly: "Once a week",
};

export interface PackageLine {
  criterionId: string;
  field: Field;
  text: string;
  enforcement: Enforcement;
  /** Why it is approximate or manual. Absent for exact filters. */
  caveat?: string;
}

export interface SearchPackage {
  destination: "matrix";
  schemaVersion: number;
  revision: number;
  cadence: Cadence;
  /** Set in Matrix as filters. */
  filters: PackageLine[];
  /** Cannot be a filter. Check on every listing before sending it on. */
  manualChecks: PackageLine[];
  /** Not filters, by definition. Used when reviewing homes. */
  preferences: PackageLine[];
}

const APPROXIMATE: Partial<Record<Field, string>> = {
  geography: "Check that Matrix's city or area boundaries match what the buyer means by these names.",
  basement: "Listings where the basement field was left blank will be dropped. Check a few by hand.",
  garage: "Listings where garage spaces were left blank will be dropped. Check a few by hand.",
  hoa: "HOA fees are entered inconsistently (monthly, yearly, or blank). Check each listing's fee.",
};

function enforcementOf(c: SearchCriterion): { enforcement: Enforcement; caveat?: string } {
  if (c.field === "otherPropertyAttribute") {
    return { enforcement: "manual", caveat: "Not a search field. Check each listing, or ask the listing agent." };
  }
  if (c.operator === "avoids") {
    return { enforcement: "manual", caveat: "Exclusions are easy to get wrong as a filter. Check each listing." };
  }
  if (c.field === "price" && c.operator === "equals") {
    return { enforcement: "manual", caveat: "A target is not a limit. Use the maximum as the filter." };
  }
  const approx = APPROXIMATE[c.field];
  return approx ? { enforcement: "approximate", caveat: approx } : { enforcement: "exact" };
}

/**
 * The package for one revision. Refuses (returns the blockers) rather than
 * building a package with undecided items quietly left out.
 */
export function buildPackage(
  b: SearchBrief,
  revision: number,
  cadence: Cadence,
  disagreement: string[] = [],
): { ok: true; pkg: SearchPackage } | { ok: false; blockers: string[] } {
  const blockers = approvalBlockers(b, disagreement);
  if (blockers.length) return { ok: false, blockers };

  const pkg: SearchPackage = {
    destination: "matrix", schemaVersion: SEARCH_SCHEMA_VERSION, revision, cadence,
    filters: [], manualChecks: [], preferences: [],
  };
  const ordered = [...b.criteria].sort((x, y) => FIELD_ORDER.indexOf(x.field) - FIELD_ORDER.indexOf(y.field));
  for (const c of ordered) {
    const line = { criterionId: c.id, field: c.field, text: `${FIELDS[c.field].label}: ${describe(c)}` };
    if (c.strength === "preference") { pkg.preferences.push({ ...line, enforcement: "manual" }); continue; }
    const e = enforcementOf(c);
    if (e.enforcement === "manual") pkg.manualChecks.push({ ...line, ...e });
    else pkg.filters.push({ ...line, ...e });
  }
  return { ok: true, pkg };
}

/** A stable serialisation, so the same package always hashes the same. */
export function canonicalPackage(pkg: SearchPackage): string {
  const sortKeys = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sortKeys)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sortKeys(pkg));
}

/** What the agent copies while setting the search up. Plain text, nothing to interpret. */
export function packageText(pkg: SearchPackage, who: string): string {
  const lines = [
    `Matrix search for ${who} (brief revision ${pkg.revision})`,
    `Send listings: ${CADENCE_LABEL[pkg.cadence]}`,
    "",
    "Set as filters:",
    ...pkg.filters.map((l) => `  ${l.text}${l.enforcement === "approximate" ? "  [approximate]" : ""}`),
  ];
  if (pkg.manualChecks.length) lines.push("", "Check by hand on each listing (not filters):", ...pkg.manualChecks.map((l) => `  ${l.text}`));
  if (pkg.preferences.length) lines.push("", "Preferences (not filters, use when reviewing):", ...pkg.preferences.map((l) => `  ${l.text}`));
  return lines.join("\n");
}

/** Filters that differ between the active package and a new one: what to change in Matrix. */
export function packageChanges(active: SearchPackage | null, next: SearchPackage): { add: string[]; remove: string[] } {
  const was = new Set((active?.filters ?? []).map((l) => l.text));
  const now = new Set(next.filters.map((l) => l.text));
  return {
    add: [...now].filter((t) => !was.has(t)),
    remove: [...was].filter((t) => !now.has(t)),
  };
}

/* ------------------------------------------------------------------------ */
/* Status                                                                    */
/* ------------------------------------------------------------------------ */

export type SearchStatus =
  | "draft" | "awaiting-approval" | "manual-action-needed" | "active-confirmed"
  | "update-pending" | "paused" | "unknown";

export interface StatusInput {
  /** Latest revision number, or null when there is no brief yet. */
  latest: number | null;
  /** The package the agent confirmed is set up in Matrix. */
  active: { revision: number; status: "active-confirmed" | "paused" } | null;
  /** Approved and waiting for the agent to set it up. */
  pending: { revision: number } | null;
  /** True when the read failed. Never reported as anything but unknown. */
  unreadable?: boolean;
}

export const STATUS_LABEL: Record<SearchStatus, string> = {
  draft: "No brief yet",
  "awaiting-approval": "Waiting for your review",
  "manual-action-needed": "Approved, not yet set up in Matrix",
  "active-confirmed": "Set up in Matrix (confirmed by you)",
  "update-pending": "Brief changed since the Matrix search was set up",
  paused: "Paused in Matrix (recorded by you)",
  unknown: "Unknown: could not be read",
};

/**
 * One status for a buyer's search. The order of the checks is the priority:
 * an approved package waiting to be set up outranks everything, because it is
 * the one thing that is his to do right now.
 */
export function statusOf(s: StatusInput): SearchStatus {
  if (s.unreadable) return "unknown";
  if (s.latest === null) return "draft";
  if (s.pending) return "manual-action-needed";
  if (!s.active) return "awaiting-approval";
  if (s.latest > s.active.revision) return "update-pending";
  return s.active.status === "paused" ? "paused" : "active-confirmed";
}

/* ------------------------------------------------------------------------ */
/* Household                                                                 */
/* ------------------------------------------------------------------------ */

export type Response = "confirmed" | "changes-requested";

/**
 * Household disagreement on one revision. One person confirming and another
 * asking for changes is an unresolved state (spec REQ-DEC-02); first click
 * does not win, and Rift does not average the two.
 */
export function disagreementOn(responses: { name: string; response: Response; note: string | null }[]): string[] {
  const latest = new Map<string, { response: Response; note: string | null }>();
  for (const r of responses) latest.set(r.name, r);
  const asked = [...latest.entries()].filter(([, r]) => r.response === "changes-requested");
  const confirmed = [...latest.entries()].filter(([, r]) => r.response === "confirmed");
  if (asked.length === 0) return [];
  const who = asked.map(([n, r]) => `${n} asked for changes${r.note ? `: "${r.note}"` : ""}`);
  return confirmed.length
    ? [`The household disagrees. ${who.join("; ")}. Talk it through and save a revision that settles it`]
    : [`${who.join("; ")}. Save a revision that answers it`];
}

/* ------------------------------------------------------------------------ */
/* Homes against the brief                                                   */
/* ------------------------------------------------------------------------ */

export type Reaction = "interested" | "maybe" | "pass" | "tour-requested";
export const REACTION_LABEL: Record<Reaction, string> = {
  interested: "Interested",
  maybe: "Maybe",
  pass: "Pass",
  "tour-requested": "Would like to see it",
};

export interface PropertyFacts {
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: PropertyType | null;
  city: string | null;
  lotAcres: number | null;
  hoaMonthly: number | null;
  basement: "yes" | "no" | null;
  garageSpaces: number | null;
}

export type Fit = "meets" | "misses" | "unknown" | "manual";

export interface FitLine { criterionId: string; text: string; fit: Fit }

/**
 * How a home compares with the requirements, line by line.
 *
 * Never a percentage. "Meets 3 of your requirements; basement unconfirmed" is
 * something a buyer can check; "91% match" is a number nobody can. A missing
 * fact is unknown, not a pass, and a manual check stays manual.
 */
export function fitOf(facts: PropertyFacts, criteria: SearchCriterion[]): { lines: FitLine[]; summary: string } {
  const lines: FitLine[] = [];
  for (const c of criteria.filter((x) => x.strength === "hard")) {
    const text = `${FIELDS[c.field].label}: ${describe(c)}`;
    const fit = ((): Fit => {
      const n = (x: number | null, test: (a: number) => boolean): Fit => (x === null ? "unknown" : test(x) ? "meets" : "misses");
      switch (c.field) {
        case "price":
          if (c.operator === "equals") return "manual";
          return n(facts.price, (p) => (c.operator === "atMost" ? p <= (c.value as number) : p >= (c.value as number)));
        case "bedrooms": return n(facts.bedrooms, (x) => x >= (c.value as number));
        case "bathrooms": return n(facts.bathrooms, (x) => x >= (c.value as number));
        case "garage": return n(facts.garageSpaces, (x) => x >= (c.value as number));
        case "lotSize": return n(facts.lotAcres, (x) => x >= (c.value as number));
        case "hoa": return n(facts.hoaMonthly, (x) => x <= (c.value as number));
        case "basement": return facts.basement === null ? "unknown" : facts.basement === c.value ? "meets" : "misses";
        case "propertyType":
          return facts.propertyType === null ? "unknown" : (c.value as string[]).includes(facts.propertyType) ? "meets" : "misses";
        case "geography": {
          if (facts.city === null) return "unknown";
          const inList = (c.value as string[]).some((p) => p.toLowerCase().trim() === facts.city!.toLowerCase().trim());
          if (c.operator === "avoids") return inList ? "misses" : "manual";
          return inList ? "meets" : "manual";
        }
        case "otherPropertyAttribute": return "manual";
      }
    })();
    lines.push({ criterionId: c.id, text, fit });
  }
  const meets = lines.filter((l) => l.fit === "meets").length;
  const misses = lines.filter((l) => l.fit === "misses");
  const open = lines.filter((l) => l.fit === "unknown" || l.fit === "manual");
  const parts: string[] = [];
  if (lines.length === 0) return { lines, summary: "No requirements approved yet to compare against" };
  if (misses.length) parts.push(`Misses ${misses.map((m) => FIELDS[criteria.find((c) => c.id === m.criterionId)!.field].label.toLowerCase()).join(", ")}`);
  parts.push(`Meets ${meets} of ${lines.length} requirement${lines.length === 1 ? "" : "s"}`);
  if (open.length) parts.push(`${open.length} still to check`);
  return { lines, summary: parts.join("; ") };
}

/** Facts entered by hand, checked. Unknown stays null; nothing is guessed. */
export function factsError(f: PropertyFacts): string | null {
  const num = (x: number | null, max: number, what: string) =>
    x !== null && (!Number.isFinite(x) || x < 0 || x > max) ? `${what} is out of range` : null;
  return num(f.price, MONEY_MAX, "Price") ?? num(f.bedrooms, 20, "Bedrooms") ?? num(f.bathrooms, 20, "Bathrooms")
    ?? num(f.lotAcres, 1000, "Lot size") ?? num(f.hoaMonthly, 100_000, "HOA fee") ?? num(f.garageSpaces, 20, "Garage spaces")
    ?? (f.propertyType !== null && !(f.propertyType in PROPERTY_TYPES) ? "Unknown type of home" : null)
    ?? (f.city !== null && (f.city.length > 80 || !f.city.trim()) ? "City name is too long" : null)
    ?? (f.basement !== null && f.basement !== "yes" && f.basement !== "no" ? "Basement is yes, no, or unknown" : null);
}

export const EMPTY_FACTS: PropertyFacts = {
  price: null, bedrooms: null, bathrooms: null, propertyType: null, city: null,
  lotAcres: null, hoaMonthly: null, basement: null, garageSpaces: null,
};

/** Only http(s) links, so a pasted `javascript:` never becomes a clickable card. */
export function safeListingUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.href.length > 500) return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * SEARCH-09: when nothing on the list fits, which requirements are doing the
 * ruling out. Each must-have is counted against the live homes it misses
 * outright (an unknown fact is not a miss). Nothing here widens anything:
 * the buyer is shown what limits the search and decides; relaxing a must-have
 * is theirs to propose through their priorities.
 *
 * Null when at least one home meets every must-have it can be checked
 * against, when there are no must-haves, or when there are no homes to judge.
 */
export function limitingRequirements(
  homes: { facts: PropertyFacts }[],
  criteria: SearchCriterion[],
): { total: number; limits: { text: string; rulesOut: number }[] } | null {
  const hard = criteria.filter((c) => c.strength === "hard");
  if (!hard.length || !homes.length) return null;
  const fits = homes.map((h) => fitOf(h.facts, criteria).lines);
  if (fits.some((lines) => !lines.some((l) => l.fit === "misses"))) return null;
  const limits = hard
    .map((c) => ({
      text: `${FIELDS[c.field].label}: ${describe(c)}`,
      rulesOut: fits.filter((lines) => lines.some((l) => l.criterionId === c.id && l.fit === "misses")).length,
    }))
    .filter((l) => l.rulesOut > 0)
    .sort((a, b) => b.rulesOut - a.rulesOut);
  return { total: homes.length, limits };
}
