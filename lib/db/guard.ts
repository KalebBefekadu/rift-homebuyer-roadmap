import "server-only";
import { NextResponse } from "next/server";
import { check, LIMITS, type Limit } from "@/lib/core/ratelimit";

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

export function limited(req: Request, name: keyof typeof LIMITS): NextResponse | null {
  const limit: Limit = LIMITS[name];
  const verdict = check(`${name}:${ipOf(req)}`, limit);
  if (verdict.allowed) return null;

  return NextResponse.json(
    { ok: false, error: "too many requests" },
    { status: 429, headers: { "retry-after": String(verdict.retryAfter) } },
  );
}
