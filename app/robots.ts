import type { MetadataRoute } from "next";

/**
 * What crawlers may see.
 *
 * The public product pages should be found. Everything that carries a person's
 * situation must not be — a readout URL is unguessable to a human and trivially
 * findable by a crawler that has been handed one, for example in a shared link
 * that ended up on a forum.
 *
 * The API is excluded too. Nothing there is useful to a crawler and every
 * request costs a function invocation.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/buy", "/buy/programs", "/buy/how"],
        disallow: ["/r/", "/buy/results", "/book", "/studio", "/api/", "/prototype/"],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
