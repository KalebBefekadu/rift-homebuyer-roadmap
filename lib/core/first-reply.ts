/**
 * The first reply to a new lead, from Today (audit portals-2026-10, items 1
 * and 2).
 *
 * The row used to show the figures and an "I have replied" button, and the
 * call itself started two clicks away on the lead page. Seven of nine demo
 * leads were past the 15-minute target. The call is the conversion moment,
 * so the row offers it, with an opener ready for a text or an email.
 *
 * The opener carries no figure. The person already has their numbers on
 * their screen; restating one in a text is a second place it can be wrong,
 * and a template that never contains a number cannot put a wrong one in
 * front of anybody (rule 1). It is fixed words filled from stored facts,
 * never generated.
 *
 * Pure: no I/O.
 */

export type ReplyChannel = "call" | "text" | "email";

/** How a reply is written into the lead's history: the kinds `lastContacts` counts. */
export const REPLY_NOTE: Record<ReplyChannel, { kind: "call" | "text" | "email"; label: string }> = {
  call: { kind: "call", label: "Called" },
  text: { kind: "text", label: "Texted" },
  email: { kind: "email", label: "Emailed" },
};

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

export function firstReply(input: { agentName: string; name: string | null; side: "buy" | "sell" }): { subject: string; text: string } {
  const who = firstName(input.name);
  const plan = input.side === "sell" ? "selling plan" : "buying plan";
  return {
    subject: `Your ${plan}`,
    text: `Hi${who ? ` ${who}` : ""}, this is ${input.agentName.trim()}. I saw the ${plan} you worked out on Rift. Is now a good time for a quick call about it?`,
  };
}

/**
 * Which ways of replying the row offers. A call needs a number. A text needs
 * the number and their agreement to texts (contract 4.12: consent gates the
 * channel); without it the row offers the call and says nothing about texting.
 */
export function replyChannels(input: { phone: string | null; phoneConsent: boolean; email: string | null }): ReplyChannel[] {
  const out: ReplyChannel[] = [];
  if (input.phone) out.push("call");
  if (input.phone && input.phoneConsent) out.push("text");
  if (input.email) out.push("email");
  return out;
}
