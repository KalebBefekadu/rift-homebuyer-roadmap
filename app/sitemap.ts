import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/core/site";

/**
 * Only the pages that are the same for everybody.
 *
 * A readout is one person's situation at one moment; it has no business in a
 * sitemap, and neither does anything behind a login.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /* Derived rather than declared. This read NEXT_PUBLIC_SITE_URL directly and
     returned an empty list when it was unset, which is what it did in
     production, for the life of the deployment, while serving a valid document
     and a 200. See lib/core/site.ts. */
  const base = siteUrl();
  if (!base) return [];

  const now = new Date();
  return [
    { url: `${base}/buy`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/abroad`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/abroad/how`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    /* The assessment itself. Absent until a drift guard went looking, which
       meant the two pages the entire funnel leads into: the ones a person
       searching "first time home buyer georgia help" should land on: were the
       only public pages a crawler could not find. Nothing was broken; they
       were simply never in the list. */
    { url: `${base}/buy/start`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    /* The values (Blueprint v5 §5.2): each answers one question, and each is
       a page somebody searching that question should land on. */
    { url: `${base}/buy/assistance`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/buy/cash-to-close`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/buy/monthly-cost`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/buy/timeline`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/sell/proceeds`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/sell/costs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/buy/programs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/buy/how`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/offer`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/sell`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/sell/start`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/sell/unclaimed`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/sell/how`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    /* Low priority, but present. A privacy page nobody can find is the same
       as not having one, and a crawler is one of the things looking. */
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
