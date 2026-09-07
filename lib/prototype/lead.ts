/**
 * Rift prototype — lead intelligence.
 *
 * The constraint on a solo agent is hours, not leads. Every inbound person
 * looks equally urgent in an inbox, so the inbox is the wrong instrument.
 *
 * This scores an inquiry on four things we already know from the assessment,
 * and shows its own arithmetic. An agent who cannot see why a lead ranks where
 * it does will stop trusting the ranking within a week, so the reasoning is
 * part of the output rather than a tooltip.
 *
 * Deliberately NOT in the model: any proxy for a protected class. No name
 * analysis, no neighbourhood scoring, no language inference, no photo. The
 * inputs below are the complete list (docs/vision.md, "Fair housing").
 */

export interface LeadInput {
  side: "buy" | "sell";
  /** Verbatim answer to the timing question. */
  timing: string;
  /** Fraction of the assessment completed, 0–1. */
  completion: number;
  /** Hours since last activity. */
  hoursSince: number;
  /** Deal size in dollars — purchase price or estimated sale price. */
  value: number;
  /** Months of saving before they can close. 0 = ready, null = unknown. */
  monthsToReady: number | null;
  /** Did they name a co-decider? */
  coBuyer: boolean;
  /** Did they leave a way to reach them? */
  contactable: boolean;
  /** Where they came from. */
  source: string;
}

export interface Signal {
  label: string;
  /** Points contributed, signed. */
  points: number;
  note: string;
}

export type Band = "now" | "soon" | "later" | "nurture";

export interface LeadScore {
  score: number;
  band: Band;
  /** Why this rank, in one line an agent can act on without opening anything. */
  headline: string;
  action: string;
  signals: Signal[];
}

export const BAND_LABEL: Record<Band, string> = {
  now: "Call today",
  soon: "This week",
  later: "Scheduled",
  nurture: "Nurture",
};

export const BAND_TONE: Record<Band, string> = {
  now: "chip-neg",
  soon: "chip-acc",
  later: "chip",
  nurture: "chip",
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function scoreLead(l: LeadInput): LeadScore {
  const signals: Signal[] = [];

  /* Timing — the strongest single predictor, and the only one they told us
     in their own words rather than one we inferred. */
  const timingPts =
    l.timing.startsWith("In the next") ? 32
    : l.timing.startsWith("3 to") ? 22
    : l.timing.startsWith("9 to") ? 10
    : 2;
  signals.push({
    label: "Stated timing",
    points: timingPts,
    note: l.timing || "Not answered",
  });

  /* Readiness — can they actually transact when they say they want to. */
  const readyPts =
    l.monthsToReady === null ? 4
    : l.monthsToReady === 0 ? 24
    : l.monthsToReady <= 6 ? 18
    : l.monthsToReady <= 12 ? 10
    : 4;
  signals.push({
    label: "Financial readiness",
    points: readyPts,
    note:
      l.monthsToReady === null ? "No saving rate given — timeline unknown"
      : l.monthsToReady === 0 ? "Cash already covers closing"
      : `About ${l.monthsToReady} months from covering closing`,
  });

  /* Engagement — how much of themselves they gave us. */
  const engPts = Math.round(l.completion * 18);
  signals.push({
    label: "Assessment depth",
    points: engPts,
    note: l.completion >= 1 ? "Finished the whole assessment" : `Stopped at ${Math.round(l.completion * 100)}%`,
  });

  /* Recency — intent decays fast and it decays steeply in the first day. */
  const recPts =
    l.hoursSince <= 1 ? 14
    : l.hoursSince <= 24 ? 10
    : l.hoursSince <= 72 ? 5
    : l.hoursSince <= 336 ? 1
    : -4;
  signals.push({
    label: "Recency",
    points: recPts,
    note:
      l.hoursSince <= 1 ? "Active within the hour"
      : l.hoursSince < 48 ? `Last active ${Math.round(l.hoursSince)}h ago`
      : `Last active ${Math.round(l.hoursSince / 24)} days ago`,
  });

  /* Reachability — an unreachable lead is not a lead, whatever it scores. */
  signals.push({
    label: "Reachable",
    points: l.contactable ? 8 : -12,
    note: l.contactable ? "Left a way to reach them" : "No contact details — nothing can be done here",
  });

  /* Co-decider — the person who did not answer the questions is usually the
     one who stalls it. Knowing they exist is worth more than not knowing. */
  signals.push({
    label: "Second decision-maker",
    points: l.coBuyer ? 4 : 0,
    note: l.coBuyer ? "Named — bring them in early" : "None named",
  });

  const score = clamp(signals.reduce((a, s) => a + s.points, 0));

  const band: Band =
    !l.contactable ? "nurture"
    : score >= 80 ? "now"
    : score >= 60 ? "soon"
    : score >= 38 ? "later"
    : "nurture";

  const headline =
    !l.contactable
      ? "No way to reach them — the assessment is all we have"
    : l.hoursSince <= 1 && l.completion >= 1
      ? "Finished everything minutes ago. This is the window."
    : l.completion < 1 && l.hoursSince <= 24
      ? `Dropped out ${Math.round(l.completion * 100)}% through, still warm — the drop-off point is the conversation`
    : l.monthsToReady === 0 && timingPts >= 22
      ? "Can transact now and says they want to. Nothing is in the way but a conversation."
    : l.monthsToReady !== null && l.monthsToReady > 12
      ? "Real, but the money is the constraint — this is a nurture relationship, not a call"
    : timingPts <= 2
      ? "Exploring. Let the plan do the work and check back."
    : `${l.side === "buy" ? "Buyer" : "Seller"} on a ${l.timing.toLowerCase()} horizon with the numbers in reach`;

  const action =
    !l.contactable ? "Nothing to do — waits for them to come back"
    : l.completion < 1 ? "Call about the exact question they stopped on"
    : band === "now" ? "Call today"
    : band === "soon" ? "Send the readout, then call"
    : band === "later" ? "Put on the plan cadence"
    : "Monthly check-in";

  return { score, band, headline, action, signals };
}

/* ------------------------------------------------------------------ *
 * Demonstration inbox
 * ------------------------------------------------------------------ */

export interface Lead extends LeadInput {
  id: string;
  name: string;
  initials: string;
  color: string;
  county: string;
  /** First touch. Never overwritten by a later visit — see attribution.ts. */
  campaign: string;
  landing: string;
  /** Minutes until a human replied. null = nobody has. */
  humanRepliedMins: number | null;
  /** Funnel version they actually answered. Their readout is pinned to it. */
  funnelVersion: number;
  /** Answers to the agent's own questions — never used in a calculation. */
  extras: { q: string; a: string }[];
  /** The specific thing that would open the conversation. */
  hook: string;
}

export const LEADS: Lead[] = [
  {
    id: "l1", funnelVersion: 3, campaign: "referral/priya-raman", landing: "/buy", humanRepliedMins: null, name: "Jordan Pike", initials: "JP", color: "#6b4a7a", county: "DeKalb",
    side: "buy", timing: "In the next 3 months", completion: 0.71, hoursSince: 0.4,
    value: 310_000, monthsToReady: 4, coBuyer: true, contactable: true, source: "Referral — Priya Raman",
    extras: [{ q: "How did you hear about us?", a: "Priya, she closed with you last spring" }],
    hook: "Stopped on the savings question, 24 minutes ago, from a referral that already closed.",
  },
  {
    id: "l2", funnelVersion: 3, campaign: "dpa-help-aug", landing: "/buy/assistance", humanRepliedMins: null, name: "Alina Ferreira", initials: "AF", color: "#2f5480", county: "Gwinnett",
    side: "buy", timing: "In the next 3 months", completion: 1, hoursSince: 5,
    value: 289_000, monthsToReady: 0, coBuyer: false, contactable: true, source: "Paid social — DPA campaign",
    extras: [{ q: "Anything you're worried about?", a: "My lease ends in December and I can't extend it" }],
    hook: "Cash already covers closing and the lease ends in December. This is a deadline, not a preference.",
  },
  {
    id: "l3", funnelVersion: 2, campaign: "downsizing-workshop", landing: "/sell", humanRepliedMins: 46, name: "Ruth & Harold Vance", initials: "HV", color: "#3f6f5f", county: "Cobb",
    side: "sell", timing: "3 to 9 months", completion: 1, hoursSince: 19,
    value: 468_000, monthsToReady: 0, coBuyer: true, contactable: true, source: "Workshop — downsizing",
    extras: [{ q: "What matters most in this move?", a: "Staying close to the grandchildren" }],
    hook: "Finished everything, both decision-makers named, and an appeal window closing in 19 days.",
  },
  {
    id: "l4", funnelVersion: 1, campaign: "—", landing: "/buy", humanRepliedMins: 180, name: "Marcus Deel", initials: "MD", color: "#8a4a2e", county: "Fulton",
    side: "buy", timing: "9 to 18 months", completion: 1, hoursSince: 62,
    value: 425_000, monthsToReady: 14, coBuyer: false, contactable: true, source: "Organic search",
    extras: [],
    hook: "Real, but fourteen months of saving away. The plan should do the work until then.",
  },
  {
    id: "l5", funnelVersion: 3, campaign: "assistance-broad-sep", landing: "/buy", humanRepliedMins: null, name: "Unknown visitor", initials: "??", color: "#8a8a8a", county: "Clayton",
    side: "buy", timing: "Just exploring", completion: 0.42, hoursSince: 8,
    value: 240_000, monthsToReady: null, coBuyer: false, contactable: false, source: "Paid social — assistance ad",
    extras: [],
    hook: "No contact details. Nothing to do but leave the door open.",
  },
  {
    id: "l6", funnelVersion: 2, campaign: "open-house-rowan", landing: "/buy", humanRepliedMins: 22, name: "Tomás Beltrán", initials: "TB", color: "#7a5c2e", county: "Henry",
    side: "buy", timing: "3 to 9 months", completion: 1, hoursSince: 30,
    value: 265_000, monthsToReady: 7, coBuyer: true, contactable: true, source: "Open house — 412 Rowan",
    extras: [{ q: "How did you hear about us?", a: "Walked into the open house on Rowan" }],
    hook: "Gwinnett funding closed under him last week and we told him. He is owed a follow-up.",
  },
];

export const ranked = () =>
  LEADS.map((l) => ({ lead: l, score: scoreLead(l) })).sort((a, b) => b.score.score - a.score.score);


/* ------------------------------------------------------------------ *
 * Speed to lead
 * ------------------------------------------------------------------ */

/**
 * The response-time literature is unusually consistent: qualification rates
 * fall off a cliff between five minutes and thirty, and keep falling. For a
 * solo agent that is unwinnable by effort alone — he is at a showing, or asleep.
 *
 * Which is why the automated first response is the readout itself. The person
 * gets everything the moment they finish, with no human in the path. The human
 * reply is then a second, slower clock with a much kinder target, and the two
 * are tracked separately because conflating them hides the fact that the
 * valuable half already happened.
 */
export interface Sla {
  /** Did they already receive the full readout? */
  valueDelivered: boolean;
  valueLabel: string;
  /** Target for a human reply, in minutes, from the band. */
  target: number;
  repliedMins: number | null;
  breached: boolean;
  humanLabel: string;
}

export function sla(l: Lead, band: Band): Sla {
  const valueDelivered = l.completion >= 1;
  const target = band === "now" ? 15 : band === "soon" ? 240 : 1440;
  const elapsed = Math.round(l.hoursSince * 60);
  const replied = l.humanRepliedMins;
  const breached = !l.contactable ? false : replied === null ? elapsed > target : replied > target;

  const fmt = (m: number) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);

  return {
    valueDelivered,
    valueLabel: valueDelivered
      ? "Full readout delivered instantly — no human was needed"
      : `Stopped at ${Math.round(l.completion * 100)}%, so nothing was delivered`,
    target,
    repliedMins: replied,
    breached,
    humanLabel: !l.contactable
      ? "No contact details"
      : replied !== null
      ? `You replied in ${fmt(replied)}${replied <= target ? "" : ` · target was ${fmt(target)}`}`
      : `Waiting ${fmt(elapsed)} · target ${fmt(target)}`,
  };
}
