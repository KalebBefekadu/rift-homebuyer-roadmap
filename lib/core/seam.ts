/**
 * Rift prototype — the seam between a free readout and a published plan.
 *
 * The gap this closes: the readout and the plan were both built, and what
 * happens *between* them was never defined. That is the most expensive kind of
 * undefined, because it is the moment a stranger becomes a client and it is the
 * only moment where two different systems hold an opinion about the same
 * number.
 *
 * The question it answers is narrow and specific: when Kaleb publishes a plan,
 * which of the figures the person was shown for free are carried across
 * unchanged, which are recalculated, and which are thrown away?
 *
 * Three rules settle it.
 *
 *   1. THE READOUT IS A SNAPSHOT AND IT IS IMMUTABLE. It is kept, verbatim,
 *      forever, as the thing this person was actually shown on the day they
 *      were shown it. Not because it stays accurate — it does not — but because
 *      the promise was "you keep this", and a document that silently rewrites
 *      itself was never theirs.
 *
 *   2. THE PLAN RECOMPUTES, AND SAYS SO WHEN IT DISAGREES. Live figures move.
 *      When a recomputed figure differs from the snapshot by more than the
 *      threshold below, the plan must show both and name the cause. Quietly
 *      replacing a number somebody has already told their partner is how a
 *      product loses a client in one screen.
 *
 *   3. PUBLISHING IS NOT VERIFICATION. A preliminary figure is still
 *      preliminary after it has been published inside a plan. Nothing about
 *      Kaleb pressing a button makes a lender's decision any more certain, and
 *      the trust ladder must not move by itself here.
 */

import type { TrustState } from "./review";

export type Carry = "snapshot" | "recompute" | "context" | "drop";

export const CARRY_LABEL: Record<Carry, string> = {
  snapshot: "Frozen at publish",
  recompute: "Recalculated live",
  context: "Carried as context",
  drop: "Not carried",
};

export const CARRY_CHIP: Record<Carry, string> = {
  snapshot: "chip",
  recompute: "chip-acc",
  context: "chip",
  drop: "chip-warn",
};

export interface Crossing {
  field: string;
  carry: Carry;
  why: string;
}

/** Every field that exists on a readout, and what becomes of it. */
export const CROSSINGS: Crossing[] = [
  {
    field: "The headline gap",
    carry: "recompute",
    why: "It is the number the whole relationship is organised around. A stale gap is worse than no gap, because they will plan against it.",
  },
  {
    field: "The readout as they saw it",
    carry: "snapshot",
    why: "Kept verbatim and dated. This is the promise — they keep it whether or not they ever became a client.",
  },
  {
    field: "Matched assistance programmes",
    carry: "recompute",
    why: "Programme terms and income limits move. A matched programme that expired between the readout and the plan must disappear from the plan and be explained, not carried.",
  },
  {
    field: "Trust state of each figure",
    carry: "snapshot",
    why: "Preliminary stays preliminary. Publishing changes who is looking at a number, not how sure anybody is about it — nothing a button does makes a lender more likely to say yes.",
  },
  {
    field: "Core question answers",
    carry: "recompute",
    why: "They feed compute. The plan asks again at intake and uses the newer answer, because six weeks of saving changes the arithmetic.",
  },
  {
    field: "Custom question answers",
    carry: "context",
    why: "They never touched a calculation and they must not start now. They appear on the client record as things the person said.",
  },
  {
    field: "Stated timing",
    carry: "context",
    why: "It set their lead band and it explains the plan's pacing, but the plan's dates come from the plan, not from a sentence typed by a stranger.",
  },
  {
    field: "Lead score and band",
    carry: "drop",
    why: "It was a triage instrument for deciding who to call. Once they are a client it has no job, and keeping a person ranked after they have hired you is indefensible if they ever see it.",
  },
  {
    field: "Attribution — first touch",
    carry: "snapshot",
    why: "Immutable by definition. It is how Kaleb learns which channel produced a client, and re-attributing it later destroys the only lesson it holds.",
  },
  {
    field: "Assessment abandonment events",
    carry: "drop",
    why: "Funnel diagnostics about a person who has since converted. Keeping them serves nobody and is one more record to breach.",
  },
];

/* ------------------------------------------------------------------ *
 * Drift
 * ------------------------------------------------------------------ */

/**
 * How far a recomputed figure may move before the plan has to say so out loud.
 * 3% is deliberately tight: on a $31,000 cash-to-close that is about $900, and
 * $900 is not a rounding difference to somebody saving for a house.
 */
export const DRIFT_PCT = 3;

export interface Drift {
  field: string;
  was: number;
  now: number;
  deltaPct: number;
  material: boolean;
  /** What actually moved. A drift with no named cause is a bug report. */
  cause: string;
}

export function drift(field: string, was: number, now: number, cause: string): Drift {
  const deltaPct = was === 0 ? (now === 0 ? 0 : 100) : ((now - was) / was) * 100;
  return {
    field, was, now,
    deltaPct: Math.round(deltaPct * 10) / 10,
    material: Math.abs(deltaPct) >= DRIFT_PCT,
    cause,
  };
}

/** Publishing is allowed to change numbers. It is not allowed to do it quietly. */
export function mustDisclose(ds: Drift[]) {
  return ds.filter((d) => d.material);
}

/* ------------------------------------------------------------------ *
 * The act of publishing
 * ------------------------------------------------------------------ */

export interface PublishCheck {
  ok: boolean;
  blocks: string[];
  warns: string[];
}

/**
 * What must be true before a plan can go out. These are preconditions rather
 * than warnings because each one, skipped, produces a client who believes
 * something untrue on day one of the relationship.
 */
export function canPublish(input: {
  hasAgreement: boolean;
  hasSnapshot: boolean;
  drifts: Drift[];
  disclosed: boolean;
  trustStates: TrustState[];
}): PublishCheck {
  const blocks: string[] = [];
  const warns: string[] = [];

  if (!input.hasSnapshot) blocks.push("No readout snapshot on file. The plan has nothing to be honest about.");
  if (!input.hasAgreement) blocks.push("No signed representation agreement. Publishing a plan first is the wrong order and in most cases the wrong side of the line.");

  const material = mustDisclose(input.drifts);
  if (material.length && !input.disclosed) {
    blocks.push(`${material.length} figure${material.length === 1 ? " has" : "s have"} moved more than ${DRIFT_PCT}% since their readout. Show the change and its cause before publishing.`);
  }

  if (input.trustStates.every((s) => s === "preliminary")) {
    warns.push("Every figure in this plan is still a preliminary estimate. Publishable, but say so on the first screen rather than letting the plan imply otherwise.");
  }

  return { ok: blocks.length === 0, blocks, warns };
}
