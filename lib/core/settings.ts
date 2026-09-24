/**
 * Rift prototype: business rules that were hard-coded, made configurable.
 *
 * The gap this closes: the handoff listed five decisions that "need the
 * business owner, not engineering", and then every one of them sat in the code
 * as a literal. That is the worst of both worlds: the owner cannot change it
 * and the engineer is not allowed to. A decision that lives in a constant has
 * been made by whoever typed the constant.
 *
 * So each one is a setting with a stated default, a stated consequence, and a
 * note about who actually owns it. The default is a defensible starting
 * position, not a recommendation, and every one of them says what it changes.
 */

export interface Rule<T> {
  value: T;
  /** What breaks or shifts when this moves. */
  affects: string;
  /** Who decides. Some of these are not Kaleb's to decide alone. */
  owner: string;
}

export interface BusinessRules {
  /** Gross commission percentage used in every forecast figure. */
  commissionPct: Rule<number>;
  /** Send the readout by email the moment it is completed, or only when asked. */
  autoEmailReadout: Rule<boolean>;
  /** Who re-checks programme data, and how often before it is suppressed. */
  registryOwner: Rule<string>;
  registryDays: Rule<number>;
  /** How long a converted client's record is kept after closing. */
  clientRetentionYears: Rule<number>;
  /** Whether an unrepresented buyer using Rift Offer may be marketed to. */
  marketUnrepresented: Rule<boolean>;
}

export const DEFAULT_RULES: BusinessRules = {
  commissionPct: {
    value: 2.5,
    affects: "Every revenue figure in the forward view. It is the only number in the product that turns pipeline into money, so a wrong value here misprices the whole year.",
    owner: "Kaleb, but it varies per agreement, so the forecast is a planning figure, not a receivable.",
  },
  autoEmailReadout: {
    value: false,
    affects: "The consent surface and the speed-to-lead clock. Sending automatically makes the automated response instant for everybody; it also means an email goes out to an address nobody confirmed.",
    owner: "Kaleb. Default is off: the readout is already on screen, so the email is a convenience, not the delivery.",
  },
  registryOwner: {
    value: "Kaleb",
    affects: "Whether the 90-day suppression rule means anything. An unowned cadence is not a cadence: programmes silently rot and stop being shown.",
    owner: "Kaleb until there is somebody else. Naming him is worth more than leaving it blank.",
  },
  registryDays: {
    value: 90,
    affects: "How long a programme can go unchecked before customers stop being shown it. Longer means stale offers reach people; shorter means more verification work.",
    owner: "Kaleb.",
  },
  clientRetentionYears: {
    value: 5,
    affects: "Deletion of closed client records. Georgia brokerage rules and the broker's own policy both bite here. This is the one setting with a legal floor.",
    owner: "The broker, not the agent. Default 5 is a common brokerage figure and must be confirmed.",
  },
  marketUnrepresented: {
    value: false,
    affects: "Whether an unrepresented buyer on the other side of a Rift Offer deal enters the funnel. Off by default: soliciting the counterparty mid-transaction is a conflict question before it is a marketing one.",
    owner: "The broker, with counsel. Not an engineering decision and not a product one.",
  },
};

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

const KEY = "rift.rules";

/**
 * Whether a value read back out of storage is the shape this rule expects.
 *
 * The merge below carried a saved value straight onto the rule, with a
 * `@ts-expect-error` explaining that the type was "checked by the setter".
 * The setter does not check: it stores whatever it is handed. Neither does
 * `localStorage`, which survives a schema change, a half-finished edit, and
 * anything typed into a console.
 *
 * One of these settings is `commissionPct`, described in its own `affects`
 * note as "the only number in the product that turns pipeline into money".
 * A string where a number belongs does not throw anywhere: it multiplies
 * into every revenue figure in the forward view and renders as NaN, or worse,
 * concatenates.
 */
export function usable<K extends keyof BusinessRules>(k: K, v: unknown): v is BusinessRules[K]["value"] {
  const expected = typeof DEFAULT_RULES[k].value;
  if (typeof v !== expected) return false;
  /* NaN and Infinity are both `typeof "number"`, and both reach the screen. */
  if (typeof v === "number" && !Number.isFinite(v)) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

/**
 * Saved values over the defaults, dropping anything unusable.
 *
 * Pure, and separate from where the values came from, because there are now
 * two sources: localStorage in the prototype, and `rift_business_rules` in the
 * real Studio. The validation is the part worth having once: it exists
 * because these were previously merged behind a `@ts-expect-error` claiming
 * the setter had checked them, and neither the setter nor the store did.
 *
 * Value-only, so the prose above stays the single source and a stale saved
 * copy of an earlier wording cannot overwrite it.
 */
export function mergeRules(saved: Partial<Record<keyof BusinessRules, unknown>>): BusinessRules {
  const out = { ...DEFAULT_RULES };
  const apply = <K extends keyof BusinessRules>(k: K) => {
    const v = saved[k];
    if (v === undefined || !usable(k, v)) return;
    out[k] = { ...DEFAULT_RULES[k], value: v };
  };
  (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]).forEach((k) => apply(k));
  return out;
}

/** Which keys have no usable saved value, so "unset" and "chosen" can differ. */
export function undecidedIn(saved: Partial<Record<keyof BusinessRules, unknown>>): (keyof BusinessRules)[] {
  return (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[])
    .filter((k) => saved[k] === undefined || !usable(k, saved[k]));
}

export function readRules(): BusinessRules {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_RULES;
    return mergeRules(JSON.parse(raw) as Partial<Record<keyof BusinessRules, unknown>>);
  } catch { return DEFAULT_RULES; }
}

export function writeRule<K extends keyof BusinessRules>(k: K, v: BusinessRules[K]["value"]) {
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(KEY, JSON.stringify({ ...saved, [k]: v }));
    window.dispatchEvent(new CustomEvent("rift:rules"));
  } catch { /* ignore */ }
}

export function resetRules() {
  try { window.localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent("rift:rules")); } catch { /* ignore */ }
}

/** Rules still sitting on their default. Shown so "unset" and "chosen" differ. */
export function undecided(): (keyof BusinessRules)[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]).filter((k) => saved[k] === undefined);
  } catch { return Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]; }
}

export const RULE_LABEL: Record<keyof BusinessRules, string> = {
  commissionPct: "Commission assumption",
  autoEmailReadout: "Email the readout automatically",
  registryOwner: "Programme data owner",
  registryDays: "Programme re-check window",
  clientRetentionYears: "Client record retention",
  marketUnrepresented: "Market to unrepresented buyers",
};

/* ------------------------------------------------------------------ *
 * What each rule currently reaches
 * ------------------------------------------------------------------ */

export interface Reach {
  /** Does changing this change anything a person can see today? */
  live: boolean;
  /** Where it takes effect, or why it does not yet. */
  where: string;
}

/**
 * Whether a setting is connected to anything.
 *
 * This exists because the alternative is worse than not having a settings
 * page. Five of these six currently reach nothing: the forward view that
 * `commissionPct` prices is a prototype screen, Rift Offer does not exist
 * outside the prototype either, the retention sweep's windows are fixed in
 * lib/db/retention.ts rather than read from here, and `autoEmailReadout`
 * describes a delivery that only ever happens when somebody asks for it.
 *
 * A dial connected to nothing, on a page that looks like it configures the
 * product, is this codebase's signature failure built on purpose: the agent
 * sets his commission to 3%, nothing anywhere disagrees, and he finds out
 * when a forecast he has been quoting turns out to have been computed at 2.5.
 *
 * So every row says which it is. Being honest about a gap is cheap; the page
 * is still worth having, because a decision that has been RECORDED with a
 * date and a name is a decision, and the wiring is then a small job rather
 * than a judgement call somebody has to make again.
 */
export const RULE_REACH: Record<keyof BusinessRules, Reach> = {
  commissionPct: {
    live: false,
    where: "Recorded only. The forward view it prices lives in the prototype; nothing in Operations renders a revenue figure yet.",
  },
  autoEmailReadout: {
    live: false,
    where: "Recorded only. The readout is emailed when somebody asks for it and gives an address, and there is no address to send to before they do.",
  },
  registryOwner: {
    live: true,
    where: "Shown against every programme that is overdue a re-check, so the task has a name on it.",
  },
  registryDays: {
    live: true,
    where: "Programmes not verified within this many days stop being shown to buyers. Immediate in Operations; /buy/programs is cached for an hour, so the public page catches up within one.",
  },
  clientRetentionYears: {
    live: false,
    where: "Recorded only. The retention sweep's windows are fixed in lib/db/retention.ts; this one has a legal floor and needs the broker before it is wired to a delete.",
  },
  marketUnrepresented: {
    live: false,
    where: "Recorded only. Rift Offer does not exist outside the prototype, so there is no unrepresented buyer for this to apply to.",
  },
};

/**
 * Who decided a rule, and when.
 *
 * Here rather than in lib/db/settings.ts because the editor is a client
 * component and lib/db is `server-only`. A type-only import across that line
 * compiles today and breaks the build the moment somebody drops the `type`
 * keyword, which is exactly the kind of latent trap lib/core/layers.test.ts
 * exists to refuse, and it refused this one.
 */
export interface StoredRule {
  key: keyof BusinessRules;
  decidedAt: string | null;
  decidedBy: string | null;
}
