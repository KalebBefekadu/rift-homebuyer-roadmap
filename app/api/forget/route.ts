import { NextResponse } from "next/server";
import { limited, readJson, visitorSession } from "@/lib/db/guard";
import { forget, forgetByPlan } from "@/lib/db/retention";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Delete all of it."
 *
 * Keyed on the session id, which is the only handle an anonymous visitor has:
 * and deliberately the only one required. Asking somebody to prove who they are
 * before deleting data they never signed up to give would be a gate on the exit
 * from a product with no gate on the entrance.
 *
 * The trade is that a session id is guessable in principle. It is a random
 * token in sessionStorage and the only thing it can do is destroy that
 * session's own records: the worst an attacker achieves is deleting data on
 * the person's behalf, which is what the endpoint is for. That holds only for
 * an id a browser minted for itself. The "anon" a browser without storage
 * sends is shared by every such browser, and accepting it let anybody erase
 * all of their leads, so it is refused (lib/db/guard.ts `visitorSession`).
 *
 * A saved plan's page sends its private link instead (`planToken`): the
 * session that saved it is long gone by the time somebody comes back to
 * delete it, and whoever holds the link can already read everything it
 * deletes (LEAD-06).
 */
export async function POST(req: Request) {
  const refused = limited(req, "forget");
  if (refused) return refused;

  let sessionId: string | undefined;
  let sentSession = false;
  let planToken = "";
  try {
    const read = await readJson(req);
    if (!read.ok) return read.res;
    const b = read.body as { sessionId?: unknown; planToken?: unknown };
    sessionId = visitorSession(b.sessionId);
    sentSession = typeof b.sessionId === "string" && b.sessionId.trim() !== "";
    planToken = typeof b.planToken === "string" ? b.planToken.slice(0, 64) : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (planToken) return answer(await forgetByPlan(planToken));
  if (sessionId) return answer(await forget(sessionId));

  /* A placeholder rather than nothing: this browser never had a session of
     its own, so nothing on our side is keyed to it and nothing can be deleted
     by it. Refused rather than reported as done: anything they left us was
     stored without a handle, and the page's failure copy is the one that
     sends them to a person who can delete it by hand. */
  return NextResponse.json(
    { ok: false, error: sentSession ? "this browser has no session of its own to delete by" : "sessionId or planToken required" },
    { status: 400 },
  );
}

function answer(r: Awaited<ReturnType<typeof forget>>) {
  if (!r.ok) {
    captureOpError(new Error(r.error), { op: "retention.forget" });
    return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  }
  if ("skipped" in r) return NextResponse.json({ ok: true, skipped: true, reason: r.reason });
  return NextResponse.json({ ok: true, ...r.data });
}
