/**
 * What a visit is allowed to record about where it came from.
 *
 * First touch never moves. That is the whole point of first touch — an agent
 * who re-attributes a referral to the retargeting ad that caught it on the way
 * back will keep buying retargeting and stop asking for referrals, which is
 * exactly backwards for a business whose best channel is people. Immutability
 * is enforced by a database trigger; this module decides what is collected at
 * all.
 *
 * Deliberately NOT collected: IP address, any device fingerprint, and the
 * referring URL's path or query. The referring HOST answers "which channel
 * works". Everything past it is somebody's browsing history.
 */

/**
 * A utm value is a query parameter, which means it is whatever a stranger
 * typed into a link. These are stored and then rendered on the agent's screen
 * by `describeTouch`, so an unbounded one is an unbounded attacker-controlled
 * string in the database and in Studio.
 */
export const MAX_TAG = 120;

function tag(raw: string | null): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  return v.slice(0, MAX_TAG);
}

/**
 * The host a visitor came from, or nothing when they came from us.
 *
 * This distinction is the whole module. The browser sends its own host as the
 * referrer for every internal navigation, and a touch recorded from inside the
 * site therefore reports the site as the channel — which is not a small error,
 * it is the report saying every visitor arrived from the page they were
 * already on, and "direct" never occurring at all.
 */
export function externalReferrer(
  referrer: string | null | undefined,
  selfHost: string | null | undefined,
): string | undefined {
  const host = stripToHost(referrer);
  if (!host) return undefined;
  if (selfHost && host.toLowerCase() === selfHost.toLowerCase()) return undefined;
  return host;
}

/**
 * A landing path with any capability token removed.
 *
 * `/r/<token>` is a shared readout, and the token IS the credential — that is
 * the entire security model for a document somebody can forward. The query
 * string is already dropped here because it can carry a stranger's answers;
 * this route carries something stronger than answers in the path itself.
 */
export function safeLanding(pathname: string): string {
  return pathname.replace(/^\/r\/[^/]+/, "/r/[token]");
}

export interface Touch {
  source?: string;
  medium?: string;
  campaign?: string;
  /** Host only. `stripToHost` is the enforcement, not a convention. */
  referrer?: string;
  landing?: string;
}

export function stripToHost(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const u = new URL(referrer);
    /* Web schemes only. `new URL("android-app://com.example").host` is
       "com.example", which would sit in the source report looking exactly like
       a website that sent traffic. It is not one, and an attribution report
       that quietly invents a channel is worse than one with a gap in it. */
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.host || undefined;
  } catch {
    /* Not a URL at all. Return nothing rather than store an arbitrary string
       that might be a path with a query in it. */
    return undefined;
  }
}

/**
 * @param url       the page the visitor landed on
 * @param referrer  where they came from BEFORE that page, which only the
 *                  browser knows — `document.referrer`, not the Referer header
 *                  of the call that reports it, which is the landing page
 * @param selfHost  our own host, so an internal navigation is not reported as
 *                  a channel
 */
export function touchFromRequest(url: URL, referrer: string | null, selfHost?: string | null): Touch {
  const p = url.searchParams;
  return {
    source: tag(p.get("utm_source")),
    medium: tag(p.get("utm_medium")),
    campaign: tag(p.get("utm_campaign")),
    referrer: externalReferrer(referrer, selfHost ?? url.host),
    /* The path, without the query. A readout link carries somebody's answers
       in its query string, and attribution has no use for them. */
    landing: safeLanding(url.pathname),
  };
}

/** How a touch reads in Studio. Never "unknown" — "direct" is a real answer. */
export function describeTouch(t: Touch): string {
  if (t.source) return t.campaign ? `${t.source} · ${t.campaign}` : t.source;
  if (t.referrer) return t.referrer;
  return "direct";
}
