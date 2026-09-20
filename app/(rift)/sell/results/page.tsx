import type { Metadata } from "next";
import { netProceeds, repairTriage, unclaimedValue } from "@/lib/core/compute";
import { parseSellerParams } from "@/lib/core/params";
import { sellerReadout } from "@/lib/core/results";
import { Readout } from "./Readout";

export const metadata: Metadata = {
  title: "Your readout",
  description: "What selling actually leaves you, worked out from your answers.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * The seller readout.
 *
 * Same discipline as the buyer side: every figure is computed on the server
 * from the same engine, and the browser receives numbers rather than the
 * arithmetic. The page is URL-addressable and shareable, so a figure computed
 * in the browser from query parameters is a figure anybody can edit — and
 * "Rift says I clear $180,000" has to be false.
 *
 * Unlike the buyer readout this needs no registry and no rate: net proceeds are
 * arithmetic on the answers plus Georgia transfer tax, so there is nothing here
 * that can go stale between the assessment and the page.
 */
export default async function SellResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const { inputs, timing, timingStated, coDecider, substituted } = parseSellerParams(one);

  const proceeds = netProceeds(inputs);
  const repairs = repairTriage(inputs.price);
  const unclaimed = unclaimedValue(inputs);
  const readout = sellerReadout(inputs, timing, timingStated);

  return (
    <Readout
      inputs={inputs}
      timing={timing}
      readout={readout}
      proceeds={proceeds}
      repairs={repairs}
      unclaimed={unclaimed}
      coDecider={coDecider}
      substituted={substituted}
    />
  );
}
