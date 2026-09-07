import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { ask, figureFor } from "@/lib/db/review";
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
  const refused = limited(req, "review");
  if (refused) return refused;

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  /* A real narrowing rather than a cast through `never`. The list of kinds is
     the keys of CEILINGS, so an unknown kind falls back rather than reaching
     the database as something the constraint will reject. */
  const isKind = (v: unknown): v is keyof typeof CEILINGS =>
    typeof v === "string" && Object.prototype.hasOwnProperty.call(CEILINGS, v);
  const kind = isKind(b.kind) ? b.kind : "figure";
  const what = typeof b.what === "string" ? b.what : "";
  const claim = typeof b.claim === "string" ? b.claim : "";
  if (!what || !claim) {
    return NextResponse.json({ ok: false, error: "what and claim are required" }, { status: 400 });
  }

  /* Resolved on the server from the share token and the label, never accepted
     from the client. A client that can name an arbitrary figure id can queue a
     review against a stranger's numbers. */
  const shareToken = typeof b.shareToken === "string" ? b.shareToken.slice(0, 64) : "";
  const figureLabel = typeof b.figureLabel === "string" ? b.figureLabel.slice(0, 120) : "";
  const figureId = shareToken && figureLabel ? await figureFor(shareToken, figureLabel) : null;

  const r = await ask({
    who: typeof b.who === "string" && b.who.trim() ? b.who : "Someone on the site",
    kind,
    what,
    claim,
    ceiling: CEILINGS[kind],
    readoutId: typeof b.readoutId === "string" ? b.readoutId : undefined,
    figureId: figureId ?? undefined,
  });

  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "review.ask", extra: { kind } });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, id: r.data.id });
}
