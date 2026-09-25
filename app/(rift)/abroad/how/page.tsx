import type { Metadata } from "next";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { HowItWorks } from "@/components/rift/site/HowItWorks";
import { RENT_RATIO_SOURCE } from "@/lib/core/abroad";

export const metadata: Metadata = {
  title: "How buying from abroad works",
  description:
    "You don't need citizenship, a green card or a visa to own property in the United States. What happens at each step of buying a Georgia home from abroad. You pay Rift nothing.",
  alternates: { canonical: "/abroad/how" },
};

/**
 * The diaspora funnel's third door.
 *
 * It did not have one. `/buy` and `/sell` each have a `/how`, and the footer
 * of `/abroad` sent its readers to `/buy/how`: a page written for a domestic
 * first-time buyer, which answers where the assistance figures come from and
 * how Kaleb is paid, and answers not one of the questions somebody in Addis
 * or Dubai is actually holding. They arrive wanting to know whether they are
 * even allowed to do this, and leave having read about down payment
 * assistance they cannot apply for.
 *
 * WHAT THIS PAGE REFUSES TO DO, AND WHY IT IS MOST OF THE DESIGN.
 *
 * Almost every question a foreign buyer has is a tax question or an
 * immigration question, and Kaleb is a licensed real-estate agent: neither a
 * tax adviser nor an attorney. The tempting page here is the one that answers
 * everything: withholding rates, filing thresholds, whether to hold the
 * property personally or in an entity. That page would be this product's
 * worst failure, because its entire argument is that its numbers are honest,
 * and a confident wrong number about somebody's tax exposure is
 * indistinguishable on screen from a right one.
 *
 * So the page is organised the other way round. It states plainly the small
 * number of things that are settled and uncontroversial, and for everything
 * else it names the question and the profession that answers it. "Here is
 * what you will be asked, and who to ask" is genuinely useful to somebody
 * eight time zones away who does not know what they do not know, and it is
 * true, which the alternative is not.
 *
 * Rewritten as a process in Blueprint v5 §5.8 (Kaleb: these pages read like
 * a legal document). The rule above survives in step four: the questions are
 * named with the profession that answers them, and no tax figure is given.
 *
 * The English-only notice is deliberate and sits at the top rather than the
 * bottom. `/abroad` is a real Amharic page; this one is not yet. Serving
 * English under a language toggle without saying so is the same class of
 * quiet substitution the rest of this product exists to avoid.
 */
export default function AbroadHowPage() {
  return (
    <HowItWorks
      side="abroad"
      kicker="Buying from abroad"
      title="How buying from abroad works"
      lede="You don't need citizenship, a green card, or a visa to own property in the United States. Here is what happens, step by step, from wherever you live."
      transaction="purchase"
      cta={{ href: "/abroad", label: "Check if I can buy" }}
      notice={
        /* Said once, before the steps, in both scripts. A reader who came
           through the Amharic page should learn this one is not translated
           here, not three sections in. */
        <div className="card p-4" style={{ background: "var(--sunk)" }}>
          <div className="row gap-2" style={{ alignItems: "flex-start" }}>
            <Ico.info size={14} className="c-4" style={{ flex: "none", marginTop: 3 }} />
            <div>
              <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>
                This page is in English only so far. <Link href="/abroad" className="u">The main page</Link>{" "}
                is in Amharic too, and this one will be once someone who speaks it has written it.
              </p>
              <p className="t-xs c-3" lang="am" style={{ marginTop: 6, lineHeight: 1.7 }}>
                ይህ ገጽ እስካሁን በእንግሊዝኛ ብቻ ነው።
              </p>
            </div>
          </div>
        </div>
      }
      steps={[
        { title: "Check you can buy", tag: "Free",
          body: "Tell us your residency status and see what it means for owning, financing and closing. For most people the answer to \"am I allowed?\" is yes; the real questions are about money and paperwork." },
        { title: "See what it would cost and earn", tag: "Yours to keep",
          body: <>The cash you would send, what owning costs each year, and what renting it out could leave. {rentBasis()}</> },
        { title: "Decide how you will pay", tag: "First, because it sets your budget",
          body: "Cash, or a loan from a lender who works with buyers without U.S. credit history, which usually means a larger deposit. Kaleb can introduce lenders who do this." },
        { title: "Line up the right advisers", tag: "Before you buy",
          body: "Tax on rent, what is withheld when you one day sell, and whether to own personally or through a company are questions for a U.S. tax adviser and an attorney. Kaleb can introduce people who do this work, and you are free to use your own." },
        { title: "Find the home and make an offer", tag: "With Kaleb",
          body: "Video tours, showings on your behalf, inspections and offers, with every step in your own portal, in Atlanta time with your time zone in mind." },
        { title: "Close from where you are", tag: "Every date tracked",
          body: "Signing, identity checks and sending the money arranged remotely with the closing attorney, then the keys and your records. If you plan to rent it out, a property manager can take it from there." },
      ]}
    />
  );
}

/**
 * What this page is allowed to say about where the rent figure comes from.
 *
 * Read from `RENT_RATIO_SOURCE` rather than written out, for the reason its
 * own docblock gives: the disclosure and the data must not be able to drift
 * apart. `/abroad` used to tell readers the rent was "estimated from county
 * averages" when the ratios were, and always had been, engineering's own
 * assumptions. If real ratios ever land with a source attached, this sentence
 * changes with them instead of going on being wrong in a second place.
 */
function rentBasis(): string {
  if (RENT_RATIO_SOURCE.basis === "published" && RENT_RATIO_SOURCE.name) {
    return `The rent comes from ${RENT_RATIO_SOURCE.name}, a published average, and your house is not an average, so the return is marked as an estimate.`;
  }
  return "The rent is our own estimate for the county, not an observation of what homes there rent for, so the return is marked as an estimate. A local property manager's rent figure is the best check.";
}
