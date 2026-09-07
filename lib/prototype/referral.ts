/**
 * Rift prototype — the referral engine.
 *
 * Referral was a page. A page is the wrong shape for it, because referral is
 * not a thing you ask for once at the end — it is a set of MOMENTS, each with
 * its own trigger, its own ask, and its own reason the ask is reasonable then
 * and unreasonable a week either side.
 *
 * Two rules the design enforces:
 *
 *   1. The ask scales with what they have received. Right after a readout the
 *      ask is "send this to someone it would help" — a tool, not a person. On
 *      closing day it can be a name. Asking for a name at moment one is how
 *      you spend goodwill you have not earned.
 *
 *   2. NOTHING PUBLIC IS ASKED FOR BEFORE A PRIVATE CHECK. Every public review
 *      request is gated behind one private question. An unhappy client is
 *      routed to the agent, never to a review form. This is not review-gating
 *      to manufacture ratings — the private route exists so the complaint gets
 *      answered, and someone who says they are unhappy is never then asked for
 *      a public rating anyway. If they are happy, they are asked plainly and
 *      once.
 */

export type MomentId =
  | "value_delivered" | "plan_published" | "financing_secured"
  | "under_contract" | "closing_day" | "day_30" | "month_6" | "anniversary";

export type MomentState = "waiting" | "due" | "sent" | "acted" | "declined" | "held";

export interface Moment {
  id: MomentId;
  label: string;
  /** The condition, in words the agent would use. */
  trigger: string;
  /** What we actually ask for. Escalates with what they have received. */
  ask: string;
  /** Why this moment and not another. */
  why: string;
  /** Public reviews require the private satisfaction check first. */
  gated: boolean;
  /** Roughly how strong this moment is, 1–5. Used to order the queue. */
  strength: number;
}

export const MOMENTS: Moment[] = [
  {
    id: "value_delivered", label: "Readout delivered", trigger: "They finished the assessment and got their numbers",
    ask: "Send this to someone it would help",
    why: "They have just been given something for nothing and owe us nothing. The only honest ask here is for the tool, not for a name.",
    gated: false, strength: 2,
  },
  {
    id: "plan_published", label: "Plan published", trigger: "Kaleb reviewed and published their plan",
    ask: "Share the plan with anyone helping you",
    why: "Sharing is genuinely useful to them at this point — a gifting parent or a co-buyer needs it. Reach is a side effect of a real need.",
    gated: false, strength: 2,
  },
  {
    id: "financing_secured", label: "Financing secured", trigger: "Pre-approval or assistance confirmed in writing",
    ask: "Would a friend in the same spot want the assistance check?",
    why: "The single most quotable moment for a first-time buyer — they just found out the money is real. Specific, and specific asks travel.",
    gated: false, strength: 4,
  },
  {
    id: "under_contract", label: "Under contract", trigger: "Binding agreement executed",
    ask: "Nothing. Say congratulations and go quiet.",
    why: "They are about to be busy and anxious for thirty days. Asking here costs more than it earns, and restraint is remembered.",
    gated: false, strength: 1,
  },
  {
    id: "closing_day", label: "Closing day", trigger: "Keys handed over",
    ask: "A public review, and anyone you think I should meet",
    why: "The peak. Gratitude is highest and the memory is complete. If only one ask is ever made, it is this one.",
    gated: true, strength: 5,
  },
  {
    id: "day_30", label: "Thirty days in", trigger: "30 days after closing",
    ask: "Anything gone wrong I can help with?",
    why: "Not an ask at all. It is the check that makes the six-month ask credible, and it catches problems while they are still small.",
    gated: false, strength: 1,
  },
  {
    id: "month_6", label: "Six months in", trigger: "6 months after closing",
    ask: "A review, if you didn't leave one, and an introduction if anyone comes to mind",
    why: "Long enough that the answer is considered rather than euphoric. Reviews written here are the ones that read as real.",
    gated: true, strength: 4,
  },
  {
    id: "anniversary", label: "Anniversary", trigger: "Every year on the closing date, indefinitely",
    ask: "Here's what your home did this year. Anyone you'd send my way?",
    why: "Carries value first — an equity and tax update they did not ask for — so the ask arrives attached to something.",
    gated: true, strength: 3,
  },
];

export const STATE_CHIP: Record<MomentState, { l: string; c: string }> = {
  waiting: { l: "Not yet", c: "chip" },
  due: { l: "Due now", c: "chip-acc" },
  sent: { l: "Sent", c: "chip" },
  acted: { l: "Acted on", c: "chip-pos" },
  declined: { l: "Declined", c: "chip" },
  held: { l: "Held back", c: "chip-warn" },
};

/* ------------------------------------------------------------------ *
 * The satisfaction gate
 * ------------------------------------------------------------------ */

export type Mood = "good" | "mixed" | "bad" | null;

export interface GateResult {
  askPublicly: boolean;
  route: string;
  note: string;
}

export function gate(mood: Mood): GateResult {
  if (mood === "good")
    return {
      askPublicly: true,
      route: "Review request sent",
      note: "They said it went well. Asked once, plainly, with a direct link.",
    };
  if (mood === "mixed")
    return {
      askPublicly: false,
      route: "Raised with Kaleb",
      note: "Something is unresolved. A review request now would be asking them to publish a shrug.",
    };
  if (mood === "bad")
    return {
      askPublicly: false,
      route: "Escalated to Kaleb today",
      note: "No public ask, now or later, unless they raise it themselves. The job is to fix it.",
    };
  return { askPublicly: false, route: "Waiting on the check", note: "Nothing public goes out before they answer." };
}

/* ------------------------------------------------------------------ *
 * Demonstration state
 * ------------------------------------------------------------------ */

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
