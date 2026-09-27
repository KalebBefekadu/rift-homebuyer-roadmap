/**
 * The outbox: prepared messages wait for the agent's approval (Blueprint v5
 * §10.2; AUTO-01, AUTO-02, AUTO-03; D04).
 *
 * A draft's content is fixed when it is prepared. Approval is bound to that
 * exact content, recipient, channel and version: an edit is a new draft, and
 * the old one is cancelled, so an approval can never be carried onto words
 * nobody approved (AUTO-01, AT12).
 *
 * Every step is an event, never an edit (AUTO-02): prepared, approved,
 * running, succeeded, failed, unknown (sent, perhaps, and not confirmed),
 * cancelled. The current state is the latest event. A send that times out
 * after the provider may have accepted it is UNKNOWN, not failed, and is not
 * retried until someone has looked (AT13).
 *
 * Just before sending, what could have changed since approval is checked
 * again: whether the person is still there, has opted out, or has replied
 * (AUTO-03, AT37).
 *
 * Pure: no I/O. Hashing and storage are lib/db/outbox.ts.
 */

export type Channel = "email";
export type Purpose = "program-alert";
export type OutboxState = "prepared" | "approved" | "running" | "succeeded" | "failed" | "unknown" | "cancelled";

export const STATE_LABEL: Record<OutboxState, string> = {
  prepared: "Waiting for your approval",
  approved: "Approved, not sent yet",
  running: "Sending",
  succeeded: "Sent",
  failed: "Did not send",
  unknown: "May have sent: check before retrying",
  cancelled: "Discarded",
};

export const CONTENT_VERSION = 1;

export interface Draft {
  channel: Channel;
  purpose: Purpose;
  to: string;
  name: string | null;
  subject: string;
  body: string;
}

/** The exact thing an approval covers. Any change to any part is a different message. */
export function canonical(d: Draft): string {
  return JSON.stringify([CONTENT_VERSION, d.channel, d.purpose, d.to.trim().toLowerCase(), d.name ?? "", d.subject, d.body]);
}

/** Which steps may follow which. Anything else is refused. */
const NEXT: Record<OutboxState, OutboxState[]> = {
  prepared: ["approved", "cancelled"],
  approved: ["running", "cancelled"],
  running: ["succeeded", "failed", "unknown"],
  failed: ["approved", "cancelled"],
  unknown: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  cancelled: [],
};
export const canMove = (from: OutboxState, to: OutboxState) => NEXT[from].includes(to);

export interface OutboxEvent { state: OutboxState; at: string; by: string; hash: string | null; detail: string | null }

export const currentState = (events: OutboxEvent[]): OutboxState =>
  [...events].sort((a, b) => a.at.localeCompare(b.at)).at(-1)?.state ?? "prepared";

export interface SendCheck {
  /** The hash of the draft as stored now. */
  hash: string;
  events: OutboxEvent[];
  /** Rechecked just before sending. */
  leadExists: boolean;
  optedOut: boolean;
  repliedSinceApproval: boolean;
}

/** Why a send may not happen now, or an empty list when it may. */
export function sendBlockers(c: SendCheck): string[] {
  const out: string[] = [];
  const state = currentState(c.events);
  if (state !== "approved") out.push(`it is ${STATE_LABEL[state].toLowerCase()}, not approved`);
  const approval = [...c.events].sort((a, b) => a.at.localeCompare(b.at)).filter((e) => e.state === "approved").at(-1);
  if (approval && approval.hash !== c.hash) out.push("the message changed after it was approved");
  if (!c.leadExists) out.push("the person has been deleted");
  if (c.optedOut) out.push("the person has opted out of email");
  if (c.repliedSinceApproval) out.push("the person replied after it was approved; read that first");
  return out;
}

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

/**
 * A program-alert email for somebody who asked (D14), written for Kaleb to
 * read, change and approve. It says what changed in the program's own
 * words, points to the official page, and makes no promise about
 * eligibility.
 */
export function programAlertDraft(input: {
  to: string; name: string | null; program: string; change: string; sourceUrl: string; planUrl: string | null; agentFirst: string;
}): Draft {
  const first = input.name?.trim().split(/\s+/)[0] || "there";
  const body = [
    `Hi ${first},`,
    `You asked to hear when a Georgia program you may fit changes. ${input.program} has: ${input.change}`,
    `The program's own page: ${input.sourceUrl}`,
    input.planUrl ? `Your saved plan, worked out again with today's programs: ${input.planUrl}` : null,
    "The program and a participating lender decide eligibility. If you want to talk through what this means for you, reply to this email.",
    input.agentFirst,
  ].filter(Boolean).join("\n\n");
  return { channel: "email", purpose: "program-alert", to: input.to, name: input.name, subject: `${input.program} has changed`, body };
}
