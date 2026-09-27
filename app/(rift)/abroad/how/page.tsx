import type { Metadata } from "next";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { HowItWorks } from "@/components/rift/site/HowItWorks";
import { RENT_RATIO_SOURCE } from "@/lib/core/abroad";

export const metadata: Metadata = {
  title: "How buying from abroad works",
  description:
    "You do not need citizenship, a green card or a visa to own a home in the United States. What it takes from abroad, which questions belong to a tax adviser or attorney, and how buying with Kaleb works.",
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
 * The English-only notice is deliberate and sits at the top rather than the
 * bottom. `/abroad` is a real Amharic page; this one is not yet. Serving
 * English under a language toggle without saying so is the same class of
 * quiet substitution the rest of this product exists to avoid.
 */
export default function AbroadHowPage() {
  return (
    <HowItWorks
      side="abroad"
      title="Buying a home in the United States from abroad."
      lede="For somebody who is not in the United States, may never have lived there, and wants to know what is possible before spending an evening on it."
      steps={[
        { title: "Find out whether you can buy", body: "You do not need citizenship, a green card or a visa to own property in the United States. Your status decides how you pay and borrow, not whether you are allowed." },
        { title: "See what it would take", body: "What you would send to buy, what owning costs each year, and, if you would rent it out, what could come back, each worked out from your answers and marked where it is an estimate." },
        { title: "Talk to Kaleb across the time difference", body: "Book a call at a time that works where you are. He will tell you what is settled, and which questions belong to a tax adviser or an attorney." },
        { title: "Buy without being in the room", body: "Remote signing, identity checks, inspections and the money's arrival are ordinary work, arranged before they are needed rather than in the last week." },
      ]}
      gives={[
        { title: "A straight answer on permission", body: "Most people arrive asking whether they are allowed. They are, and the rest is money and paperwork." },
        { title: "Numbers that say what they are", body: "Calculated figures are labelled as calculated; the rent figure is labelled as our own estimate until real county figures replace it." },
        { title: "The right professional for each question", body: "Tax, withholding and ownership structure named plainly, with who answers each, rather than a guessed number." },
        { title: "One person on the ground", body: "A licensed Georgia agent who does this from start to finish, so distance is not the reason a purchase slips." },
      ]}
      fees="The only fees are the ones any purchase has, such as agent, lender, closing and international transfer costs, and you see them before they apply."
      start={{ href: "/abroad", label: "Check if I can buy" }}
      extra={<AbroadDetail />}
    />
  );
}

/* The settled facts and the questions with a professional attached: the
   part of the old page worth keeping (see the docblock above). */
function AbroadDetail() {
  return (
    <section className="sec-sm" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        <div className="row-t gap-2">
          <Ico.alert size={14} className="c-4" style={{ flex: "none", marginTop: 3 }} />
          <div>
            <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>
              This page is in English only so far. <Link href="/abroad" className="u">The main page</Link>{" "}
              is available in Amharic, and this one will be once it has been written by somebody who speaks it,
              not by a machine.
            </p>
            <p className="t-xs c-3" lang="am" style={{ marginTop: 6, lineHeight: 1.7 }}>
              ይህ ገጽ እስካሁን በእንግሊዝኛ ብቻ ነው።
            </p>
          </div>
        </div>
      </div>

      <Block title="What is harder from abroad, and why">
        <ul>
          <li><strong>A mortgage, if you have no U.S. credit history.</strong> Lenders who work with foreign nationals exist and usually ask for a larger deposit. It decides your budget, so it is the first thing worth establishing.</li>
          <li><strong>Paying cash</strong> removes most of the difficulty and raises a different question: how the money arrives, and what the closing attorney needs to see for it. Ask early.</li>
          <li><strong>Distance.</strong> Signing, identity checks and inspections assume somebody is in the room. They are solvable, and they make the timeline longer than a domestic purchase.</li>
        </ul>
      </Block>

      <Block title="The questions with a professional attached">
        <p>
          These have real answers, but not from us: Kaleb is a licensed Georgia real-estate agent, not a tax
          adviser and not an attorney.
        </p>
        <ul>
          <li><strong>Tax on rental income, and what you file.</strong> It depends on your country&rsquo;s treaty with the United States and how you hold the property. <em>Ask a U.S. tax adviser who works with non-resident owners.</em></li>
          <li><strong>Withholding when you sell.</strong> Tax is withheld at closing when a foreign person sells, and it is not the same as the tax owed. <em>Same adviser, and ask before you buy.</em></li>
          <li><strong>Buying personally or through an entity.</strong> It changes your tax, your liability and your costs. <em>Ask the tax adviser and an attorney together.</em></li>
          <li><strong>A taxpayer identification number.</strong> You will likely need one. <em>The tax adviser handles it; it is routine.</em></li>
        </ul>
        <p>Kaleb can introduce you to people who do this work; you are free to use your own.</p>
      </Block>

      <Block title="What the numbers are, and are not">
        <p>
          The purchase costs and the yearly cost of owning are <strong>calculated</strong> from published figures and your
          answers. The <strong>rent is not</strong>. {rentBasis()} Before relying on a return, get a rent estimate from
          somebody who manages property in that county.
        </p>
        <p>
          The figures do not assume a homestead exemption: it applies to a home you live in as your main residence,
          which an overseas owner is not doing.
        </p>
      </Block>
    </section>
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
    return `It comes from ${RENT_RATIO_SOURCE.name}, which is a published source rather than our own guess, but it is still an average, and your specific house is not an average.`;
  }
  return "It is our own assumption about what property in that county rents for, not an observation of what it actually rents for, and we would rather say so than dress it up as data.";
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>{title}</h2>
      <div className="t-sm c-2 how-body" style={{ marginTop: 10, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}
