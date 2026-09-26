import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { currentAgent } from "@/lib/db/session";
import { roster } from "@/lib/db/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * The quick switcher's people (Blueprint v5 §8.3): name, email or phone,
 * the same loose match as Relationships, at most eight. The agent's session
 * is checked here; nothing is returned to anyone else.
 */
export async function GET(req: Request) {
  const refused = limited(req, "app");
  if (refused) return refused;
  const agent = await currentAgent();
  if (!agent) return json({ ok: false, error: "not signed in" }, 401);
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80).trim();
  if (q.length < 2) return json({ ok: true, people: [] });
  const r = await roster({ q, limit: 8 });
  if (!r.ok) return json({ ok: false, error: r.error });
  if ("skipped" in r) return json({ ok: false, error: r.reason });
  return json({
    ok: true,
    people: r.data.people.map((p) => ({
      id: p.id, name: p.name?.trim() || p.email || "Someone who left no name",
      detail: [p.side === "buy" ? "Buying" : "Selling", p.stage ?? "Not picked up", p.archivedAt ? "Archived" : null].filter(Boolean).join(" · "),
    })),
  });
}
