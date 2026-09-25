import type { Metadata } from "next";
import { HowItWorks } from "@/components/rift/site/HowItWorks";

export const metadata: Metadata = {
  title: "How buying with Rift works",
  description: "From your first question to your keys: what happens at each step of buying a home in Georgia with Rift, and what you get along the way. You pay Rift nothing.",
};

/**
 * How it works, for buyers (Blueprint v5 §5.8).
 *
 * The process and the value, in the order a buyer lives them. The rules that
 * used to fill this page (no model writes a number, assistance is never
 * counted until approved) are still enforced where the numbers are made, and
 * each answer shows its own assumptions; they do not need restating here as
 * a list of refusals.
 */
export default function BuyHowPage() {
  return (
    <HowItWorks
      side="buy"
      kicker="For buyers in Georgia"
      title="How buying with Rift works"
      lede="You start with your own numbers, not a sales call. Everything after that is at your pace, and you can see where things stand at every step."
      transaction="purchase"
      cta={{ href: "/buy/assistance", label: "Check my programs" }}
      steps={[
        { title: "Start with a question", tag: "Free",
          body: "Pick the one on your mind: which Georgia programs might help, how much cash you really need, what you would pay each month, or when you could buy. Each takes a minute or two, with no account." },
        { title: "See your own numbers", tag: "Yours to keep",
          body: "Every answer is worked out from what you tell us, line by line, with what it assumes. Each one reuses what you have already said, so you are never asked twice." },
        { title: "Keep your plan", tag: "When you want",
          body: "Save your answers together and reopen them on any device. Ask Kaleb to look over them and he will tell you what he would do next." },
        { title: "Talk it through", tag: "Only if you ask",
          body: "A short call with Kaleb about the one thing standing between you and a date, whether that is savings, credit or finding the right program." },
        { title: "Search, see homes and make an offer", tag: "With Kaleb",
          body: "Kaleb searches with you, books showings and writes your offers. You follow every home, showing and offer in your own portal, and your household can too." },
        { title: "Under contract to the keys", tag: "Every date tracked",
          body: "Inspection, appraisal, financing and closing, each with its date checked against the contract. The home is yours once closing is confirmed, and your records stay with you." },
      ]}
    />
  );
}
