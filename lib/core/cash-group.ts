/**
 * Which cash-to-close lines fold into "Other costs" on the drawings (manual
 * review WS3.2). Pure, so the grouping is tested and the total provably does
 * not move.
 */
export interface CashLine { label: string; amount: number; credited?: boolean; note?: string }

export const SMALL_COSTS = ["Prepaids and escrow", "Inspection", "Appraisal"] as const;
export const GROUP_LABEL = "Other costs";

export function groupSmallCosts(lines: CashLine[]): { lines: CashLine[]; parts: CashLine[]; amount: number; label: string } {
  const small = new Set<string>(SMALL_COSTS);
  const parts = lines.filter((l) => small.has(l.label) && !l.credited);
  if (parts.length < 2) return { lines, parts: [], amount: 0, label: GROUP_LABEL };
  const amount = parts.reduce((s, l) => s + l.amount, 0);
  const at = lines.findIndex((l) => small.has(l.label));
  const rest = lines.filter((l) => !small.has(l.label) || l.credited);
  rest.splice(at, 0, { label: GROUP_LABEL, amount });
  return { lines: rest, parts, amount, label: GROUP_LABEL };
}
