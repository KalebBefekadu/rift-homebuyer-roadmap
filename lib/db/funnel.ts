import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { captureOpError } from "@/lib/monitoring/capture";
import { withTimeout, READ_DEADLINE_MS } from "@/lib/core/timeout";
import { BUY_FUNNEL, SELL_FUNNEL, applyWording, type Funnel, type Wording } from "@/lib/core/funnel";

/**
 * The published funnel version, and pinning answers to it.
 *
 * Contract 4.6: a lead is pinned to the version it answered. That was written
 * down, the columns existed, and nothing ever set them, so every assessment
 * and every lead pointed at no version at all.
 *
 * It matters before the editor exists, not after. When an agent eventually
 * changes a question, the leads captured today need to already know which
 * wording they saw; a version recorded from the day the editor ships leaves
 * everything before it permanently ambiguous, and no later migration can
 * recover which questions somebody was actually asked.
 *
 * Cached per process because it changes only when a funnel is published, which
 * is a thing a person does deliberately and rarely.
 */
const cache = new Map<"buy" | "sell", string>();

/**
 * The current version id, publishing the built-in funnel if none exists.
 *
 * Publishing here rather than in the bootstrap is deliberate: the bootstrap is
 * a manual step and this must be true for every deployment, including one
 * where somebody forgot to run it.
 */
export async function currentVersionId(side: "buy" | "sell"): Promise<string | null> {
  const hit = cache.get(side);
  if (hit) return hit;

  const db = serviceClient();
  if (!db) return null;
  const agent_id = await currentAgentId();
  if (!agent_id) return null;

  /* On a deadline, because this runs when an assessment starts. The pin is
     valuable; the assessment is essential. Losing the pin for one visitor is
     a gap in a record: losing the assessment is a lost lead. */
  const { value } = await withTimeout(publish(db, agent_id, side), READ_DEADLINE_MS, null);
  if (value) cache.set(side, value);
  return value;
}

async function publish(
  db: NonNullable<ReturnType<typeof serviceClient>>,
  agent_id: string,
  side: "buy" | "sell",
): Promise<string | null> {
  try {
    const definition: Funnel = side === "buy" ? BUY_FUNNEL : SELL_FUNNEL;

    const { data: funnel } = await db
      .from("rift_funnels")
      .upsert({ agent_id, side, version: definition.version }, { onConflict: "agent_id,side" })
      .select("id")
      .maybeSingle();

    const funnelId = funnel?.id
      ?? (await db.from("rift_funnels").select("id").eq("agent_id", agent_id).eq("side", side).maybeSingle()).data?.id;
    if (!funnelId) return null;

    const { data: version } = await db
      .from("rift_funnel_versions")
      .upsert(
        { funnel_id: funnelId, version: definition.version, change_note: "Built-in definition", changed_by: "system" },
        { onConflict: "funnel_id,version", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    const versionId = version?.id
      ?? (await db.from("rift_funnel_versions").select("id")
            .eq("funnel_id", funnelId).eq("version", definition.version).maybeSingle()).data?.id;
    if (!versionId) return null;

    /* The questions as published. Written once per version so a later edit
       produces a new version rather than rewriting what somebody was asked. */
    const { count } = await db
      .from("rift_questions")
      .select("*", { count: "exact", head: true })
      .eq("funnel_version_id", versionId);

    if (!count) {
      const rows = definition.questions.map((q, i) => ({
        funnel_version_id: versionId,
        key: q.id,
        kind: q.kind,
        bound: q.bound,
        type: q.type,
        title: q.title,
        description: q.description ?? null,
        field_label: q.fieldLabel ?? null,
        unit: q.unit ?? null,
        options: (q.options ?? []) as never,
        required: q.required,
        enabled: q.enabled,
        sort_order: i,
      }));
      const { error } = await db.from("rift_questions").insert(rows as never[]);
      /* Not swallowed. The first version of this ignored the result, so a
         constraint mismatch on the very first question published a version
         with no questions in it and said nothing. A pin to an empty version is
         worse than no pin: it looks like a record of what somebody was asked. */
      if (error) throw new Error(`could not publish questions: ${error.message}`);
    }

    return versionId as string;
  } catch (e) {
    /* A missing version must never stop an assessment: the pin is valuable
       and the funnel is essential, and they are not the same thing. But it is
       reported, because a silent failure here means every lead from now on is
       unpinned and nothing says so. */
    captureOpError(e, { op: "funnel.publish", extra: { side } });
    return null;
  }
}

export async function publishedQuestionCount(side: "buy" | "sell"): Promise<DbResult<number>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const versionId = await currentVersionId(side);
  if (!versionId) return skipped("no published version");
  try {
    const { count, error } = await db
      .from("rift_questions")
      .select("*", { count: "exact", head: true })
      .eq("funnel_version_id", versionId);
    if (error) return failed(error.message);
    return done(count ?? 0);
  } catch (e) {
    return failed(e);
  }
}

/* ------------------------------------------------------------------ *
 * The agent's own words
 * ------------------------------------------------------------------ */

/**
 * The wording published on the newest version, keyed by question.
 *
 * ONLY wording. The structure of the funnel is read from `lib/core/funnel.ts`
 * and nothing here can change it: see `applyWording`, which reads no
 * structural field from this at all. A stale row, a half-finished edit or a
 * hostile payload can at worst produce the funnel the product shipped with.
 *
 * That property is the whole reason this feature is safe to have. `county`
 * feeds the programme registry; `savings` and `monthlySaving` feed the
 * months-to-close arithmetic; `ownership` decides first-time-buyer
 * eligibility. Any of them going missing produces a readout computed against
 * a default, which renders perfectly and is about nobody.
 */
export async function readWording(side: "buy" | "sell"): Promise<DbResult<Record<string, Wording>>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  const versionId = await currentVersionId(side);
  if (!versionId) return skipped("no published version");

  try {
    /* On a deadline. This runs on the assessment page, where the built-in
       wording is a perfectly good answer and a blank screen is not. */
    const query = Promise.resolve(
      db.from("rift_questions")
        .select("key,title,description,field_label,options")
        .eq("funnel_version_id", versionId),
    );
    const { value: result, timedOut } = await withTimeout(query, READ_DEADLINE_MS, null);
    if (timedOut || !result) return skipped("the questions did not load in time");
    if (result.error) return failed(result.error.message);

    const rows = (result.data ?? []) as {
      key: string; title: string | null; description: string | null;
      field_label: string | null; options: { label?: string; value?: string }[] | null;
    }[];

    const out: Record<string, Wording> = {};
    for (const r of rows) {
      const optionLabels: Record<string, string> = {};
      for (const o of r.options ?? []) {
        if (typeof o?.value === "string" && typeof o?.label === "string") optionLabels[o.value] = o.label;
      }
      out[r.key] = {
        title: r.title ?? undefined,
        description: r.description ?? undefined,
        fieldLabel: r.field_label ?? undefined,
        optionLabels,
      };
    }
    return done(out);
  } catch (e) {
    return failed(e);
  }
}

/** The built-in structure, wearing whatever words have been published. */
export async function funnelWithWording(side: "buy" | "sell"): Promise<Funnel> {
  const definition = side === "buy" ? BUY_FUNNEL : SELL_FUNNEL;
  const read = await readWording(side);
  if (!read.ok || !("data" in read)) return definition;
  return applyWording(definition, read.data);
}

/**
 * Publishing an edit, as a new version.
 *
 * A new row in rift_funnel_versions rather than an update in place, because
 * the pin exists to answer "what exactly was this person asked": and
 * rewriting the wording on the version they are pinned to answers it wrongly
 * while looking like a record. Contract 4.6.
 *
 * The rows written are the CODE's questions carrying the agent's words. Even
 * at the point of writing, the structure comes from the definition rather than
 * from what the caller handed over.
 */
export async function publishWording(
  side: "buy" | "sell", wording: Record<string, Wording>, changedBy: string, note: string,
): Promise<DbResult<{ version: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  const definition: Funnel = side === "buy" ? BUY_FUNNEL : SELL_FUNNEL;
  const edited = applyWording(definition, wording);

  try {
    const { data: funnelRow } = await db
      .from("rift_funnels").select("id,version").eq("agent_id", agent_id).eq("side", side).maybeSingle();
    if (!funnelRow) return failed("no funnel to publish against; the assessment has never been opened");

    const funnelId = (funnelRow as { id: string }).id;
    const next = ((funnelRow as { version: number }).version ?? definition.version) + 1;

    const { data: version, error: vErr } = await db
      .from("rift_funnel_versions")
      .insert({ funnel_id: funnelId, version: next, change_note: note.slice(0, 300) || "Wording", changed_by: changedBy.slice(0, 120) })
      .select("id")
      .maybeSingle();
    if (vErr) return failed(vErr.message);
    const versionId = (version as { id: string } | null)?.id;
    if (!versionId) return failed("the new version was not created");

    const rows = edited.questions.map((q, i) => ({
      funnel_version_id: versionId,
      key: q.id,
      kind: q.kind,
      bound: q.bound,
      type: q.type,
      title: q.title,
      description: q.description ?? null,
      field_label: q.fieldLabel ?? null,
      unit: q.unit ?? null,
      options: (q.options ?? []) as never,
      required: q.required,
      enabled: q.enabled,
      sort_order: i,
    }));
    const { error } = await db.from("rift_questions").insert(rows as never[]);
    /* Never swallowed. A version with no questions in it is worse than no
       version: it looks like a record of what somebody was asked. */
    if (error) return failed(`the questions were not published: ${error.message}`);

    const { error: bump } = await db
      .from("rift_funnels").update({ version: next }).eq("id", funnelId);
    if (bump) return failed(bump.message);

    /* The cache is keyed per process and now points at the old version. */
    cache.delete(side);
    return done({ version: next });
  } catch (e) {
    return failed(e);
  }
}
