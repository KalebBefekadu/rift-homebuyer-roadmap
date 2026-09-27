import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { forwardTo, BUY_READOUT_RENAME } from "@/lib/core/forward";

export const metadata: Metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * The old buyer readout, retired by Blueprint v5 (§5.8: "too complicated and
 * confusing... show only the value the person came for"). It also added every
 * matched program into one total, which §6.4 rules out. Old links forward to
 * cash to close, the site's core idea, with the answers they carried; the
 * other values are offered from there and reuse them. Readouts already
 * issued are snapshots at /r/<token> and are untouched.
 */
export default async function BuyResults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardTo("/buy/cash-to-close", await searchParams, BUY_READOUT_RENAME));
}
