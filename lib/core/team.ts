/**
 * The agent's team (Blueprint v5 §8.7). One role today: the transaction
 * coordinator, who records the checklist steps assigned to the coordinator
 * and nothing else. Pure; lib/db/team.ts reads and writes.
 */

export type TeamRole = "coordinator";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  invitedAt: string;
  /** The first sign-in with the invited address. */
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  invitedBy: string;
}

export type MemberState = "invited" | "active" | "removed";
export const MEMBER_STATE_LABEL: Record<MemberState, string> = {
  invited: "Invited, has not signed in",
  active: "Signed in",
  removed: "Removed",
};
export const memberState = (m: Pick<TeamMember, "acceptedAt" | "revokedAt">): MemberState =>
  m.revokedAt ? "removed" : m.acceptedAt ? "active" : "invited";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function memberError(input: { name: string; email: string }): string | null {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return "Give their name";
  if (name.length > 120) return "Keep the name under 120 characters";
  if (!EMAIL.test(email) || email.length > 254) return "That email address does not look right";
  return null;
}

/** What a coordinator can and cannot do, said once where the agent invites them. */
export const COORDINATOR_CAN = [
  "See the journeys you work, by client name, stage and checklist",
  "Record the steps you assign to the coordinator: who did it and the day",
];
export const COORDINATOR_CANNOT = [
  "See a client's finances, readout, notes or documents",
  "Record your steps, or anything protected: agreements, offers, price opinions",
  "Send anything to a client or an outside party",
];
