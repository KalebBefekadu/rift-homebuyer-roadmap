import type { Metadata } from "next";
import { HowItWorks } from "@/components/rift/site/HowItWorks";

export const metadata: Metadata = {
  title: "How selling with Rift works",
  description: "From your first question to closing: what happens at each step of selling a home in Georgia with Rift, and what you get along the way. You pay Rift nothing.",
};

/**
 * How it works, for sellers (Blueprint v5 §5.8), in the same shape as the
 * buyer page. The detail on commission that used to sit here now lives where
 * it matters: the seller values ask for it and show a range when none is
 * agreed (MONEY-06).
 */
export default function SellHowPage() {
  return (
    <HowItWorks
      side="sell"
      kicker="For sellers in Georgia"
      title="How selling with Rift works"
      lede="You start with what the sale would actually leave you, not a list price. Everything after that is at your pace, and you can see where things stand at every step."
      transaction="sale"
      cta={{ href: "/sell/proceeds", label: "See what I'd keep" }}
      steps={[
        { title: "Start with a question", tag: "Free",
          body: "What would you keep after the loan and every cost of selling? What would selling cost? Are you losing money on your home already? Each takes a minute, with no account." },
        { title: "See your own numbers", tag: "Yours to keep",
          body: "Worked out from your price, what you owe and the commission you agree, line by line. The price is your number: nothing here pretends to value your home." },
        { title: "Talk it through", tag: "Only if you ask",
          body: "A short call with Kaleb about timing, what is worth fixing first, and whether now is the right time to sell." },
        { title: "Prepare and price", tag: "With Kaleb",
          body: "What is worth doing before you list and what is not, then a price and a plan for the launch." },
        { title: "List, show and compare offers", tag: "On what reaches you",
          body: "Showings and feedback as they happen. Offers are compared on what actually reaches you, not only on the headline price." },
        { title: "Under contract to closing", tag: "Every date tracked",
          body: "Inspection, appraisal, title and settlement, each with its date checked against the contract, through to your payoff and your proceeds." },
      ]}
    />
  );
}
