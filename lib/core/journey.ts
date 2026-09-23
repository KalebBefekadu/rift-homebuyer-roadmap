/**
 * Journeys and who may take part in one.
 *
 * Blueprint v4 §3 and first-migration-proposal. A JOURNEY is one buying or
 * selling goal. It hangs off the existing relationship (`rift_leads`) rather
 * than replacing it, because one person can buy, then sell, then buy again,
 * and a lead row with a single `side` and a single `stage` cannot hold that.
 *
 * A MEMBER is a person invited into one journey. Email sign-in proves who
 * somebody is; it never grants membership by itself (REQ-ACCESS-01). An
 * invitation names an address, a role and scopes, and only a signed-in person
 * whose verified address matches, holding the invitation link, can accept it.
 *
 * Scopes are narrow on purpose. A co-buyer's parent helping with a gift needs
 * the homes, not the price ceiling, and "they are family" is not a scope.
 */

export type Side = "buy" | "sell";
export const SIDE_LABEL: Record<Side, string> = { buy: "Buying", sell: "Selling" };

export type Role = "buyer" | "co-buyer" | "viewer";
export const ROLE_LABEL: Record<Role, string> = {
  buyer: "Buyer",
  "co-buyer": "Co-buyer",
  viewer: "Can view",
};

/** search: the brief. homes: the shortlist. money: price and HOA criteria. */
export type Scope = "search" | "homes" | "money";
export const SCOPES: Scope[] = ["search", "homes", "money"];
export const SCOPE_LABEL: Record<Scope, string> = {
  search: "Search priorities",
  homes: "Homes",
  money: "Price and fees",
};

export const DEFAULT_SCOPES: Record<Role, Scope[]> = {
  buyer: ["search", "homes", "money"],
  "co-buyer": ["search", "homes", "money"],
  viewer: ["search", "homes"],
};

/** Buyers answer and react. A viewer only reads. */
export const canRespond = (role: Role) => role === "buyer" || role === "co-buyer";

export const INVITE_DAYS = 14;
export const LABEL_MAX = 160;
export const NAME_MAX = 120;

export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

export function labelError(label: string): string | null {
  const t = label.trim();
  if (!t) return "Give it a name, like \"First home\"";
  if (t.length > LABEL_MAX) return `Keep the name under ${LABEL_MAX} characters`;
  return null;
}

export type MemberState = "invited" | "active" | "expired" | "revoked";

export interface MemberStatus {
  acceptedAt: string | null;
  revokedAt: string | null;
  inviteExpiresAt: string | null;
}

/** Revocation wins over everything; an unaccepted invitation expires. */
export function memberState(m: MemberStatus, now = new Date()): MemberState {
  if (m.revokedAt) return "revoked";
  if (m.acceptedAt) return "active";
  if (m.inviteExpiresAt && Date.parse(m.inviteExpiresAt) <= now.getTime()) return "expired";
  return "invited";
}

/**
 * Whether a signed-in person may accept an invitation. The address on the
 * session is Supabase's verified one (they clicked a link sent to it); the
 * invitation's address is what the agent typed.
 */
export function acceptError(
  invite: MemberStatus & { email: string },
  sessionEmail: string | null,
  now = new Date(),
): string | null {
  const state = memberState(invite, now);
  if (state === "revoked") return "This invitation was withdrawn. Ask your agent for a new one.";
  if (state === "active") return "This invitation has already been used.";
  if (state === "expired") return "This invitation has expired. Ask your agent for a new one.";
  const mine = sessionEmail ? normaliseEmail(sessionEmail) : null;
  if (!mine || mine !== normaliseEmail(invite.email)) {
    return "This invitation was sent to a different address. Sign in with the address it was sent to.";
  }
  return null;
}

/**
 * The kill switch for everything this release adds (blueprint v4 §8, AT40):
 * journeys, the search brief, client sign-in and the shortlist. On unless
 * `RIFT_BUYER_SEARCH=off`, so switching it off disables every new writer and
 * page while the old /plan links, readouts and Studio keep working. Nothing
 * is deleted by switching it off.
 */
export function buyerSearchOn(env: Record<string, string | undefined>): boolean {
  return (env.RIFT_BUYER_SEARCH ?? "").trim().toLowerCase() !== "off";
}
