import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { forwardTo, SELL_RENAME } from "@/lib/core/forward";

/* A forward, not a page: nothing here to index. */
export const metadata: Metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * The old seller questionnaire, retired by Blueprint v5 (§5.3, §5.6): the
 * seller side is now separate values. Its links carried the landing's price,
 * payoff and county, so it forwards to what you would keep with those
 * answers already given (lib/core/forward.ts).
 */
export default async function SellStart({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardTo("/sell/proceeds", await searchParams, SELL_RENAME, ["r"]));
}
