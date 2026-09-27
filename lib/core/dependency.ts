/**
 * A sale linked to a purchase (STATE-07). A household buying and selling at
 * once usually needs one for the other: the sale's proceeds for the down
 * payment, the sale's possession date before moving in, or simply the order
 * of the two closings.
 *
 * The rule is that neither moves the other. A dependency is something the
 * agent recorded, with who owns making it happen; it is shown on both
 * journeys and on Today, and it changes nothing by itself: no stage, date or
 * workstream moves because the other journey did. It is met only when the
 * agent records the evidence that it was.
 *
 * Pure: no I/O. The reads and writes are lib/db/dependencies.ts.
 */

export type DependencyKind = "proceeds" | "possession" | "timing";
export const DEPENDENCY_KINDS: DependencyKind[] = ["proceeds", "possession", "timing"];

export const KIND_LABEL: Record<DependencyKind, string> = {
  proceeds: "Needs the sale's proceeds",
  possession: "Needs the sale's possession date first",
  timing: "Depends on when the sale closes",
};

export type DependencyState = "open" | "met" | "removed";
export const STATE_LABEL: Record<DependencyState, string> = { open: "Open", met: "Met", removed: "Removed" };

export interface DependencyEvent { state: "met" | "removed" | "reopened"; evidence: string; by: string; at: string }

export interface Dependency {
  id: string;
  saleJourneyId: string;
  purchaseJourneyId: string;
  saleLabel: string;
  purchaseLabel: string;
  kind: DependencyKind;
  note: string;
  owner: string;
  by: string;
  at: string;
  events: DependencyEvent[];
}

/** Open unless the latest event says otherwise; reopened is open again. */
export function stateOf(d: Pick<Dependency, "events">): DependencyState {
  const last = [...d.events].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return !last || last.state === "reopened" ? "open" : last.state;
}

/** Why a dependency may not be recorded, or null. */
export function dependencyError(input: { kind: string; note: string; owner: string; saleJourneyId: string; purchaseJourneyId: string }): string | null {
  if (!DEPENDENCY_KINDS.includes(input.kind as DependencyKind)) return "Choose what the purchase needs from the sale";
  if (input.saleJourneyId === input.purchaseJourneyId) return "Choose a selling journey and a different buying journey";
  if (input.note.trim().length < 3) return "Say what it is, like \"Down payment comes from the sale of 12 Oak St\"";
  if (input.note.trim().length > 300) return "Keep the note under 300 characters";
  if (!input.owner.trim()) return "Say who owns making it happen";
  if (input.owner.trim().length > 120) return "Keep the owner under 120 characters";
  return null;
}

/** Which events may follow the current state. */
export function eventError(current: DependencyState, next: DependencyEvent["state"], evidence: string): string | null {
  if (evidence.trim().length < 3) return next === "met" ? "Say what shows it was met, like \"Settlement statement, funds wired 3 Oct\"" : "Say why";
  if (evidence.trim().length > 300) return "Keep it under 300 characters";
  if (next === "reopened" && current === "open") return "It is already open";
  if (next !== "reopened" && current !== "open") return `It is already ${STATE_LABEL[current].toLowerCase()}`;
  return null;
}

/** The line each journey shows, from its own side. */
const FROM_SALE: Record<DependencyKind, string> = {
  proceeds: "A purchase needs this sale's proceeds",
  possession: "A purchase needs this sale's possession date first",
  timing: "A purchase depends on when this sale closes",
};

export function lineFor(d: Dependency, side: "buy" | "sell"): string {
  return side === "buy" ? `${KIND_LABEL[d.kind]}: ${d.saleLabel}` : `${FROM_SALE[d.kind]}: ${d.purchaseLabel}`;
}
