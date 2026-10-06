import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedReport, boundedWrite } from "./bounded";
import { sendNotice } from "./email";
import { captureOpError } from "@/lib/monitoring/capture";
import { siteUrl } from "@/lib/core/site";
import { isUuid } from "@/lib/core/ids";
import { noticeDue, shouldTell, type NoticeKind } from "@/lib/core/notice";
import type { Scope, Side } from "@/lib/core/journey";

/**
 * Telling the household something new is in their portal (manual review
 * WS11.5). Called by the agent's own writes after they succeed. Best effort
 * by design: the thing was shared whether or not the email goes, so nothing
 * here can fail the write that called it, and every outcome is recorded.
 *
 * Until migration 20261006120000 is applied the table is missing, and then
 * nobody is emailed rather than everybody every time: the throttle is the
 * table, and an email per click is worse than none.
 */
export async function tellHousehold(journeyId: string, kind: NoticeKind, agentName: string): Promise<{ told: number }> {
  const db = serviceClient();
  if (!db || !isUuid(journeyId)) return { told: 0 };
  const agentId = await currentAgentId();
  if (!agentId) return { told: 0 };
  const origin = siteUrl();
  if (!origin) return { told: 0 };

  try {
    const [j, members] = await Promise.all([
      boundedReport(db.from("rift_journeys").select("label,side").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey"),
      boundedReport(
        db.from("rift_journey_members").select("id,email,display_name,scopes,accepted_at,revoked_at,notices")
          .eq("journey_id", journeyId).eq("agent_id", agentId),
        "the household",
      ),
    ]);
    if (!j.ok || !members.ok) return { told: 0 };
    const journey = ("data" in j ? j.data : null) as { label: string; side: Side } | null;
    if (!journey) return { told: 0 };
    const people = (("data" in members ? members.data : []) as {
      id: string; email: string; display_name: string | null; scopes: Scope[] | null; accepted_at: string | null; revoked_at: string | null; notices: boolean | null;
    }[]).filter((m) => m.notices !== false && shouldTell(kind, {
      side: journey.side, scopes: m.scopes ?? [], joined: Boolean(m.accepted_at), revoked: Boolean(m.revoked_at),
    }));
    if (!people.length) return { told: 0 };

    const last = await boundedReport(
      db.from("rift_client_notices").select("member_id,created_at")
        .in("member_id", people.map((p) => p.id)).eq("kind", kind).eq("outcome", "sent")
        .order("created_at", { ascending: false }).limit(200),
      "the last emails",
    );
    if (!last.ok) {
      /* Missing table, or a read that failed: tell nobody (see above). */
      if (!/rift_client_notices/.test(last.error)) captureOpError(new Error(last.error), { op: "notice.read" });
      return { told: 0 };
    }
    const lastAt = new Map<string, string>();
    for (const r of ("data" in last ? last.data : []) as { member_id: string; created_at: string }[]) if (!lastAt.has(r.member_id)) lastAt.set(r.member_id, r.created_at);

    let told = 0;
    for (const p of people) {
      if (!noticeDue(lastAt.get(p.id) ?? null)) continue;
      const sent = await sendNotice({
        to: p.email, name: p.display_name, agentName, journeyLabel: journey.label, kind,
        journeyUrl: `${origin}/app/j/${journeyId}`,
      });
      const outcome = !sent.ok ? "failed" : "skipped" in sent ? "skipped" : "sent";
      if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.notice", extra: { kind } });
      if (outcome === "sent") told++;
      const w = await boundedWrite(
        db.from("rift_client_notices").insert({ agent_id: agentId, journey_id: journeyId, member_id: p.id, kind, outcome }),
        "the record of the email",
      );
      if (!w.ok) captureOpError(new Error(w.error), { op: "notice.record" });
    }
    return { told };
  } catch (e) {
    captureOpError(e, { op: "notice" });
    return { told: 0 };
  }
}
