import { NextResponse } from "next/server";
import { ask } from "@/lib/db/review";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Ask Kaleb to check this."
 *
 * The event that was missing. A visitor can now reach the second rung of the
 * trust ladder from the readout, which is what makes the ladder a path rather
 * than a diagram.
 *
 * The ceiling is decided HERE, from the kind of thing being asked about, never
 * sent by the client. A client that can set its own ceiling can ask for a
 * repair estimate to be marked "verified by lender", and the whole point of the
 * ceiling is that some things can never be certified by anybody.
 */
const CEILINGS = {
  figure: "verified",
  document: "verified",
  program: "verified",
  plan: "reviewed",
} as const;

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const kind = (["figure", "document", "program", "plan"] as const).includes(b.kind as never)
    ? (b.kind as keyof typeof CEILINGS)
    : "figure";
  const what = typeof b.what === "string" ? b.what : "";
  const claim = typeof b.claim === "string" ? b.claim : "";
  if (!what || !claim) {
    return NextResponse.json({ ok: false, error: "what and claim are required" }, { status: 400 });
  }

  const r = await ask({
    who: typeof b.who === "string" && b.who.trim() ? b.who : "Someone on the site",
    kind,
    what,
    claim,
    ceiling: CEILINGS[kind],
    readoutId: typeof b.readoutId === "string" ? b.readoutId : undefined,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "review.ask", extra: { kind } });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, id: r.data.id });
}
