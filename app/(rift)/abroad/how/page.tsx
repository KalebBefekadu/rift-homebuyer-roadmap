import type { Metadata } from "next";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { RENT_RATIO_SOURCE } from "@/lib/core/abroad";

export const metadata: Metadata = {
  title: "How buying from abroad works",
  description:
    "What a foreign buyer can and cannot do in Georgia, which questions have a professional attached to them, and how Rift is paid. No citizenship requirement, no green card, no advice we are not qualified to give.",
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
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/abroad" className="row gap-2">
            <Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <Link href="/abroad" className="btn btn-p btn-sm">See my numbers</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          How buying from abroad works
        </h1>

        <p className="t-sm c-3" style={{ marginTop: 14, lineHeight: 1.7 }}>
          Written for somebody who is not in the United States, may never have lived there, and
          wants to know what is actually possible before spending an evening on it.
        </p>

        {/* Said once, at the top, in both scripts. A reader who came through
            the Amharic page should find out that this one is not translated
            from this page rather than from three paragraphs of English. */}
        <div className="card p-4" style={{ marginTop: 18, background: "var(--sunk)" }}>
          <div className="row gap-2">
            <Ico.alert size={14} className="c-4" style={{ flex: "none", marginTop: 3 }} />
            <div>
              <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>
                This page is in English only so far. <Link href="/abroad" className="u">The main page</Link>{" "}
                is available in Amharic, and this one will be once it has been written by
                somebody who speaks it, not by a machine.
              </p>
              <p className="t-xs c-3" lang="am" style={{ marginTop: 6, lineHeight: 1.7 }}>
                ይህ ገጽ እስካሁን በእንግሊዝኛ ብቻ ነው።
              </p>
            </div>
          </div>
        </div>

        <Block title="You are allowed to do this">
          <p>
            There is <strong>no citizenship requirement and no residency requirement</strong> to
            own property in the United States. You do not need a green card, a visa, or to have
            ever set foot in Georgia. Foreign nationals buy American property every day, and
            Georgia places no additional restriction on residential purchases by non-citizens.
          </p>
          <p>
            That is the question most people arrive with, and it is one of the few here with a
            short answer. Nearly everything below it is a question about <em>money and paperwork</em>,
            not about permission.
          </p>
        </Block>

        <Block title="What is genuinely harder, and why">
          <ul>
            <li>
              <strong>A mortgage, if you have no U.S. credit history.</strong> Most ordinary
              lenders score a borrower using a credit file you will not have. Lenders who work
              with foreign nationals exist and price that risk differently, usually by asking
              for a larger deposit. This is the single biggest practical difference between your
              purchase and a domestic one, and it is the first thing worth establishing, because
              it decides your entire budget.
            </li>
            <li>
              <strong>Paying cash removes most of the difficulty</strong> and creates a different
              question, which is how the money arrives and what documentation the closing
              attorney needs for it. Ask that early rather than in the last week.
            </li>
            <li>
              <strong>Being eight time zones away.</strong> Signing, identity verification and
              inspections all assume somebody is in the room. They are solvable (this is
              ordinary work for an agent who has done it before), but they are what makes the
              timeline longer than the one on a domestic purchase.
            </li>
          </ul>
        </Block>

        <Block title="The questions with a professional attached">
          <p>
            These have real answers. They do not have answers <em>from us</em>: Kaleb is a
            licensed Georgia real-estate agent, which is not a tax adviser and not an attorney,
            and the honest version of this page names the question rather than guessing at the
            number.
          </p>
          <ul>
            <li>
              <strong>Tax on rental income, and what you have to file.</strong> Rental income
              from U.S. property is U.S.-source income. What you owe, what you can deduct, and
              which return you file depend on your own country&rsquo;s treaty with the United
              States and on how you hold the property. <em>Ask a U.S. tax adviser who works with
              non-resident owners.</em>
            </li>
            <li>
              <strong>Withholding when you eventually sell.</strong> The United States withholds
              tax at closing when a foreign person sells real property, and the amount withheld
              is not the same as the tax owed; the difference is reclaimed by filing. The rate,
              the exemptions and the paperwork are specific enough that a number quoted here
              would be worth less than nothing. <em>Same adviser, and ask before you buy rather
              than before you sell.</em>
            </li>
            <li>
              <strong>Whether to buy personally or through an entity.</strong> This changes your
              tax position, your liability and your costs, and there is no general right answer.
              <em> Ask the tax adviser and an attorney together.</em>
            </li>
            <li>
              <strong>A taxpayer identification number.</strong> You will likely need one to file
              anything. <em>The tax adviser handles this; it is routine.</em>
            </li>
          </ul>
          <p>
            Kaleb can introduce you to people who do this work. He is not paid for the
            introduction, and you are free to use your own.
          </p>
        </Block>

        <Block title="What the numbers on the main page are, and are not">
          <p>
            The purchase costs, the monthly carrying cost and the break-even deposit are{" "}
            <strong>calculated</strong> from published figures and the answers you give. The same
            arithmetic runs for everybody.
          </p>
          <p>
            The <strong>rent estimate is not</strong>, and it is the number to treat most
            carefully, because the return figure is built on it. {rentBasis()} Before you
            rely on a rental return, get a rent estimate from somebody who manages property in
            that county. It is the cheapest check on this page and it moves the answer more
            than anything else does.
          </p>
          <p>
            One thing the main page deliberately does not do is assume you will claim Georgia&rsquo;s
            homestead exemption. It reduces the property tax bill on a home you live in as your
            primary residence, which an overseas owner is not doing, so counting it would flatter
            the monthly figure for exactly the reader it is written for.
          </p>
        </Block>

        <Block title="How Kaleb is paid">
          <p>
            Nothing here costs you anything. Kaleb is a licensed Georgia agent and is paid a
            commission when somebody he represents buys or sells, the ordinary arrangement,
            disclosed in writing before it applies to you.
          </p>
          <p>
            He is <strong>not</strong> paid by any lender, tax adviser, attorney or property
            manager named or introduced here, and nobody pays to appear in your results.
          </p>
        </Block>

        <Block title="Why there is no account">
          <p>
            Your readout is a link you keep. There is nothing to sign up for, nothing to cancel,
            and you can delete everything we hold from the bottom of it in one click, which
            matters more, not less, when you are handing your financial position to a company on
            another continent.
          </p>
        </Block>

        <div className="card p-5" style={{ marginTop: 28, background: "var(--sunk)" }}>
          <div className="t-sm w6">Four answers, about two minutes</div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
            What you would have to send, what it would rent for, and what comes back. Yours to
            keep whether or not you ever speak to anyone.
          </p>
          <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
            <Link href="/abroad" className="btn btn-p">
              See my numbers<Ico.arrowR size={14} />
            </Link>
            <Link href="/book?v=abroad" className="btn btn-g">Book fifteen minutes</Link>
          </div>
        </div>
      </main>
    </div>
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
