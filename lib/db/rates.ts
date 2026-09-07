import "server-only";
import { serviceClient } from "./service";
import { describeRate, FALLBACK_RATE, type RateAssumption } from "@/lib/core/rate";

/**
 * The current rate assumption.
 *
 * Never throws and never returns nothing: a missing rate falls back to the
 * documented starting assumption, clearly labelled as one. The alternative —
 * refusing to compute — would take the product down over a number it can
 * reasonably estimate, and the fallback is the same 6.5% the engine used
 * before this table existed.
 *
 * What changes is that the product now says which it is using and when it was
 * true, on every figure the rate touches.
 */
export async function currentRate(today = new Date()): Promise<RateAssumption> {
  const db = serviceClient();
  if (!db) return describeRate(FALLBACK_RATE.pct, FALLBACK_RATE.source, null, today);

  try {
    const { data, error } = await db
      .from("rift_rate_snapshots")
      .select("rate_pct,source,as_of")
      .eq("product", "conventional-30-fixed")
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return describeRate(FALLBACK_RATE.pct, FALLBACK_RATE.source, null, today);
    return describeRate(Number(data.rate_pct), data.source as string, data.as_of as string, today);
  } catch {
    return describeRate(FALLBACK_RATE.pct, FALLBACK_RATE.source, null, today);
  }
}
