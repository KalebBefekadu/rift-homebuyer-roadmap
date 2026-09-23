import { GA_COUNTIES } from "@/lib/core/registry";
import { siteUrl } from "@/lib/core/site";

/**
 * Who this is, in the form a search engine reads.
 *
 * A solo agent competes for search attention with brokerages that have an
 * entity in every index. This is the cheapest way to be one: a machine-readable
 * statement of who the agent is, where they work and what languages they work
 * in, attached to the page a stranger lands on.
 *
 * Every field here is something the product already says on screen, and
 * nothing is asserted that cannot be checked. The licence number and telephone
 * are deliberately absent rather than invented: they are not recorded on the
 * agent row yet, and a structured-data block is exactly the wrong place to
 * guess. Add them here when they exist.
 */
export function AgentSchema() {
  const base = siteUrl();

  const data = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Kaleb Befekadu",
    ...(base ? { url: base, "@id": `${base}/#agent` } : {}),
    description:
      "Licensed residential real-estate agent in Georgia. Works with buyers, sellers, and buyers purchasing from outside the United States.",
    /* Both are true and both are load-bearing: the Amharic pages are the
       reason somebody searching in Amharic should find this at all. */
    knowsLanguage: ["en", "am"],
    areaServed: GA_COUNTIES.map((county) => ({
      "@type": "AdministrativeArea",
      name: `${county} County, Georgia`,
    })),
    address: { "@type": "PostalAddress", addressRegion: "GA", addressCountry: "US" },
  };

  return (
    /* JSON.stringify rather than a template literal: a stray quote or newline
       in a county name would otherwise break the block silently, and invalid
       structured data is simply ignored rather than reported. */
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * A page's questions, in the form a search engine reads.
 *
 * The buyers-abroad page answers six questions a foreign national actually
 * types, whether you can buy without a green card, what a lender wants, what
 * happens at sale. Those answers are already on the page, written and checked;
 * declaring them costs nothing and is the difference between the page being
 * found by somebody asking the question and being found by nobody.
 *
 * TAKES THE PAGE'S OWN TEXT. Not a second copy written for crawlers. Google's
 * guidance is that structured data must match what the visitor sees, and a
 * duplicate maintained separately drifts from the page within a release: at
 * which point the product is making two different claims about the same thing,
 * one of them invisible.
 *
 * Locale-aware, because the Amharic page is a real addressable version of this
 * page rather than a widget on top of the English one, and declaring English
 * answers on it would describe a page that does not exist.
 */
export function FaqSchema({ items, locale = "en" }: {
  items: { q: string; a: string }[];
  locale?: string;
}) {
  /* Nothing is emitted for nothing. An empty FAQPage is invalid structured
     data, which is ignored silently: the worst of both outcomes. */
  const usable = items.filter((i) => i.q.trim() && i.a.trim());
  if (usable.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: usable.map((i) => ({
      "@type": "Question",
      name: i.q.trim(),
      acceptedAnswer: { "@type": "Answer", text: i.a.trim() },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
