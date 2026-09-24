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
import { feedbackAsAgent, recordTourStep, requestTourAsAgent } from "@/lib/db/tours";
import type { FeedbackInput, StepInput } from "@/lib/core/tour";
import { changeStage, changeStatus, endContract, recordContract, recordWorkAsAgent } from "@/lib/db/progress";
import { recordBidStep, responseAsAgent, startBid } from "@/lib/db/bids";
import { finishUpload, uploadSlot } from "@/lib/db/documents";
import { addDeadline, recordAmendment, reviseDeadline, type Revise } from "@/lib/db/deadlines";
import type { AmendmentChange, DeadlineInput, DeadlineKind } from "@/lib/core/deadline";
import { recordCheck } from "@/lib/db/pilot";
import type { CheckResult } from "@/lib/core/pilot";
import type { Instruction, StepInput as BidStepInput, Terms } from "@/lib/core/bid";
import type { ContractInput, ContractOutcome, JourneyStatus, Stage, WorkInput, Workstream } from "@/lib/core/progress";

/**
 * Operations writes for journeys, the search brief, the Matrix search and
 * the shortlist, called by app/api/operations/journey/route.ts.
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
  revalidatePath(`/operations/lead/${leadId}`);
  return out(r, (d) => ({ id: d.id }));
}

export async function relabelJourney(journeyId: string, label: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await renameJourney(journeyId, label);
  revalidatePath(`/operations/journey/${journeyId}`);
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
  revalidatePath(`/operations/journey/${journeyId}`);
  revalidatePath("/operations/search");
  return out(r, (d) => ({ revision: d.revision }));
}

export async function approveSearch(journeyId: string, revisionId: string, cadence: Cadence, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(revisionId) || !isUuid(requestId)) {
    return { ok: false as const, error: "Reload the page and try again" };
  }
  const r = await approveRevision(journeyId, revisionId, cadence, requestId, g.name);
  revalidatePath(`/operations/journey/${journeyId}`);
  revalidatePath("/operations/search");
  return out(r);
}

export async function confirmSearchSetUp(
  journeyId: string, packageId: string, ref: string, url: string, note: string, requestId: string,
) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(packageId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordActivation(packageId, ref, url, note, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  revalidatePath("/operations/search");
  return out(r);
}

export async function pauseSearch(journeyId: string, packageId: string, paused: boolean) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await setSearchPaused(packageId, paused);
  revalidatePath(`/operations/journey/${journeyId}`);
  revalidatePath("/operations/search");
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
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ link: `${origin}/app/invite/${d.token}`, expiresAt: d.expiresAt }));
}

export async function newInviteLink(journeyId: string, memberId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const origin = siteUrl();
  if (!origin) return { ok: false as const, error: "This deployment does not know its own address, so it cannot make a link" };
  const r = await reissueInvite(memberId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ link: `${origin}/app/invite/${d.token}`, expiresAt: d.expiresAt }));
}

export async function withdrawAccess(journeyId: string, memberId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await revokeMember(memberId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r);
}

export async function addShortlistHome(journeyId: string, input: {
  address: string; url: string; facts: PropertyFacts; factsSource: string; factsAsOf: string;
}) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await addHome(journeyId, { ...input, url: input.url.trim() || null }, g.name);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r);
}

export async function takeHomeOff(journeyId: string, homeId: string, reason: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  const r = await withdrawHome(homeId, reason);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r);
}

/** Ask for a showing on the buyer's behalf. Not a booking: that is ShowingTime. */
export async function requestShowing(journeyId: string, homeId: string, availability: string | null, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(homeId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await requestTourAsAgent(journeyId, homeId, availability, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ id: d.id, existing: d.existing }));
}

/** Record the next step of a showing as it happened in ShowingTime. */
export async function recordShowingStep(journeyId: string, stopId: string, input: StepInput, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(stopId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordTourStep(journeyId, stopId, input, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

/** What the buyer said after the showing, when they told the agent rather than the page. */
export async function recordShowingAnswer(journeyId: string, stopId: string, f: FeedbackInput, onBehalfOf: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(stopId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await feedbackAsAgent(journeyId, stopId, f, onBehalfOf);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r);
}

/* ------------------------------------------------------------------ *
 * Progress (W07). Every change carries the sequence the page showed, so two
 * people changing the same journey cannot both win.
 * ------------------------------------------------------------------ */

export async function moveStage(journeyId: string, to: Stage, reason: string, evidence: string | null, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await changeStage(journeyId, to, reason, evidence, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

export async function setJourneyStatus(journeyId: string, to: JourneyStatus, reason: string, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await changeStatus(journeyId, to, reason, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

export async function openContract(journeyId: string, input: ContractInput, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(input.homeId) || !isUuid(requestId)) return { ok: false as const, error: "Choose a home on the list" };
  const r = await recordContract(journeyId, input, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ id: d.id }));
}

export async function closeContract(
  journeyId: string, contractId: string, outcome: ContractOutcome, reason: string, backTo: Stage | null, expectedSeq: number, requestId: string,
) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(contractId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await endContract(journeyId, contractId, outcome, reason, backTo, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

export async function updateWork(
  journeyId: string, contractId: string, workstream: Workstream, input: WorkInput, expectedSeq: number, requestId: string,
) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(contractId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordWorkAsAgent(journeyId, contractId, workstream, input, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

/* ------------------------------------------------------------------ *
 * Documents and offers (W08)
 * ------------------------------------------------------------------ */

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A one-time link for the browser to upload a file into quarantine. */
export async function documentSlot(journeyId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId)) return { ok: false as const, error: "Reload the page and try again" };
  return out(await uploadSlot(journeyId), (d) => ({ path: d.path, url: d.url }));
}

/** The upload arrived: check it, and keep it only if it passes. */
export async function documentFinish(journeyId: string, path: string, filename: string, type: string, family: string, label: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await finishUpload(journeyId, path, filename, type, family, label, g.name);
  revalidatePath(`/operations/journey/${journeyId}`);
  if (r.ok && "data" in r && "refused" in r.data) {
    return { ok: false as const, error: `That file was not kept: ${r.data.refused.join("; ")}.`, refused: r.data.refused };
  }
  return out(r, (d) => ("id" in d ? { id: d.id } : {}));
}

export async function openBid(journeyId: string, homeId: string, terms: Terms, documentIds: string[], requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(homeId) || !isUuid(requestId) || !documentIds.every(isUuid)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await startBid(journeyId, homeId, terms, documentIds, g.name, first(g.name), requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ id: d.id }));
}

export async function bidStep(journeyId: string, bidId: string, input: BidStepInput, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(bidId) || !isUuid(requestId) || !(input.documentIds ?? []).every(isUuid)) {
    return { ok: false as const, error: "Reload the page and try again" };
  }
  const r = await recordBidStep(journeyId, bidId, input, expectedSeq, g.name, first(g.name), requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

/** An instruction the buyer gave by phone or message, recorded with how. */
export async function bidAnswerForThem(
  journeyId: string, bidId: string, memberId: string, version: number, instruction: Instruction, note: string | null, how: string, requestId: string,
) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(bidId) || !isUuid(memberId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await responseAsAgent(journeyId, bidId, memberId, version, instruction, note, how, g.name, first(g.name), requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r);
}

/* ------------------------------------------------------------------ *
 * Contract dates (W09)
 * ------------------------------------------------------------------ */

export async function addDate(journeyId: string, label: string, kind: DeadlineKind, workstream: Workstream | null, input: DeadlineInput, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(requestId) || (input.sourceDocumentId && !isUuid(input.sourceDocumentId))) return { ok: false as const, error: "Reload the page and try again" };
  const r = await addDeadline(journeyId, label, kind, workstream, input, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ id: d.id }));
}

export async function reviseDate(journeyId: string, deadlineId: string, change: Revise, expectedSeq: number, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(deadlineId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await reviseDeadline(journeyId, deadlineId, change, expectedSeq, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ seq: d.seq }));
}

export async function amendDates(journeyId: string, reference: string, changes: (AmendmentChange & { expectedSeq: number })[], requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(requestId) || !changes.every((c) => isUuid(c.deadlineId))) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordAmendment(journeyId, reference, changes, g.name, requestId);
  revalidatePath(`/operations/journey/${journeyId}`);
  return out(r, (d) => ({ changed: d.changed }));
}

/** A pilot check of the search and dates against Matrix and the documents (W12). */
export async function reconcile(journeyId: string, search: CheckResult, dates: CheckResult, note: string | null, requestId: string) {
  const g = await gate();
  if ("error" in g) return { ok: false as const, error: g.error };
  if (!isUuid(journeyId) || !isUuid(requestId)) return { ok: false as const, error: "Reload the page and try again" };
  const r = await recordCheck(journeyId, { search, dates, note }, g.name, requestId);
  revalidatePath("/operations/pilot");
  return out(r, (d) => ({ id: d.id }));
}
