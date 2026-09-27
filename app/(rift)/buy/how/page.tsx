import type { Metadata } from "next";
import { HowItWorks } from "@/components/rift/site/HowItWorks";

export const metadata: Metadata = {
  title: "How buying with Rift works",
  description: "Ask one question, get an answer worked out from your own numbers, keep it as a plan, and buy with Kaleb when you are ready. You pay Rift nothing.",
};

/**
 * How buying works (Blueprint v5 §5.8, Kaleb R1): the process and what Rift
 * gives, in the order a buyer lives it. The shared layout carries the one
 * money message.
 */
export default function BuyHow() {
  return (
    <HowItWorks
      side="buy"
      title="From your first question to your keys."
      lede="Rift answers the questions buyers have before they talk to anyone, then carries those answers all the way to closing."
      steps={[
        { title: "Ask the question you have", body: "Which Georgia programs might help, how much cash you really need, what you would pay each month, or when you could buy. Each asks only a few questions of its own, and never asks the same thing twice." },
        { title: "See your answer, worked out", body: "Every figure is calculated from your answers and published figures, and shows what it assumes and where it could be wrong. Programs are checked against their own official pages." },
        { title: "Keep your plan", body: "Save the answers you found as one plan and reopen it on any device. Nothing is held back if you would rather not." },
        { title: "Talk to Kaleb when you are ready", body: "Ask him to look over your numbers, or book a call at a time that suits you. He starts from your plan, so you do not start over." },
        { title: "Buy with Kaleb", body: "Your plan becomes your search. Your household gets a private page with the homes, the showings, your offers and every contract date, each checked against the documents, through to the day you get the keys." },
      ]}
      gives={[
        { title: "The real number, first", body: "The cash a purchase takes, not only the down payment, before you are three weeks from closing." },
        { title: "Help you might have missed", body: "Georgia assistance from the state, counties, cities and banks, with what each checks and what still needs confirming." },
        { title: "Answers you keep", body: "Every answer is yours whether or not you ever speak to anyone, and you can share it as a link." },
        { title: "No starting over", body: "What you worked out here becomes the brief for your search, with its dates, when you decide to buy." },
      ]}
      fees="The only fees are the ones any home purchase has, such as agent, lender and closing costs, and you see them before they apply."
      start={{ href: "/buy", label: "Start with a question" }}
    />
  );
}
