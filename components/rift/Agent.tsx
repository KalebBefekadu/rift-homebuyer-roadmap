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
 * are deliberately absent rather than invented — they are not recorded on the
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
