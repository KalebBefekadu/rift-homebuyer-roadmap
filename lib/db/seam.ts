import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead } from "./bounded";
import { done, skipped, type DbResult } from "./result";
import { drift, mustDisclose, type Drift } from "@/lib/core/seam";
import type { TrustState } from "@/lib/core/review";
import { cashToClose, cashGap, monthlyComputed, BUYER_DEFAULTS, type BuyerInputs } from "@/lib/core/compute";
import { firstTimeFrom, type Ownership } from "@/lib/core/funnel";
import { matchForVisitor } from "./match";
import { currentRate } from "./rates";

/**
 * The crossing from a free readout to a published plan.
 *
 * `lib/core/seam.ts` has described this since before there was a plan to
 * publish, and nothing called it. The rule it exists to enforce is the one in
 * its own docblock: the plan recomputes, and it says so when it disagrees.
 * Quietly replacing a number somebody has already told their partner is the
 * worst thing this product could do to a new client, and it is the easiest,
 * because a corrected number renders exactly as well as the original.
 *
 * WHAT CAN ACTUALLY MOVE, AND WHY THAT IS A SHORT LIST.
 *
 * The person's own answers are frozen in the snapshot, so price, savings,
 * income and county cannot drift — they are read back from the same row. Two
 * things genuinely move underneath them:
 *
 *   The rate. It is refreshed every Friday from Freddie Mac, and it is the
 *   assumption the monthly payment is built on.
 *
 *   The registry. Programmes close, run out of funding, change their income
 *   limits, or fall out of verification and get withheld. A matched programme
 *   that has since closed must disappear from the plan and be explained.
 *
 * A third thing can move and should never move quietly: the engine itself. If
 * cash-to-close is recomputed from identical inputs and comes back different,
 * the arithmetic changed between the readout and the plan. That is either a
 * fix worth telling somebody about or a regression worth catching, and it is
 * the reason this compares every figure rather than only the two with obvious
 * causes.
 */

export interface SnapshotComparison {
  hasSnapshot: boolean;
  /** When they were shown these numbers. */
  takenAt: string | null;
  side: "buy" | "sell" | null;
  drifts: Drift[];
  /** The subset that has moved far enough that the plan must say so. */
  material: Drift[];
  /** Programmes matched at the readout that no longer match. */
  lostProgrammes: string[];
  trustStates: TrustState[];
}

const EMPTY: SnapshotComparison = {
  hasSnapshot: false, takenAt: null, side: null,
  drifts: [], material: [], lostProgrammes: [], trustStates: [],
};

/**
 * The fields of a stored blob that are safe to use, and only those.
 *
 * NOT a plain spread. `{ ...DEFAULTS, ...stored }` lets a key present with the
 * value `null` — which is what a jsonb column returns for a field written as
 * absent, and what `JSON.stringify` produces for several of these — overwrite
 * a perfectly good default with nothing. The engine then formats `null.toFixed`
 * and throws, inside the server action, at the moment the agent presses
 * publish. Only finite numbers and non-empty strings are taken; everything
 * else leaves the documented assumption in place, which is the same assumption
 * the readout itself was computed with.
 */
function usable(raw: Record<string, unknown>): Partial<BuyerInputs> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in BUYER_DEFAULTS)) continue;
    const want = typeof (BUYER_DEFAULTS as unknown as Record<string, unknown>)[k];
    if (want === "number" && typeof v === "number" && Number.isFinite(v)) out[k] = v;
    if (want === "string" && typeof v === "string" && v.trim()) out[k] = v;
  }
  return out as Partial<BuyerInputs>;
}

const OWNERSHIPS: Ownership[] = ["none", "primary", "investment"];
const ownershipOf = (v: unknown): Ownership =>
  OWNERSHIPS.find((o) => o === v) ?? "none";

/** A figure as it was stored, in whole currency rather than cents. */
interface Stored {
  label: string;
  value: number;
  trustState: TrustState;
}

/**
 * Compare a lead's readout snapshot against the same arithmetic run today.
 *
 * Never throws and never guesses. A lead with no snapshot comes back
 * `hasSnapshot: false`, which `canPublish` treats as a blocker — a plan with
 * nothing to be honest about cannot be honest.
 */
export async function compareToSnapshot(leadId: string): Promise<DbResult<SnapshotComparison>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("not signed in");

  const lead = await boundedRead(
    db.from("rift_leads").select("id,assessment_id,side").eq("id", leadId).eq("agent_id", agentId).maybeSingle(),
    "the relationship",
  );
  if (!lead.ok) return lead;
  const leadRow = ("data" in lead ? lead.data : null) as { assessment_id: string | null } | null;
  if (!leadRow?.assessment_id) return done(EMPTY);

  const readout = await boundedRead(
    db.from("rift_readouts").select("id,side,inputs,matched,created_at")
      .eq("assessment_id", leadRow.assessment_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "their readout",
  );
  if (!readout.ok) return readout;
  const snap = ("data" in readout ? readout.data : null) as {
    id: string; side: "buy" | "sell"; inputs: Record<string, unknown>;
    matched: { id: string; name: string }[] | null; created_at: string;
  } | null;
  if (!snap) return done(EMPTY);

  const figs = await boundedRead(
    db.from("rift_figures").select("label,value_cents,trust_state").eq("readout_id", snap.id).limit(24),
    "their figures",
  );
  const stored: Stored[] = figs.ok && "data" in figs
    ? (figs.data as Record<string, unknown>[]).map((f) => ({
        label: f.label as string,
        /* Cents in, currency out. The snapshot stores cents precisely so this
           comparison is not deciding whether $0.004 is a material change. */
        value: Number(f.value_cents ?? 0) / 100,
        trustState: (f.trust_state as TrustState) ?? "preliminary",
      }))
    : [];

  const base: SnapshotComparison = {
    ...EMPTY,
    hasSnapshot: true,
    takenAt: snap.created_at,
    side: snap.side,
    trustStates: stored.map((s) => s.trustState),
  };

  /* Only the buyer side recomputes today. The seller readout's figures depend
     on a valuation that is not stored as an input, so there is nothing honest
     to recompute it from — and an empty drift list on a seller is the truthful
     answer rather than a reassuring one, because `hasSnapshot` is still true
     and the snapshot is still shown. */
  if (snap.side !== "buy") return done(base);

  /**
   * The stored blob, filled out against the defaults before anything runs.
   *
   * A snapshot is written by whichever build was live on the day, and the
   * engine's input shape has grown since. `cashToClose` reads `downPct` and
   * formats it, so a snapshot predating that field does not produce a wrong
   * comparison — it throws, inside a server action, at the moment the agent
   * presses publish. Merging over BUYER_DEFAULTS means a missing field falls
   * back to the documented assumption, which is exactly what the readout it
   * came from would have used.
   *
   * `price` is still required rather than defaulted. It is the one number
   * there is no sensible assumption for, and comparing against a made-up
   * $325,000 house would produce a confident drift about somebody else.
   */
  const raw = (snap.inputs ?? {}) as Record<string, unknown>;
  if (typeof raw.price !== "number") return done(base);
  const inputs: BuyerInputs = { ...BUYER_DEFAULTS, ...usable(raw), price: raw.price };

  const [match, rate] = await Promise.all([
    /* The stored value is narrowed rather than cast. A snapshot written by an
       older build could carry anything here, and "none" is the assumption that
       matches the most programmes — so an unrecognised value fails towards
       showing somebody more help rather than less, and the plan's own intake
       asks again anyway. */
    matchForVisitor(inputs.county, firstTimeFrom(ownershipOf(raw.ownership))),
    currentRate(),
  ]);

  const thenRate = typeof inputs.ratePct === "number" ? inputs.ratePct : null;
  const rateMoved = thenRate !== null && Math.abs(rate.pct - thenRate) > 0.001;

  /* Named causes, from what actually differs. A drift with no named cause is a
     bug report, which is why `drift()` demands one. */
  const rateCause = rateMoved
    ? `the rate assumption moved from ${thenRate!.toFixed(2)}% to ${rate.pct.toFixed(2)}%`
    : "recomputed from the same answers — the arithmetic itself changed";

  const wasMatched = (snap.matched ?? []).map((m) => m.name);
  const nowMatched = match.match.matched.map((m) => m.name);
  const lostProgrammes = wasMatched.filter((n) => !nowMatched.includes(n));
  const programmeCause = lostProgrammes.length
    ? `${lostProgrammes.length} programme${lostProgrammes.length === 1 ? "" : "s"} no longer match: ${lostProgrammes.join(", ")}`
    : "the programmes they matched changed";

  const drifts: Drift[] = [];
  /* The whole recompute, guarded. `usable()` fixes the shapes this build knows
     about; a snapshot written by a build nobody here has seen is still a blob
     off the wire. The honest outcome of "we could not recompute" is an empty
     drift list beside a snapshot that still exists — not a server action that
     throws while somebody is publishing a plan. */
  try {
  const live = { ...inputs, ratePct: rate.pct };
  const now = {
    "Cash to close": cashToClose(live).total,
    "All-in monthly": monthlyComputed(live).value,
    "Still to find": cashGap(live).gap,
    "Covered": cashGap(live).gap,
  } as Record<string, number | undefined>;

  for (const s of stored) {
    const recomputed = now[s.label];
    if (recomputed === undefined) continue;
    /* The cause is chosen by which figure it is, because the two things that
       move do not both feed every figure. Monthly is the rate's; the gap is
       the registry's; cash to close depends on neither, so a move there means
       the engine changed. */
    const cause =
      s.label === "All-in monthly" ? rateCause
      : s.label === "Still to find" || s.label === "Covered" ? programmeCause
      : "recomputed from the same answers — the arithmetic itself changed";
    drifts.push(drift(s.label, s.value, Math.round(recomputed), cause));
  }

  } catch {
    return done({ ...base, lostProgrammes });
  }

  return done({ ...base, drifts, material: mustDisclose(drifts), lostProgrammes });
}
