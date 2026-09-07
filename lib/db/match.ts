import "server-only";
import { readRegistry } from "./programs";
import { matchPrograms, type MatchResult } from "@/lib/core/registry";

/**
 * The customer-facing match, against whatever the registry currently holds.
 *
 * One function so every surface — landing, readout, share link, email — asks
 * the same question the same way. The alternative is each page reading the
 * registry and matching for itself, which is how the same person ends up shown
 * two different assistance figures on two screens of the same product.
 */
export interface MatchRead {
  match: MatchResult;
  source: "database" | "seed";
  windowDays: number;
}

export async function matchForVisitor(
  county: string,
  firstTimeBuyer: boolean,
  today = new Date(),
): Promise<MatchRead> {
  const registry = await readRegistry(today);

  /* A registry read that fails or is empty must not silently show a visitor
     "no programmes match" — that is a claim, and it would be a false one. The
     built-in registry is real verified data, so falling back to it keeps the
     answer true; the caller is told which happened. */
  const programs = registry.ok && "data" in registry ? registry.data.programs : [];
  const source = registry.ok && "data" in registry ? registry.data.source : "seed";
  const windowDays = registry.ok && "data" in registry ? registry.data.windowDays : 90;

  const match = programs.length
    ? matchPrograms({ county, firstTimeBuyer, programs, today })
    : matchPrograms({ county, firstTimeBuyer, today });

  return { match, source, windowDays };
}
