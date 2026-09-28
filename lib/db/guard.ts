import "server-only";
import { NextResponse } from "next/server";
import { check, LIMITS, type Limit } from "@/lib/core/ratelimit";
import { MAX_BODY_BYTES } from "@/lib/core/limits";
import { authoriseCron } from "@/lib/core/cron";
import { siteUrl } from "@/lib/core/site";

export { MAX_BODY_BYTES };

/**
 * The gate on the public write endpoints.
 *
 * Keyed on the client IP, taken from the proxy header the platform sets. That
 * header is spoofable in principle, and on Vercel it is not: the platform
 * overwrites it. On any host where it is not trusted, this becomes a soft
 * deterrent rather than a control, which is worth knowing before relying on it.
 *
 * A refusal returns 429 with Retry-After. It does NOT explain the limit: an
 * error message that names the threshold is a tuning guide for the person
 * trying to get around it.
 */
export function ipOf(req: Request): string {
  return clientIp(req) ?? "unknown";
}

/** The client IP for a consent record, or nothing: never the word "unknown" stored as if it were an address. */
export function clientIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || undefined;
}

/* What lib/rift/session.ts mints: `s-<time>-<random>`, both base36. */
const VISITOR_SESSION = /^s-[0-9a-z]{1,16}-[0-9a-z]{1,16}$/;

/**
 * A session id a browser minted for itself, or nothing.
 *
 * lib/rift/session.ts falls back to the constant "anon" when sessionStorage
 * is blocked (and "ssr" on the server). A constant is not a session: it is
 * one id shared by every visitor in that situation. Stored against a lead it
 * links strangers together, and /api/forget accepted it, so anybody could
 * post `{ "sessionId": "anon" }` and erase every lead ever captured from a
 * browser with storage switched off. Only an id shaped like one this product
 * mints is a handle on one person; anything else is treated as no session.
 */
export function visitorSession(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return VISITOR_SESSION.test(s) ? s : undefined;
}

/**
 * A link a browser asked us to put in an email, if it points at this site.
 *
 * The abroad readout posts its own URL for the readout email, and capture
 * sent whatever arrived: any address, any link, under Kaleb's sender and the
 * words "Your full readout is here", with the link written into the markup
 * unescaped. That is a phishing relay with a good sending reputation. Only
 * this deployment's origin is accepted (the one the request arrived on, or
 * the configured site), and the link is rebuilt from its parsed parts, which
 * the URL parser has already percent-encoded, so no quote survives into an
 * attribute.
 */
export function ownLink(v: unknown, req: Request): string | undefined {
  if (typeof v !== "string" || v.length > 2_048) return undefined;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return undefined;
  }
  const ours = [new URL(req.url).origin, siteUrl()];
  if (!ours.includes(u.origin)) return undefined;
  return `${u.origin}${u.pathname}${u.search}`;
}


/**
 * Reads a JSON body, refusing anything oversized.
 *
 * Checks Content-Length first because it is free, then counts what actually
 * arrives: a declared length is a claim, and a chunked request need not make
 * one at all.
 */
export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 }) };
  }

  const text = await req.text();
  /* Byte length, not string length. A body of emoji is roughly four times its
     character count, and the limit is about storage rather than typing. */
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 }) };
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }) };
  }
}

export function limited(req: Request, name: keyof typeof LIMITS): NextResponse | null {
  const limit: Limit = LIMITS[name];
  const verdict = check(`${name}:${ipOf(req)}`, limit);
  if (verdict.allowed) return null;

  return NextResponse.json(
    { ok: false, error: "too many requests" },
    { status: 429, headers: { "retry-after": String(verdict.retryAfter) } },
  );
}

/**
 * The gate on the scheduled jobs.
 *
 * Returns the refusal to send back, or null to proceed. The rule itself is in
 * lib/core/cron.ts, and the reason it is there rather than here is written at
 * the top of that file.
 */
export function cronRefusal(req: Request): NextResponse | null {
  const verdict = authoriseCron(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (verdict.ok) return null;
  return NextResponse.json({ ok: false, error: verdict.error }, { status: verdict.status });
}
