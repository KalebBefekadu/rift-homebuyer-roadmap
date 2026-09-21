import { MOMENTS, type Moment, type Mood, type MomentId, type MomentState } from "@/lib/core/referral";

/**
 * Invented clients, for the specification screen only.
 *
 * This lived in `lib/core/referral.ts` until the referral engine was wired to
 * real relationships. Five fictional people with fictional referral histories
 * are the right thing to draw a specification against and the wrong thing to
 * keep in `lib/core`, where every other module is either arithmetic or a rule
 * the production product depends on — and where a name that renders is
 * indistinguishable from a real one.
 *
 * The engine itself stayed behind and is now derived from lifecycle data. See
 * `momentsFor` in lib/core/referral.ts.
 */

export interface ClientMoments {
  client: string;
  initials: string;
  color: string;
  stage: string;
  mood: Mood;
  states: Partial<Record<MomentId, MomentState>>;
  /** Who they have actually sent, and what happened. */
  sent: { who: string; outcome: "closed" | "active" | "cold"; when: string }[];
}

export const REFERRAL_STATE: ClientMoments[] = [
  {
    client: "Priya Raman", initials: "PR", color: "#7a5c2e", stage: "Closed, 9 months ago", mood: "good",
    states: { value_delivered: "acted", plan_published: "acted", financing_secured: "acted", under_contract: "waiting", closing_day: "acted", day_30: "sent", month_6: "acted", anniversary: "due" },
    sent: [
      { who: "Jordan Pike", outcome: "active", when: "22 minutes ago" },
      { who: "Wendell Cho", outcome: "closed", when: "Aug 2026" },
    ],
  },
  {
    client: "Nadia & Chris Okafor", initials: "NO", color: "#8a4a2e", stage: "Under contract", mood: null,
    states: { value_delivered: "acted", plan_published: "sent", financing_secured: "acted", under_contract: "held", closing_day: "waiting" },
    sent: [],
  },
  {
    client: "Harold & Ruth Vance", initials: "HV", color: "#3f6f5f", stage: "Preparing to list", mood: "mixed",
    states: { value_delivered: "acted", plan_published: "acted", financing_secured: "waiting" },
    sent: [],
  },
  {
    client: "Maya Ellison", initials: "ME", color: "#2f5480", stage: "Building readiness", mood: null,
    states: { value_delivered: "acted", plan_published: "due" },
    sent: [],
  },
  {
    client: "Wendell Cho", initials: "WC", color: "#6b4a7a", stage: "Closed, 13 months ago", mood: "good",
    states: { closing_day: "acted", day_30: "acted", month_6: "declined", anniversary: "due" },
    sent: [{ who: "Alina Ferreira", outcome: "active", when: "5 hours ago" }],
  },
];

/** Everything that wants doing today, strongest moment first. */
export function dueNow() {
  const out: { c: ClientMoments; m: Moment }[] = [];
  for (const c of REFERRAL_STATE)
    for (const m of MOMENTS)
      if (c.states[m.id] === "due" || c.states[m.id] === "held") out.push({ c, m });
  return out.sort((a, b) => b.m.strength - a.m.strength);
}

export const referralStats = () => {
  const all = REFERRAL_STATE.flatMap((c) => c.sent);
  return {
    sent: all.length,
    closed: all.filter((x) => x.outcome === "closed").length,
    active: all.filter((x) => x.outcome === "active").length,
    advocates: REFERRAL_STATE.filter((c) => c.sent.length > 0).length,
  };
};
