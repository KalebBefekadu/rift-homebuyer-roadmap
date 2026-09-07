import type { Metadata } from "next";
import { matchForVisitor } from "@/lib/db/match";
import { money, range } from "@/lib/core/compute";
import { GA_COUNTIES } from "@/lib/core/registry";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Know what buying actually takes",
  description:
    "The down payment is not the number. See the real cash to close, the Georgia assistance you may qualify for, and how far away you actually are — free, before you talk to anyone.",
};

/* Rates and programme data move. A landing page cached for a day would quote
   a figure that is no longer true, which is the one thing this product cannot
   do. An hour is short enough to be honest and long enough to be cheap. */
export const revalidate = 3600;

/**
 * The buyer landing page.
 *
 * Server-rendered, and the assistance figure is computed here rather than
 * fetched by the browser. Two reasons, and the second is the real one:
 *
 *   1. It is the number that makes someone keep reading, so it must be in the
 *      first paint rather than arriving after a spinner on a phone.
 *   2. It is a claim about money. Computing it on the server means it comes
 *      from the same registry read the readout uses, so the range promised on
 *      the landing page and the range shown after the assessment cannot
 *      disagree — which they would, sooner or later, if the browser computed
 *      one of them.
 */
export default async function BuyLanding() {
  /* DeKalb is the agent's largest county and the honest default for a visitor
     who has not told us anything yet. The hero asks immediately. */
  const { match, source } = await matchForVisitor("DeKalb", true);

  return (
    <Landing
      counties={GA_COUNTIES}
      openRange={match.openMin > 0 ? range(match.openMin, match.openMax) : null}
      matchedCount={match.matched.length}
      suppressedCount={match.suppressed.length}
      exampleCash={money(26_188)}
      exampleDown={money(11_375)}
      registrySource={source}
    />
  );
}
