import type { Metadata } from "next";
import { HowItWorks } from "@/components/rift/site/HowItWorks";

export const metadata: Metadata = {
  title: "How selling with Rift works",
  description: "See what a sale would leave you, what you may be missing, and what to fix first, then sell with Kaleb when you are ready. You pay Rift nothing.",
};

/**
 * How selling works (Blueprint v5 §5.8, Kaleb R1), the same lens as buying.
 * No generated valuation anywhere in it: the price is the seller's, and
 * Kaleb's opinion of it is his, given in person (§9).
 */
export default function SellHow() {
  return (
    <HowItWorks
      side="sell"
      title="From “what would I keep?” to the closing table."
      lede="Rift answers what sellers want to know before they list, then carries those answers through the sale."
      steps={[
        { title: "Ask the question you have", body: "What you would keep, whether you are losing money on your home already, what selling costs, or what to fix first. Each asks only a few questions." },
        { title: "See your answer, worked out", body: "From your own figures and Georgia's published costs, line by line, with commission as the number you agree, never a standard rate." },
        { title: "Keep your plan", body: "Save what you found and reopen it on any device." },
        { title: "Talk to Kaleb when you are ready", body: "Ask him to look over your numbers, or book a call. He gives you his own view of price and preparation, starting from what you already know." },
        { title: "Sell with Kaleb", body: "Preparation, pricing, launch, showings and feedback, then offers compared on what each one leaves you rather than on price, through to closing." },
      ]}
      gives={[
        { title: "What you would keep", body: "The sale price is not the number. What reaches you after the loan and the costs of selling is." },
        { title: "Money you may be missing", body: "Exemptions you may not have filed and appeal dates that apply, useful even if you are not selling yet." },
        { title: "What is worth fixing", body: "What to address before listing, what maybe, and what can wait, without invented returns." },
        { title: "Offers on net", body: "When offers arrive, each is shown as what it leaves you after its terms, not only its price." },
      ]}
      fees="The only fees are the ones any home sale has, such as the commission you agree and Georgia's closing costs, and you see them before they apply."
      start={{ href: "/sell", label: "Start with a question" }}
    />
  );
}
