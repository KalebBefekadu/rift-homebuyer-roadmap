import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { limited, readJson } from "@/lib/db/guard";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/core/site";
import { captureOpError } from "@/lib/monitoring/capture";
import { currentAgent } from "@/lib/db/session";
import { addTeamMember, mayReceiveTeamSignIn, removeTeamMember, teamSession } from "@/lib/db/team";
import { recordStep, setAssignment } from "@/lib/db/checklist";
import { MARK_STATES, type MarkState } from "@/lib/core/checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The team (Blueprint v5 §8.7): the agent's changes to it and to who does
 * each step, and everything a coordinator does. A route rather than server
 * actions for the reason on journey/ops.ts.
 *
 * Three kinds of request, each checked on its own:
 *
 *   signin      anyone, rate-limited. A link goes only to an address with a
 *               live membership, and the answer is the same either way, so
 *               this does not reveal who is on the team.
 *   mark        a coordinator's session, resolved from scratch. The step must
 *               be the coordinator's (lib/core/checklist.ts recordError).
 *   the rest    the agent's session.
 *
 * The browser supplies ids and words, never identity or permission.
 */

type Body = Record<string, unknown>;
const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : -1);
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

function foreign(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "cross-site";
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

const out = (r: { ok: boolean; error?: string; reason?: string; skipped?: boolean }) =>
  !r.ok ? { ok: false, error: r.error } : r.skipped ? { ok: false, error: r.reason } : { ok: true };

export async function POST(req: Request) {
  if (foreign(req)) return json({ ok: false, error: "Refused." }, 403);
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Body;
  const op = str(b.op, 40);

  if (op === "signin") {
    const refused = limited(req, "signin");
    if (refused) return refused;
    const email = str(b.email, 254).trim().toLowerCase();
    if (!email) return json({ ok: false, error: "Enter your email address." }, 400);
    if (await mayReceiveTeamSignIn(email)) {
      const supabase = await createClient();
      const origin = siteUrl();
      if (supabase && origin) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/operations/tasks")}`,
            /* Allowed only because the address holds a live membership. */
            shouldCreateUser: true,
          },
        });
        if (error) captureOpError(error, { op: "team.signin" });
      }
    }
    /* The same answer either way. */
    return json({ ok: true });
  }

  const refused = limited(req, "app");
  if (refused) return refused;

  if (op === "mark") {
    const s = await teamSession();
    if (s.state !== "signed-in") return json({ ok: false, error: s.state === "unknown" ? s.reason : "not signed in" }, 401);
    const journeyId = str(b.journeyId, 40);
    const requestId = str(b.requestId, 40);
    const state = str(b.state, 20) as MarkState;
    if (!isUuid(journeyId) || !isUuid(requestId)) return json({ ok: false, error: "That could not be read. Reload and try again." }, 400);
    /* A coordinator records what happened; reopening is the agent's call. */
    if (!MARK_STATES.includes(state) || state === "reopened") return json({ ok: false, error: "That could not be read. Reload and try again." }, 400);
    const r = await recordStep(journeyId, str(b.stepId, 50), {
      state, byName: str(b.byName, 160) || null, doneOn: str(b.doneOn, 10) || null, note: str(b.note, 500) || null,
    }, num(b.expectedSeq), { kind: "coordinator", label: `${s.member.name} (coordinator)`, memberId: s.member.memberId, agentId: s.member.agentId }, requestId);
    revalidatePath("/operations/tasks");
    revalidatePath(`/operations/journey/${journeyId}`);
    return json(out(r));
  }

  const agent = await currentAgent();
  if (!agent) return json({ ok: false, error: "not signed in" }, 401);

  switch (op) {
    case "assign": {
      const r = await setAssignment(str(b.stepId, 50), str(b.doer, 10), agent.name);
      revalidatePath("/operations/settings");
      return json(out(r));
    }
    case "team-add": {
      const r = await addTeamMember({ name: str(b.name, 120), email: str(b.email, 254) }, agent.name);
      revalidatePath("/operations/settings");
      const origin = siteUrl();
      return json(r.ok && "data" in r ? { ok: true, link: origin ? `${origin}/operations/tasks` : "/operations/tasks" } : out(r));
    }
    case "team-remove": {
      const memberId = str(b.memberId, 40);
      if (!isUuid(memberId)) return json({ ok: false, error: "That could not be read. Reload and try again." }, 400);
      const r = await removeTeamMember(memberId, str(b.reason, 300));
      revalidatePath("/operations/settings");
      return json(out(r));
    }
    default:
      return json({ ok: false, error: "Unknown request." }, 400);
  }
}
