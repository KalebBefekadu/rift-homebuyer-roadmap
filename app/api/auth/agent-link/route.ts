import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { serviceClient } from "@/lib/db/service";
import { sendSignInLink } from "@/lib/db/signin";
import { normaliseEmail } from "@/lib/core/journey";
import { captureOpError } from "@/lib/monitoring/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The agent's sign-in link, sent by the server through Brevo (manual review
 * WS10.1).
 *
 * It used to be `signInWithOtp` in the browser, which is Supabase's own mailer:
 * a few messages an hour, and a PKCE link that only works in the browser that
 * asked for it. The same two faults that locked clients out could lock the
 * agent out of his own book.
 *
 * Only an address that is already the agent's login gets a link. Nothing here
 * creates an account (an account on this surface would be an agent), and the
 * answer is the same whether or not the address matched, so the page does not
 * confirm which address is the agent's.
 */
export async function POST(req: Request) {
  const refused = limited(req, "signin");
  if (refused) return refused;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const email = normaliseEmail(String((body.body as { email?: unknown } | null)?.email ?? "").slice(0, 254));
  if (!email) return NextResponse.json({ ok: false, error: "Enter your email address." }, { status: 400 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: false, unconfigured: true }, { status: 503 });

  const agents = await db.from("rift_agents").select("auth_user_id").not("auth_user_id", "is", null).limit(5);
  if (agents.error) {
    captureOpError(agents.error, { op: "auth.agent-link" });
    return NextResponse.json({ ok: false, error: "We could not check that just now. Try again in a minute." }, { status: 503 });
  }
  for (const a of (agents.data ?? []) as { auth_user_id: string }[]) {
    const u = await db.auth.admin.getUserById(a.auth_user_id);
    if (u.data.user?.email && normaliseEmail(u.data.user.email) === email) {
      await sendSignInLink(u.data.user.email, "/operations");
      break;
    }
  }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
