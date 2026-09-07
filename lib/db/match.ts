import "server-only";
import { readRegistry } from "./programs";
import { matchPrograms, type MatchResult } from "@/lib/core/registry";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { captureOpError } from "@/lib/monitoring/capture";

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
  /** True when the registry read ran out of time and the built-in list was used. */
  timedOut: boolean;
}

export async function matchForVisitor(
  county: string,
  firstTimeBuyer: boolean,
  today = new Date(),
): Promise<MatchRead> {
  /* On a deadline, because this is the revenue path and it has a real
     fallback. A registry read that FAILS already falls back to the built-in
     list; one that HANGS had no answer at all — nothing has failed yet, so the
     page waits until the platform kills it and the visitor sees nothing.
     
     A slow database is a likelier outage than a broken one, and it was the
     only kind this path could not survive. */
  const { value: registry, timedOut } = await withTimeout(
    readRegistry(today),
    READ_DEADLINE_MS,
    null,
  );

  if (timedOut) {
    captureOpError(new Error("registry read exceeded the deadline"), {
      op: "match.timeout",
      extra: { county, deadlineMs: READ_DEADLINE_MS },
    });
  }

  /* A registry read that fails or is empty must not silently show a visitor
     "no programmes match" — that is a claim, and it would be a false one. The
     built-in registry is real verified data, so falling back to it keeps the
     answer true; the caller is told which happened. */
  const usable = registry && registry.ok && "data" in registry ? registry.data : null;
  const programs = usable?.programs ?? [];
  const source = usable?.source ?? "seed";
  const windowDays = usable?.windowDays ?? 90;

  const match = programs.length
    ? matchPrograms({ county, firstTimeBuyer, programs, today })
    : matchPrograms({ county, firstTimeBuyer, today });

  return { match, source, windowDays, timedOut };
}
