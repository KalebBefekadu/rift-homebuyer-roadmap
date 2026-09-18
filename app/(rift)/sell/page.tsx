import type { Metadata } from "next";
import { GA_COUNTIES } from "@/lib/core/registry";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Know what selling actually leaves you",
  description:
    "Every valuation you have been given is a list price. See what actually reaches you after payoff, commission, concessions and Georgia transfer tax — free, before you talk to anyone.",
};

/* Nothing on this page depends on programme data or a rate, so it can be
   cached hard. The figures are arithmetic on published Georgia rates. */
export const revalidate = 86400;

/**
 * The seller landing page.
 *
 * The buyer thesis is "the down payment is not the number". The seller thesis
 * is its mirror: the list price is not the number either. Both pages exist to
 * replace the figure somebody is carrying around with the one that decides
 * whether the move actually works.
 *
 * The example is computed here rather than written into the copy, so it cannot
 * drift away from the engine that produces the reader's own figure two clicks
 * later.
 */
export default function SellLandingPage() {
  return <Landing counties={GA_COUNTIES} />;
}
