import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { forwardTo, SELL_RENAME } from "@/lib/core/forward";

export const metadata: Metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * The old seller readout, retired by Blueprint v5 (§5.8: "show only the value
 * the person came for"). It also assumed a 5.5% commission and counted moving
 * as a cost of the sale, which MONEY-06 rules out. Old links forward to what
 * you would keep, with their answers; the commission is then asked. Readouts
 * already issued are snapshots at /r/<token> and are untouched.
 */
export default async function SellResults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardTo("/sell/proceeds", await searchParams, SELL_RENAME));
}
