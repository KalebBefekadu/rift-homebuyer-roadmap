import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, skipped, type DbResult } from "./result";
import { boundedReport } from "./bounded";
import { TERMINAL, type Finished } from "@/lib/core/pipeline";

/**
 * The relationships the forecast reads: the agent's own finished history and
 * everybody still in play, with what each transaction is worth. Out of
 * clients.ts, which re-exports it, because neither shares the board's column
 * list or its shaping.
 */

/* ------------------------------------------------------------------ *
 * The agent's own closed history
 * ------------------------------------------------------------------ */

/**
 * Every relationship that has finished, and the stages it went through.
 *
 * This is what turns the forward view from an industry assumption into his
 * number. `weightFor` shrinks toward the assumption until there are twelve
 * outcomes in a stage, so early on this changes very little, which is the
 * intended behaviour, not a limitation. What it must never do is return
 * something invented: an empty array here means the forecast correctly reports
 * "assumed" on every stage, and that is a true statement about a new book of
 * business.
 *
 * The stage history comes from `rift_lead_notes`, which is append-only and
 * records both ends of every move. There is no `stage_transitions` table; the
 * notes ARE the transition log, and deriving from them means the forecast
 * cannot disagree with the record the agent can read on the person's page.
 */
export async function finishedRelationships(): Promise<DbResult<Finished[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const leads = await boundedReport(
    db.from("rift_leads")
      .select("id,stage")
      .eq("agent_id", agent_id)
      .in("stage", TERMINAL as unknown as string[])
      .limit(500),
    "reading closed history",
  );
  if (!leads.ok || !("data" in leads)) return leads as DbResult<Finished[]>;

  const rows = leads.data as { id: string; stage: string }[];
  if (!rows.length) return done([]);

  /* One query for every stage note across all of them, rather than one per
     person. Five hundred relationships is five hundred round trips otherwise,
     on a page the agent opens every morning. */
  const moves = await boundedReport(
    db.from("rift_lead_notes")
      .select("lead_id,from_stage,to_stage")
      .eq("agent_id", agent_id)
      .eq("kind", "stage")
      .in("lead_id", rows.map((r) => r.id))
      .limit(5000),
    "reading stage history",
  );

  /* A relationship with no recorded moves still counts. Somebody added at
     "Under contract" and closed a fortnight later has one stage in their
     history and it is evidence; dropping them because the note query was slow
     would quietly bias the forecast toward people who took the long route. */
  const through = new Map<string, string[]>();
  if (moves.ok && "data" in moves) {
    for (const m of moves.data as { lead_id: string; from_stage: string | null; to_stage: string | null }[]) {
      const list = through.get(m.lead_id) ?? [];
      if (m.from_stage) list.push(m.from_stage);
      if (m.to_stage) list.push(m.to_stage);
      through.set(m.lead_id, list);
    }
  }

  return done(rows.map((r) => ({
    final: r.stage,
    through: through.get(r.id) ?? [r.stage],
  })));
}

/** One live relationship, as the forward view needs it. */
export interface Live {
  name: string;
  stage: string;
  /** Deal size in dollars. Zero when nobody has said one. */
  value: number;
  /** True when the value is a real answer rather than a default. */
  valueKnown: boolean;
}

/**
 * Everybody still in play, with what the transaction is worth.
 *
 * The deal size lives inside `lead_input`, which is why this is its own query
 * rather than a column on the board: pulling a jsonb blob for every row of a
 * screen that does not need it would cost the whole of Studio a little, all
 * day, for one panel.
 *
 * `valueKnown` travels with the number because a forecast that shows $0 and a
 * forecast that shows a real $340,000 look identical once they are summed. A
 * relationship nobody has priced is still a relationship expected to close:
 * it just cannot contribute to a dollar figure, and the screen has to be able
 * to say how many of those there are.
 */
export async function liveRelationships(): Promise<DbResult<Live[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const res = await boundedReport(
    db.from("rift_leads")
      .select("name,stage,lead_input")
      .eq("agent_id", agent_id)
      .is("archived_at", null)
      .not("stage", "is", null)
      .not("stage", "in", `(${(TERMINAL as readonly string[]).join(",")})`)
      .limit(500),
    "reading the forward view",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<Live[]>;

  return done((res.data as Record<string, unknown>[]).map((r) => {
    const input = (r.lead_input ?? null) as { value?: unknown } | null;
    const raw = input?.value;
    /* Finite and positive. A jsonb null reaches here as null, and `Number(null)`
       is 0, which would render as a priced deal worth nothing rather than an
       unpriced one. The distinction is the whole reason `valueKnown` exists. */
    const known = typeof raw === "number" && Number.isFinite(raw) && raw > 0;
    return {
      name: (r.name as string | null) ?? "Unnamed",
      stage: r.stage as string,
      value: known ? (raw as number) : 0,
      valueKnown: known,
    };
  }));
}
