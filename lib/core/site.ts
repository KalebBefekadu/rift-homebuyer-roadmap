/**
 * Where this deployment lives.
 *
 * Written because the sitemap was empty in production and had been since the
 * day it was added. `app/sitemap.ts` read `NEXT_PUBLIC_SITE_URL`, returned an
 * empty list when it was unset, and nobody had set it on Vercel — so
 * /sitemap.xml served a well-formed document containing no URLs, robots.txt
 * omitted its `Sitemap:` line, and the route returned 200 the whole time.
 * Same shape as the cron bug: a thing that looks like it is working because
 * the only evidence of failure is an absence.
 *
 * So the origin is derived rather than declared. An explicit variable still
 * wins when it is set — a custom domain is a decision, not a guess — but
 * falling back to what the platform already knows means the common case needs
 * no configuration at all, and the failure mode of forgetting is a preview URL
 * in a sitemap rather than no sitemap.
 *
 * Returns null only when there is genuinely nothing to go on, and callers are
 * expected to degrade visibly rather than emit a half-formed URL.
 */

export type Env = Partial<Record<string, string>>;

/** Trailing slash removed, scheme added. A base that sometimes ends in "/"
 *  produces "https://site.com//buy" in half the links that use it. */
function normalise(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    return `${u.origin}`;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(env: Env): string | null {
  const candidates = [
    /* The custom domain, when somebody has chosen one. Always wins: a sitemap
       and a share card that name a vercel.app URL for a site that has a real
       domain are splitting the product's own search authority in two. */
    env.NEXT_PUBLIC_SITE_URL,
    /* Vercel sets this to the stable production hostname on every deployment,
       including preview builds — which is what makes it the right fallback.
       VERCEL_URL is the per-deployment hostname and changes every push, so it
       would put a dead URL in a card the moment the next deploy landed. */
    env.VERCEL_PROJECT_PRODUCTION_URL,
    /* Only useful locally and on a preview somebody is looking at directly. */
    env.VERCEL_URL,
    env.NEXT_PUBLIC_VERCEL_URL,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const u = normalise(c);
    if (u) return u;
  }
  return null;
}

/** The convenience wrapper. The pure function above is the one under test. */
export function siteUrl(): string | null {
  return resolveSiteUrl(process.env as Env);
}
