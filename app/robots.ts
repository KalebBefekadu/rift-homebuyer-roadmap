import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/core/site";

/**
 * What crawlers may see.
 *
 * The public product pages should be found. Everything that carries a person's
 * situation must not be: a readout URL is unguessable to a human and trivially
 * findable by a crawler that has been handed one, for example in a shared link
 * that ended up on a forum.
 *
 * The API is excluded too. Nothing there is useful to a crawler and every
 * request costs a function invocation.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        /* Kept in step with app/sitemap.ts by lib/core/internal.test.ts. The
           two drifted the moment /privacy was added: it was submitted for
           indexing and absent from this list, which `Allow: /` covered by
           accident rather than by anybody deciding it. */
        allow: [
          "/", "/abroad", "/abroad/how", "/buy", "/buy/start", "/buy/programs", "/buy/how",
          "/sell", "/sell/start", "/sell/how", "/sell/unclaimed", "/offer", "/privacy",
        ],
        /* /dev is the development index. It is not secret, but it describes what
           is built and what is only specified, and it is not the product. */
        /* /abroad/results was missing from this list while the other two
           readouts were on it. Same kind of document: one person's price,
           deposit, county and residency status in a URL, and the only one of
           the three a crawler was free to index. The funnel written for people
           outside the country was the one without the protection. */
        disallow: [
          "/r/", "/buy/results", "/sell/results", "/abroad/results",
          "/book", "/studio", "/api/", "/prototype/", "/dev", "/plan/", "/app",
        ],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
