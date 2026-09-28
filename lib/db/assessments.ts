import "server-only";
import { serviceClient } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";

/**
 * The readout snapshot, read by its share link (/r/<token>).
 *
 * The v4 questionnaire that wrote assessments, answers and snapshots was
 * retired for the v5 values (D31), and with it the routes that wrote them.
 * What people were already given keeps opening: that is the promise below.
 *
 * The shape of this file is decided by one rule from docs/schema.md: a readout
 * is an immutable snapshot, not a view. `figures` stores what the person was
 * SHOWN; `inputs` stores what produced it. Recomputing six weeks later gives a
 * different answer (rates move, programmes close) and the promise made was
 * "you keep this". A document that silently rewrites itself was never theirs.
 *
 * Both are stored because the plan needs to recompute AND disclose the
 * difference. Keeping only the inputs loses what they were told; keeping only
 * the figures loses the ability to tell them what changed.
 */

/* ------------------------------------------------------------------ *
 * The readout snapshot
 * ------------------------------------------------------------------ */

export interface SnapshotInput {
  assessmentId: string;
  side: "buy" | "sell";
  inputs: Record<string, unknown>;
  /** The headline strings as rendered. What they were shown, verbatim. */
  figures: Record<string, unknown>;
  matched?: unknown[];
  /**
   * The individual figures, each with what it assumes and where it could be
   * wrong.
   *
   * Stored as ROWS rather than folded into the blob above, because contract 4.2
   * is enforced by CHECK constraints on `rift_figures`: assumptions must be
   * non-empty and a failure mode must be stated, and a constraint on a table
   * nothing writes to is a decoration. Every customer-facing number went into
   * an unconstrained jsonb column while the guarantee sat next to it, unused.
   *
   * It is also what the review queue needs to point at: "check this figure"
   * has to mean a specific one.
   */
  trackedFigures?: TrackedFigure[];
}

export interface TrackedFigure {
  label: string;
  /** In cents. Money in floating point is a bug waiting for a rounding. */
  valueCents: number;
  assumptions: { label: string; value: string }[];
  couldBeWrong: string;
  /** How high this figure could ever be certified. Not everything can be verified. */
  ceiling?: "preliminary" | "pending-review" | "reviewed" | "verified";
}

export interface StoredFigure {
  label: string;
  valueCents: number;
  trustState: "preliminary" | "pending-review" | "reviewed" | "verified";
  confirmedBy: string | null;
  assumptions: { label: string; value: string }[];
  couldBeWrong: string;
}

export async function readByToken(
  token: string,
): Promise<DbResult<SnapshotInput & { createdAt: string; stored: StoredFigure[] }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    /* A deadline here has no fallback: there is no built-in version of
       somebody's readout: so it converts a hang into the honest "we cannot
       open this right now" the page already knows how to show. Waiting instead
       leaves the recipient on a blank screen with no idea whose fault it is. */
    const query = Promise.resolve(
      db.from("rift_readouts")
        .select("id,assessment_id,side,inputs,figures,matched,created_at")
        .eq("share_token", token)
        .maybeSingle(),
    );
    const { value: result, timedOut } = await withTimeout(query, READ_DEADLINE_MS, null);
    if (timedOut || !result) return failed("the readout could not be loaded in time");

    const { data, error } = result;
    if (error) return failed(error.message);
    if (!data) return skipped("no readout with that token");

    /* The figures as they stand NOW, including anything the agent has since
       been through. The snapshot's numbers never change; how sure we are about
       them can, and that is the one thing a shared readout should update. */
    const { data: figs } = await db
      .from("rift_figures")
      .select("label,value_cents,trust_state,confirmed_by,assumptions,could_be_wrong")
      .eq("readout_id", data.id)
      .order("created_at", { ascending: true });

    return done({
      assessmentId: data.assessment_id as string,
      side: data.side as "buy" | "sell",
      inputs: data.inputs as Record<string, unknown>,
      figures: data.figures as Record<string, unknown>,
      matched: data.matched as unknown[],
      createdAt: data.created_at as string,
      stored: ((figs ?? []) as {
        label: string; value_cents: string | number; trust_state: StoredFigure["trustState"];
        confirmed_by: string | null; assumptions: { label: string; value: string }[]; could_be_wrong: string;
      }[]).map((f) => ({
        label: f.label,
        valueCents: Number(f.value_cents),
        trustState: f.trust_state,
        confirmedBy: f.confirmed_by,
        assumptions: f.assumptions ?? [],
        couldBeWrong: f.could_be_wrong,
      })),
    });
  } catch (e) {
    return failed(e);
  }
}

