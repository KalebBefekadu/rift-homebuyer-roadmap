import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { forget } from "@/lib/db/retention";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Delete all of it."
 *
 * Keyed on the session id, which is the only handle an anonymous visitor has —
 * and deliberately the only one required. Asking somebody to prove who they are
 * before deleting data they never signed up to give would be a gate on the exit
 * from a product with no gate on the entrance.
 *
 * The trade is that a session id is guessable in principle. It is a random
 * token in sessionStorage and the only thing it can do is destroy that
 * session's own records — the worst an attacker achieves is deleting data on
 * the person's behalf, which is what the endpoint is for.
 */
export async function POST(req: Request) {
  const refused = limited(req, "forget");
  if (refused) return refused;

  let sessionId = "";
  try {
    const read = await readJson(req);
    if (!read.ok) return read.res;
    const b = read.body as { sessionId?: unknown };
    sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 64) : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!sessionId) return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });

  const r = await forget(sessionId);
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "retention.forget" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, ...r.data });
}
