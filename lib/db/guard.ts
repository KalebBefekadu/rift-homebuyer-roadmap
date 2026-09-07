import "server-only";
import { NextResponse } from "next/server";
import { check, LIMITS, type Limit } from "@/lib/core/ratelimit";
import { MAX_BODY_BYTES } from "@/lib/core/limits";

export { MAX_BODY_BYTES };

/**
 * The gate on the public write endpoints.
 *
 * Keyed on the client IP, taken from the proxy header the platform sets. That
 * header is spoofable in principle, and on Vercel it is not — the platform
 * overwrites it. On any host where it is not trusted, this becomes a soft
 * deterrent rather than a control, which is worth knowing before relying on it.
 *
 * A refusal returns 429 with Retry-After. It does NOT explain the limit: an
 * error message that names the threshold is a tuning guide for the person
 * trying to get around it.
 */
export function ipOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}


/**
 * Reads a JSON body, refusing anything oversized.
 *
 * Checks Content-Length first because it is free, then counts what actually
 * arrives — a declared length is a claim, and a chunked request need not make
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
