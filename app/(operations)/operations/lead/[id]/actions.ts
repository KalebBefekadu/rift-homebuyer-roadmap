"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { addNote, setStage, archiveLead, setNextAction, representationOf, setRepresentation, type NoteKind, type Stage, type RepStatus } from "@/lib/db/clients";
import { openPlan, closePlan, addPlanItem, setPlanItemDone, removePlanItem } from "@/lib/db/plan";
import { addOffer, setOfferReleased, removeOffer, setSellerCosts, type NewOffer } from "@/lib/db/offers";
import { approveTake, withdrawTake, reopenChoice } from "@/lib/db/offer-room";
import type { Owner } from "@/lib/core/plan";
import { recordClosing } from "@/lib/db/referral";
import { compareToSnapshot } from "@/lib/db/seam";
import { standingOf } from "@/lib/core/representation";
import { canPublish } from "@/lib/core/seam";
import {
  createDecision, addOption, removeOption, release, unrelease, recordOutcome, clearOutcome, removeDecision,
} from "@/lib/db/decisions";
import type { Kind as DecisionKind } from "@/lib/core/decision";

/**
 * Writes from a person's record: contact log and stage, offers and the offer room, their plan, the representation agreement, decision rooms and the closing date.
 *
 * Every one re-checks the session: a server action is a public HTTP endpoint,
 * not protected by the page that renders its button. Why each also passes
 * the agent's id down to the write is at the top of ../../actions.ts.
 */

export async function logContact(leadId: string, kind: NoteKind, body: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addNote(leadId, kind, body);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function moveStage(leadId: string, stage: Stage, why?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setStage(leadId, stage, why);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, stage: r.data.stage };
}

export async function archive(leadId: string, reason: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await archiveLead(leadId, reason);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function planNextAction(leadId: string, action: string | null, due: string | null, completedNote?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setNextAction(leadId, action, due, completedNote);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, cleared: r.data.cleared };
}

export async function recordOffer(leadId: string, input: Omit<NewOffer, "leadId">) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addOffer({ ...input, leadId });
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

/**
 * Release an offer to the seller, or take it back.
 *
 * Its own action rather than a field on the form, because it is its own
 * decision. An offer arrives while the agent is driving; presenting it
 * unreviewed is how somebody replies to a number before anybody has read the
 * terms under it.
 */
export async function releaseOffer(leadId: string, offerId: string, released: boolean) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setOfferReleased(offerId, released);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, released: r.data.released };
}

export async function deleteOffer(leadId: string, offerId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await removeOffer(offerId);
  revalidatePath(`/operations/lead/${leadId}`);

  /* The database refuses to delete an offer the seller chose: a recorded
     choice pointing at nothing is a record of nothing. Said in English. */
  if (!r.ok && /rift_offer_rooms_chosen_is_theirs/.test(r.error)) {
    return { ok: false as const, error: "The seller chose this offer. Reopen their choice before deleting it" };
  }
  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * The offer room: approve the take, withdraw it, reopen the seller's choice.
 *
 * Approval takes only the words. The draft it is recorded against and the set
 * of offers it covers are recomputed on the server: see lib/db/offer-room.ts
 *, so the audit trail is what Rift actually drafted, not what a form posted.
 */
export async function approveOfferTake(leadId: string, take: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };
  if (typeof take !== "string") return { ok: false as const, error: "write something first" };

  const r = await approveTake(leadId, take);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function withdrawOfferTake(leadId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await withdrawTake(leadId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function reopenOfferChoice(leadId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await reopenChoice(leadId);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * The two figures every net depends on.
 *
 * Asked for rather than assumed. A comparison run against a payoff of zero
 * ranks the offers correctly and reports a net out by the size of somebody's
 * mortgage, and it reads perfectly.
 */
export async function saveSellerCosts(leadId: string, payoff: number, commissionPct: number) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setSellerCosts(leadId, payoff, commissionPct);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * Publish a plan, and refuse to do it quietly.
 *
 * `lib/core/seam.ts` settles what happens when a free readout becomes a
 * published plan, and the rule that matters is its second one: the plan
 * recomputes, and it says so when it disagrees. Somebody who was shown "you
 * need $27,875" has told their partner that number, written it down, and
 * organised their saving around it. A plan that opens showing $29,400 with no
 * explanation is not a correction: it is the product changing its story on
 * the first day of the relationship, and the client has no way to tell whether
 * the first number was wrong or the second one is.
 *
 * So publishing is blocked while a material drift is undisclosed. `disclosed`
 * is the agent saying "I have seen what moved and I am telling them": passing
 * it is a deliberate act on a screen that has just listed the changes, not a
 * default.
 *
 * Note which way this fails. If the comparison cannot be made at all: no
 * database, a read that timed out: it does NOT wave the plan through. It
 * returns the reason, because "we could not check whether their numbers moved"
 * and "their numbers did not move" are different facts, and only one of them
 * is a reason to publish.
 */
export async function openClientPlan(leadId: string, disclosed = false) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const compared = await compareToSnapshot(leadId);
  if (!compared.ok) return { ok: false as const, error: compared.error };
  if ("skipped" in compared) return { ok: false as const, error: compared.reason };
  const snap = compared.data;

  /* Representation, read rather than asserted.

     This was `hasAgreement: true`: a literal, inside the one function in the
     product whose entire job is refusing to publish when something is not
     true. The comment above it said the column did not exist, which was
     accurate and is no longer.

     A read that FAILED does not block. "We could not check whether an
     agreement exists" and "no agreement exists" are different facts, exactly
     as the docblock above says of drift, and only one of them is a reason to
     refuse. A database blip must not read to the agent as a compliance
     problem, because he cannot tell them apart from the message. */
  const rep = await representationOf(leadId);
  const hasAgreement = rep.ok && "data" in rep
    ? standingOf(rep.data).covered
    : true;

  const check = canPublish({
    hasAgreement,
    hasSnapshot: snap.hasSnapshot,
    drifts: snap.drifts,
    disclosed,
    trustStates: snap.trustStates,
    snapshotFrom: snap.from ?? undefined,
  });

  if (!check.ok) {
    return {
      ok: false as const,
      error: check.blocks.join(" "),
      blocks: check.blocks,
      drifts: snap.material,
      warns: check.warns,
    };
  }

  const r = await openPlan(leadId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, token: r.data.token, warns: check.warns, drifts: snap.material };
}

/**
 * Revoke it.
 *
 * Nulling the token breaks every copy of the link at once, which is the only
 * way to take back something that has been forwarded. The steps are kept: the
 * relationship may resume, and deleting somebody's agreed plan because a link
 * travelled too far is a second mistake on top of the first.
 */
export async function closeClientPlan(leadId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await closePlan(leadId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function addStep(leadId: string, title: string, owner: Owner, ownerName: string | null, dueOn: string | null) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addPlanItem({ leadId, title, owner, ownerName, dueOn });
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

export async function tickStep(leadId: string, itemId: string, isDone: boolean) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setPlanItemDone(itemId, isDone);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, done: r.data.done };
}

export async function dropStep(leadId: string, itemId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await removePlanItem(itemId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * Record where the representation agreement stands.
 *
 * Rift never signs and never sends for signature: docs/vision.md is explicit
 * that those are among the actions which never become automatic in any mode.
 * This records a paper event that happened elsewhere, which is the whole of
 * what a product is entitled to do here.
 */
export async function recordRepresentation(
  leadId: string,
  status: RepStatus,
  signedOn?: string | null,
  expiresOn?: string | null,
) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await setRepresentation(leadId, status, { signedOn, expiresOn });
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath("/operations");

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, status: r.data.status };
}

export async function newDecision(input: {
  leadId: string;
  kind: DecisionKind;
  question: string;
  context?: string | null;
  decideBy?: string | null;
}) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await createDecision(input);
  revalidatePath(`/operations/lead/${input.leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

export async function addDecisionOption(leadId: string, input: {
  decisionId: string;
  label: string;
  detail?: string | null;
  amountCents?: number | null;
  amountLabel?: string | null;
  upside?: string | null;
  downside?: string | null;
}) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await addOption(input);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const, id: r.data.id };
}

export async function dropDecisionOption(leadId: string, optionId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await removeOption(optionId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * Let the client see a room.
 *
 * Returns the blocks rather than throwing them, so the form can show the agent
 * what is wrong with the comparison instead of a failure. `release` re-runs
 * `canRelease` against the stored room rather than trusting the page, because
 * a check the caller can skip is not a check.
 */
export async function releaseDecision(leadId: string, decisionId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await release(decisionId);
  revalidatePath(`/operations/lead/${leadId}`);
  revalidatePath(`/plan`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  if (r.data.blocks.length) {
    return { ok: false as const, error: r.data.blocks.join(" "), blocks: r.data.blocks };
  }
  return { ok: true as const, warns: r.data.warns };
}

export async function withdrawDecision(leadId: string, decisionId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await unrelease(decisionId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function decide(leadId: string, decisionId: string, optionId: string, note?: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await recordOutcome({ decisionId, optionId, note });
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function reopenDecision(leadId: string, decisionId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await clearOutcome(decisionId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

export async function deleteDecision(leadId: string, decisionId: string) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await removeDecision(decisionId);
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}

/**
 * Record the closing date, which is what starts the post-closing cadence.
 *
 * Deliberately not a side effect of moving somebody to the Closed stage. The
 * two are usually the same day and occasionally are not: a stage corrected
 * weeks later would otherwise move every anniversary that person will ever
 * have, and the only visible symptom is a message arriving on the wrong day.
 */
export async function setClosingDate(leadId: string, closedOn: string | null) {
  const agent = await currentAgent();
  if (!agent) return { ok: false as const, error: "not signed in" };

  const r = await recordClosing(leadId, closedOn);
  revalidatePath("/operations/referrals");
  revalidatePath(`/operations/lead/${leadId}`);

  if (!r.ok) return { ok: false as const, error: r.error };
  if ("skipped" in r) return { ok: false as const, error: r.reason };
  return { ok: true as const };
}
