import "server-only";
import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { siteUrl } from "@/lib/core/site";
import { buyerSearchOn, type Role, type Scope, type Side } from "@/lib/core/journey";
import type { Cadence, PropertyFacts, SearchBrief } from "@/lib/core/search";
import type { DbResult } from "@/lib/db/result";
import { createJourney, invite, reissueInvite, revokeMember, renameJourney } from "@/lib/db/journeys";
import { saveAgentRevision, approveRevision, recordActivation, setSearchPaused } from "@/lib/db/search";
import { addHome, withdrawHome } from "@/lib/db/shortlist";

/**
 * Operations writes for journeys, the search brief, the Matrix search and
 * the shortlist, called by app/api/studio/journey/route.ts.
 *
 * Not server actions. A server action's promise settles only once Next has
 * applied the page tree that comes back with it, and on this page applying a
 * new tree sometimes never finishes (why: components/rift/useRefresh.ts). The
 * save was stored and the button sat on "Saving…" for good. A route answers
 * with plain JSON, the page shows its own confirmation from that answer, then
 * refreshes: the pattern of app/api/plan/choose/route.ts and
 * app/api/app/route.ts.
 *
 * Same rules as ../actions.ts: every write re-checks the session and resolves
 * the agent itself and scopes by it, so an id posted from a page is never
 * authority on its own. Approval and confirmation carry a request id minted
 * by the page, so a double click or a retry after a timeout records once
 * (AT13).
 */

type Out<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string };

async function gate(): Promise<{ name: string } | { error: string }> {
  if (!buyerSearchOn(process.env)) return { error: "Journeys are switched off on this deployment (RIFT_BUYER_SEARCH=off)" };
  const agent = await currentAgent();
  if (!agent) return { error: "not signed in" };
  return { name: agent.name };
}

function out<T extends object>(r: DbResult<T>, pick?: (d: T) => object): Out<Record<string, unknown>> {
  if (!r.ok) return { ok: false, error: r.error };
  if ("skipped" in r) return { ok: false, error: r.reason };
  return { ok: true, ...(pick ? pick(r.data) : {}) };
}

const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function startJourney(leadId: string, side: Side, label: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(leadId)) return { ok: false as const, error: "that person could not be found" };
  const r = await createJourney(leadId, side, label);
  revalidatePath(`/studio/lead/${leadId}`);
  return out(r, (d) => ({ id: d.id }));
}

export async function relabelJourney(journeyId: string, label: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await renameJourney(journeyId, label);
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r);
}

export async function saveBrief(journeyId: string, brief: SearchBrief, expectedLatest: number, note: string | null) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId)) return { ok: false as const, error: "that journey could not be found" };
  if (!brief || !Array.isArray(brief.criteria) || !Array.isArray(brief.questions)) {
    return { ok: false as const, error: "The brief is malformed. Reload and try again" };
  }
  const r = await saveAgentRevision(journeyId, brief, expectedLatest, note, g.name);
  revalidatePath(`/studio/journey/${journeyId}`);
  revalidatePath("/studio/search");
  return out(r, (d) => ({ revision: d.revision }));
}

export async function approveSearch(journeyId: string, revisionId: string, cadence: Cadence, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(revisionId) || !isUuid(requestId)) {
    return { ok: false as const, error: "Reload the page and try again" };
  }
  const r = await approveRevision(journeyId, revisionId, cadence, requestId, g.name);
  revalidatePath(`/studio/journey/${journeyId}`);
  revalidatePath("/studio/search");
  return out(r);
}

export async function confirmSearchSetUp(
  journeyId: string, packageId: string, ref: string, url: string, note: string, requestId: string,
) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(packageId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordActivation(packageId, ref, url, note, requestId);
  revalidatePath(`/studio/journey/${journeyId}`);
  revalidatePath("/studio/search");
  return out(r);
}

export async function pauseSearch(journeyId: string, packageId: string, paused: boolean) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await setSearchPaused(packageId, paused);
  revalidatePath(`/studio/journey/${journeyId}`);
  revalidatePath("/studio/search");
  return out(r);
}

/**
 * Invite somebody. The link is returned to the page to copy and send: Rift
 * does not email it. Sending anything to a client is an external action the
 * agent approves (decision D04), and choosing to paste it into his own email
 * or text IS that approval.
 */
export async function inviteMember(journeyId: string, input: { email: string; name: string; role: Role; scopes: Scope[] }) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const origin = siteUrl();
  if (!origin) return { ok: false as const, error: "This deployment does not know its own address, so it cannot make a link" };
  const r = await invite(journeyId, { email: input.email, name: input.name || null, role: input.role, scopes: input.scopes });
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r, (d) => ({ link: `${origin}/app/invite/${d.token}`, expiresAt: d.expiresAt }));
}

export async function newInviteLink(journeyId: string, memberId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const origin = siteUrl();
  if (!origin) return { ok: false as const, error: "This deployment does not know its own address, so it cannot make a link" };
  const r = await reissueInvite(memberId);
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r, (d) => ({ link: `${origin}/app/invite/${d.token}`, expiresAt: d.expiresAt }));
}

export async function withdrawAccess(journeyId: string, memberId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await revokeMember(memberId);
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r);
}

export async function addShortlistHome(journeyId: string, input: {
  address: string; url: string; facts: PropertyFacts; factsSource: string; factsAsOf: string;
}) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await addHome(journeyId, { ...input, url: input.url.trim() || null }, g.name);
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r);
}

export async function takeHomeOff(journeyId: string, homeId: string, reason: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await withdrawHome(homeId, reason);
  revalidatePath(`/studio/journey/${journeyId}`);
  return out(r);
}
