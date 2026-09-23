import type { Metadata } from "next";
import { GA_COUNTIES } from "@/lib/core/registry";
import { Unclaimed } from "./Unclaimed";

export const metadata: Metadata = {
  title: "Money you may already be losing",
  description:
    "Homestead and senior exemptions, assessment appeals, and the capital gains exclusion. Worth checking whether or not you ever sell. Free, and no account.",
};

export const revalidate = 86400;

/**
 * The lowest-commitment door on the seller side, and deliberately a whole page
 * rather than a section of the readout.
 *
 * None of this has anything to do with selling. A homeowner who is overpaying
 * property tax because they never filed for homestead is losing money every
 * year whether they list or not, and telling them so, with nothing asked in
 * return, is the most credible thing this product does. Somebody who saves
 * $600 a year on a page that never asked for their email remembers who told
 * them.
 */
export default function UnclaimedPage() {
  return <Unclaimed counties={GA_COUNTIES} />;
}
