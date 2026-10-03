/**
 * The figures the agent reads before replying to a new lead: what the person
 * is holding on their screen, for either side.
 *
 * The strip used to know only the buyer's four figures, so a seller showed a
 * bare sentence and a buyer whose readout carried a verdict only showed
 * nothing at all. Every figure here is one the readout stored or one the
 * person typed (their price, their timing); none is computed, so the strip
 * can never disagree with the snapshot the lead was shown (rule 1).
 *
 * Pure: no I/O.
 */

import { money } from "./compute";

export interface StripFact { label: string; value: string }

const dollars = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? money(v) : typeof v === "string" && v.trim() ? v.trim() : null;

export function leadStrip(input: {
  side: "buy" | "sell";
  figures: Record<string, string | number> | null;
  /** What they typed: the price they gave and when they want to move. */
  facts?: { value: number | null; timing: string | null } | null;
}): StripFact[] {
  const f = input.figures ?? {};
  const out: StripFact[] = [];
  const add = (label: string, v: unknown) => {
    const text = dollars(v);
    if (text) out.push({ label, value: text });
  };

  if (input.side === "sell") {
    add("Price they gave", f.price ?? input.facts?.value);
    /* The readout's own net, when it stored one as a figure. Otherwise the
       sentence they were told carries it, and the strip does not restate a
       number it was not given. */
    add("Would keep", f.net ?? f.netProceeds);
  } else {
    add("Home price", f.price ?? input.facts?.value);
    add("Cash to close", f.cashToClose);
    add("Still to find", f.gap);
    add("Monthly", f.monthly);
    add("Assistance", f.assistance);
  }
  if (input.facts?.timing) out.push({ label: "Timing", value: input.facts.timing });
  return out;
}
