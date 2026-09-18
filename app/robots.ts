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
        allow: ["/", "/abroad", "/buy", "/buy/programs", "/buy/how", "/sell", "/sell/how", "/sell/unclaimed"],
        /* /dev is the development index. It is not secret, but it describes what
           is built and what is only specified, and it is not the product. */
        disallow: [
          "/r/", "/buy/results", "/sell/results", "/book", "/studio",
          "/api/", "/prototype/", "/dev",
        ],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
