import "server-only";
import { done, failed, type DbResult } from "./result";
import { readBids, recordResponse } from "./bids";
import { documentLink, readDocuments } from "./documents";
import { buyerBidLine, termsDiff, termsEffects, type BuyerBid, type Instruction } from "@/lib/core/bid";
import { canRespond } from "@/lib/core/journey";
import type { Membership } from "./portal";

/**
 * A household's offers and documents as a member may see and answer them.
 * Out of portal.ts, which re-exports it; the membership check is portal.ts's.
 */
/* ------------------------------------------------------------------ *
 * Offers (blueprint v4 W08)
 * ------------------------------------------------------------------ */

export type { BuyerBid };


/**
 * The household's offers, as a member may see them: only versions the agent
 * put to them, and only with the money scope (it is all prices). A viewer
 * without it sees nothing here.
 */
export async function clientBids(m: Membership): Promise<DbResult<{ bids: BuyerBid[]; unavailable?: string }>> {
  if (!m.scopes.includes("money") || m.side !== "buy") return done({ bids: [] });
  const agentFirst = m.agentName.trim().split(/\s+/)[0] ?? m.agentName;
  const [r, docs] = await Promise.all([readBids(m.journeyId, m.agentId, agentFirst), readDocuments(m.journeyId, m.agentId)]);
  if (!r.ok || !("data" in r)) return r as DbResult<never>;
  if (r.data.unavailable) return done({ bids: [], unavailable: r.data.unavailable });
  const docList = docs.ok && "data" in docs ? docs.data.documents : [];
  const docById = new Map(docList.map((d) => [d.id, d]));

  const bids: BuyerBid[] = [];
  for (const b of r.data.bids) {
    const asks = b.steps.filter((s) => s.kind === "ask");
    const lastAsk = asks[asks.length - 1];
    if (!lastAsk) continue;
    const termsOf = (v: number) => b.steps.find((s) => s.kind === "terms" && s.version === v) ?? null;
    const t = termsOf(lastAsk.version)!;
    const prev = termsOf(lastAsk.version - 1);
    const current = lastAsk.version === b.view.version;
    const resolution = current && b.view.asked ? b.view.asked.resolution : null;
    const answersOn = b.responses.filter((x) => x.version === lastAsk.version);
    const latest = new Map<string, (typeof answersOn)[number]>();
    for (const a of [...answersOn].sort((x, y) => x.at.localeCompare(y.at))) latest.set(a.memberId, a);
    const open = current && ["awaiting", "instructed", "disagreement", "changes", "stopped"].includes(b.view.status);
    bids.push({
      id: b.id,
      address: b.address,
      status: b.view.status,
      line: buyerBidLine(b.view, agentFirst),
      asked: {
        version: lastAsk.version,
        terms: t.terms!,
        effects: termsEffects(t.terms!),
        changes: prev ? termsDiff(prev.terms, t.terms!) : [],
        fromThem: t.origin === "theirs",
        documents: t.documentIds.map((id) => docById.get(id)).filter((d): d is NonNullable<typeof d> => !!d)
          .map((d) => ({ id: d.id, label: d.label, family: d.family })),
        answers: [...latest.values()].map((a) => ({ name: a.name, instruction: a.instruction, note: a.note, mine: a.memberId === m.memberId })),
        waitingOn: resolution?.waitingOn ?? [],
        open,
        myAnswer: latest.get(m.memberId)?.instruction ?? null,
        mineNeeded: lastAsk.required.some((x) => x.memberId === m.memberId),
      },
      newerDraft: !current,
      sharedDocumentIds: [...new Set(b.steps
        .filter((s) => s.kind === "terms" && asks.some((a) => a.version === s.version))
        .flatMap((s) => s.documentIds))],
    });
  }
  return done({ bids });
}

/** A member's instruction on the version being asked about. Never a signature (REQ-DEC-03). */
export async function respondToBid(
  m: Membership, bidId: string, version: number, instruction: Instruction, note: string | null, requestId: string,
) {
  if (!canRespond(m.role) || !m.scopes.includes("money")) return failed("Your access lets you look, not answer on offers");
  const agentFirst = m.agentName.trim().split(/\s+/)[0] ?? m.agentName;
  return recordResponse(m.journeyId, m.agentId, bidId, { memberId: m.memberId, label: m.name }, version, instruction, note, null, agentFirst, requestId);
}

/**
 * A one-minute link to a document, for a member: only one attached to a
 * version of an offer they were asked about, and only with the money scope.
 */
export async function clientDocumentLink(m: Membership, documentId: string): Promise<DbResult<{ url: string }>> {
  const b = await clientBids(m);
  if (!b.ok || !("data" in b)) return b as DbResult<never>;
  const shared = b.data.bids.some((x) => x.sharedDocumentIds.includes(documentId));
  if (!shared) return failed("That document is not shared with you");
  return documentLink(m.journeyId, m.agentId, documentId);
}
