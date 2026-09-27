import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { forwardTo } from "@/lib/core/forward";

/* A forward, not a page: nothing here to index. */
export const metadata: Metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * The old buyer questionnaire, retired by Blueprint v5 (§5.1, §5.6): one long
 * form producing one crowded readout became separate values, each with its
 * own few questions. The old landing sent people here with their county and
 * ownership answered, under its assistance headline, so the forward goes to
 * the assistance value with those answers kept. A share handle (`r`) and
 * campaign tags travel too, so the first touch credits the right source
 * (lib/core/forward.ts).
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardTo("/buy/assistance", await searchParams, { c: "c", o: "o" }, ["r"]));
}
