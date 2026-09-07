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

export function touchFromRequest(url: URL, referrer: string | null): Touch {
  const p = url.searchParams;
  return {
    source: p.get("utm_source") ?? undefined,
    medium: p.get("utm_medium") ?? undefined,
    campaign: p.get("utm_campaign") ?? undefined,
    referrer: stripToHost(referrer),
    /* The path, without the query. A readout link carries somebody's answers
       in its query string, and attribution has no use for them. */
    landing: url.pathname,
  };
}

/** How a touch reads in Studio. Never "unknown" — "direct" is a real answer. */
export function describeTouch(t: Touch): string {
  if (t.source) return t.campaign ? `${t.source} · ${t.campaign}` : t.source;
  if (t.referrer) return t.referrer;
  return "direct";
}
