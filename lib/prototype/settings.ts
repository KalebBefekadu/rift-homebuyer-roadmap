/**
 * Rift prototype — business rules that were hard-coded, made configurable.
 *
 * The gap this closes: the handoff listed five decisions that "need the
 * business owner, not engineering", and then every one of them sat in the code
 * as a literal. That is the worst of both worlds — the owner cannot change it
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
    owner: "Kaleb — but it varies per agreement, so the forecast is a planning figure, not a receivable.",
  },
  autoEmailReadout: {
    value: false,
    affects: "The consent surface and the speed-to-lead clock. Sending automatically makes the automated response instant for everybody; it also means an email goes out to an address nobody confirmed.",
    owner: "Kaleb. Default is off: the readout is already on screen, so the email is a convenience, not the delivery.",
  },
  registryOwner: {
    value: "Kaleb",
    affects: "Whether the 90-day suppression rule means anything. An unowned cadence is not a cadence — programmes silently rot and stop being shown.",
    owner: "Kaleb until there is somebody else. Naming him is worth more than leaving it blank.",
  },
  registryDays: {
    value: 90,
    affects: "How long a programme can go unchecked before customers stop being shown it. Longer means stale offers reach people; shorter means more verification work.",
    owner: "Kaleb.",
  },
  clientRetentionYears: {
    value: 5,
    affects: "Deletion of closed client records. Georgia brokerage rules and the broker's own policy both bite here — this is the one setting with a legal floor.",
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

export function readRules(): BusinessRules {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_RULES;
    const saved = JSON.parse(raw) as Partial<Record<keyof BusinessRules, unknown>>;
    /* Merge value-only, so the prose above stays the single source and cannot
       be overwritten by a stale saved copy of an earlier wording. */
    const out = { ...DEFAULT_RULES };
    (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]).forEach((k) => {
      if (saved[k] !== undefined) {
        // @ts-expect-error — value type is per-key and checked by the setter
        out[k] = { ...DEFAULT_RULES[k], value: saved[k] };
      }
    });
    return out;
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
