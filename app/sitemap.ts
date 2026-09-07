import type { MetadataRoute } from "next";

/**
 * Only the pages that are the same for everybody.
 *
 * A readout is one person's situation at one moment; it has no business in a
 * sitemap, and neither does anything behind a login.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return [];

  const now = new Date();
  return [
    { url: `${base}/buy`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/buy/programs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/buy/how`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
