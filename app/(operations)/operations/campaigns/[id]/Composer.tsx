"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VALUES } from "@/lib/core/values";
import { GA_COUNTIES } from "@/lib/core/registry";
import { BLOCK_LABEL, MAX_BLOCKS, recipeErrors, type Block, type BlockType, type Publication, type Recipe } from "@/lib/core/campaign";
import type { ProgramRecord } from "@/lib/core/assistance";
import { CampaignBlocks } from "@/components/rift/campaign/CampaignBlocks";
import { BRIEF_MAX, briefError } from "@/lib/core/campaign-draft";
import { draftCampaignRecipe, publishCampaign, saveCampaign } from "../../actions";

const WHEN = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const LIVE_VALUES = VALUES.filter((v) => v.live);

const blank = (t: BlockType): Block =>
  t === "heading" ? { type: "heading", title: "", lede: "" }
  : t === "value" ? { type: "value", valueId: "assistance" }
  : t === "programs" ? { type: "programs", county: GA_COUNTIES[0]! }
  : t === "cta" ? { type: "cta", label: "", valueId: "assistance" }
  : { type: "text", body: "" };

/**
 * The campaign composer (CAMP-01 to CAMP-03). Blocks are chosen from the
 * approved list and filled in with plain words; the recipe is checked as it
 * is typed and again when saved and when published. Saving makes a new
 * version; publishing points the page at a version; rolling back points it
 * at an earlier one. The preview is the public page's own renderer.
 *
 * An AI draft replaces what is in the editor and is not saved: it is read,
 * edited and saved like anything typed, and "Undo changes" puts back the
 * last saved version.
 */
export function Composer({ id, slug, live, revisions, history, programs, origin, aiReady }: {
  id: string;
  slug: string;
  live: number | null;
  revisions: { version: number; recipe: Recipe; note: string | null; by: string; at: string }[];
  history: Publication[];
  programs: ProgramRecord[];
  origin: string | null;
  /** Whether an Anthropic key is present; without one drafting says so rather than failing on press. */
  aiReady: boolean;
}) {
  const router = useRouter();
  const latest = revisions.at(-1)!;
  const [blocks, setBlocks] = useState<Block[]>(latest.recipe.blocks);
  const [note, setNote] = useState("");
  const [width, setWidth] = useState<"phone" | "desktop">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [brief, setBrief] = useState("");
  const [drafted, setDrafted] = useState<{ say: string; dropped: string[]; tone: "pos" | "warn" } | null>(null);
  const [drafting, startDraft] = useTransition();
  const errors = useMemo(() => recipeErrors({ blocks }), [blocks]);
  const changed = JSON.stringify(blocks) !== JSON.stringify(latest.recipe.blocks);

  const set = (i: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b, n) => (n === i ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: -1 | 1) => setBlocks((bs) => {
    const j = i + d;
    if (j < 0 || j >= bs.length) return bs;
    const next = [...bs];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await fn();
    if (!r.ok) { setError(r.error ?? "That did not work"); return; }
    setError(null); setNote(""); router.refresh();
  });

  const draft = () => startDraft(async () => {
    const r = await draftCampaignRecipe({ id, brief });
    if (!r.ok) { setDrafted({ say: r.error, dropped: [], tone: "warn" }); return; }
    if (r.draft) setBlocks(r.draft.recipe.blocks);
    setDrafted({ say: r.say, dropped: r.draft?.dropped ?? [], tone: r.draft ? "pos" : "warn" });
  });

  return (
    <div className="col gap-4">
      <details className="card p-4">
        <summary className="t-sm w6" style={{ cursor: "pointer" }}>Draft the blocks with AI</summary>
        {aiReady ? (
          <div className="col gap-2" style={{ marginTop: 8 }}>
            <label className="col gap-1 t-xs">Who is the page for, and what should it help them do?
              <textarea className="input" rows={2} maxLength={BRIEF_MAX} value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder="First-time buyers in Clayton County who rent and are unsure whether they can afford to buy" /></label>
            <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
              <button type="button" className="btn btn-g btn-sm" disabled={drafting || !!briefError(brief)} onClick={draft}>{drafting ? "Drafting…" : "Draft into the editor"}</button>
              <span className="t-xs c-4">Words only: a drafted number, promise or link is left out. It replaces the editor&apos;s blocks and is not saved.</span>
            </div>
          </div>
        ) : (
          <p className="t-sm c-3" style={{ marginTop: 8 }}>⚠ Drafting with AI is not switched on for this deployment (it needs the Anthropic key). The blocks can be written by hand below.</p>
        )}
        {drafted ? (
          <div role="status" className={`t-xs c-${drafted.tone}`} style={{ marginTop: 8 }}>
            <p>{drafted.tone === "pos" ? "✓" : "⚠"} {drafted.say}</p>
            {drafted.dropped.length ? <ul className="c-3" style={{ display: "grid", gap: 2, marginTop: 4 }}>{drafted.dropped.map((d) => <li key={d}>Left out: {d}</li>)}</ul> : null}
          </div>
        ) : null}
      </details>
      <div className="ops-split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <section className="card p-4 col gap-3" aria-labelledby="compose-h">
          <h2 id="compose-h" className="t-md w6">Blocks</h2>
          <ol className="col gap-2">
            {blocks.map((b, i) => (
              <li key={i} className="card p-3" style={{ background: "var(--sunk)" }}>
                <div className="between gap-2">
                  <span className="t-xs w6">{i + 1}. {BLOCK_LABEL[b.type]}</span>
                  <span className="row gap-2 t-xs">
                    <button type="button" className="u" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move block ${i + 1} up`}>Up</button>
                    <button type="button" className="u" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={`Move block ${i + 1} down`}>Down</button>
                    <button type="button" className="u" onClick={() => setBlocks((bs) => bs.filter((_, n) => n !== i))} aria-label={`Remove block ${i + 1}`}>Remove</button>
                  </span>
                </div>
                <div className="col gap-2" style={{ marginTop: 6 }}>
                  {b.type === "heading" ? (
                    <>
                      <label className="col gap-1 t-xs">Heading<input className="input input-sm" maxLength={90} value={b.title} onChange={(e) => set(i, { title: e.target.value })} /></label>
                      <label className="col gap-1 t-xs">The line under it<textarea className="input" rows={2} maxLength={220} value={b.lede} onChange={(e) => set(i, { lede: e.target.value })} /></label>
                    </>
                  ) : b.type === "text" ? (
                    <label className="col gap-1 t-xs">Paragraph, plain words<textarea className="input" rows={3} maxLength={600} value={b.body} onChange={(e) => set(i, { body: e.target.value })} /></label>
                  ) : b.type === "programs" ? (
                    <label className="col gap-1 t-xs">County
                      <select className="select input-sm" value={b.county} onChange={(e) => set(i, { county: e.target.value })}>{GA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                  ) : (
                    <>
                      {b.type === "cta" ? <label className="col gap-1 t-xs">Button words<input className="input input-sm" maxLength={40} value={b.label} onChange={(e) => set(i, { label: e.target.value })} /></label> : null}
                      <label className="col gap-1 t-xs">{b.type === "cta" ? "Goes to" : "Value"}
                        <select className="select input-sm" value={b.valueId} onChange={(e) => set(i, { valueId: e.target.value })}>
                          {LIVE_VALUES.map((v) => <option key={v.id} value={v.id}>{v.name}: {v.question}</option>)}
                        </select></label>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {blocks.length < MAX_BLOCKS ? (
            <label className="row gap-2 t-xs">Add
              <select className="select input-sm" value="" onChange={(e) => { if (e.target.value) setBlocks((bs) => [...bs, blank(e.target.value as BlockType)]); }}>
                <option value="">a block…</option>
                {(Object.keys(BLOCK_LABEL) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}
              </select></label>
          ) : null}
          {errors.length ? (
            <ul className="t-xs c-neg" role="status" style={{ display: "grid", gap: 2 }}>{errors.map((e) => <li key={e}>✕ {e}</li>)}</ul>
          ) : <p className="t-xs c-pos" role="status">✓ Every block is approved and filled in.</p>}
          <div className="row gap-2 wrap" style={{ alignItems: "flex-end" }}>
            <label className="col gap-1 t-xs" style={{ flex: "1 1 200px" }}>What changed (optional)<input className="input input-sm" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn btn-p btn-sm" disabled={pending || !!errors.length || !changed}
              onClick={() => act(() => saveCampaign({ id, recipe: { blocks }, expectedVersion: latest.version, note: note || null, requestId: crypto.randomUUID() }))}>
              {pending ? "Saving…" : `Save as version ${latest.version + 1}`}
            </button>
            {changed ? <button type="button" className="btn btn-g btn-sm" onClick={() => setBlocks(latest.recipe.blocks)}>Undo changes</button> : null}
          </div>
        </section>

        <section className="card p-4" aria-labelledby="preview-h">
          <div className="between gap-2">
            <h2 id="preview-h" className="t-md w6">Preview{changed ? " (not saved)" : ""}</h2>
            <span className="row gap-1">
              {(["phone", "desktop"] as const).map((w) => (
                <button key={w} type="button" className={`btn btn-sm ${width === w ? "btn-p" : "btn-g"}`} aria-pressed={width === w} onClick={() => setWidth(w)}>{w === "phone" ? "Phone" : "Desktop"}</button>
              ))}
            </span>
          </div>
          <div className="rift buy" style={{ marginTop: 10, border: "1px solid var(--line-2)", borderRadius: 12, background: "var(--canvas)", overflow: "auto", maxHeight: 640 }}>
            <div style={{ width: width === "phone" ? 375 : 1024, padding: 16, margin: "0 auto", fontFamily: "Switzer, system-ui, sans-serif" }}>
              <CampaignBlocks recipe={{ blocks }} programs={programs} hrefSuffix="" />
            </div>
          </div>
        </section>
      </div>

      <section className="card p-4" aria-labelledby="versions-h">
        <div className="between wrap gap-2">
          <h2 id="versions-h" className="t-md w6">Versions</h2>
          <span className="t-sm">
            {live ? <>Live: version {live} at {origin ? <a className="u" href={`${origin}/c/${slug}`} target="_blank" rel="noreferrer">{origin.replace(/^https?:\/\//, "")}/c/{slug}</a> : `/c/${slug}`}</> : "Not published"}
          </span>
        </div>
        <ul style={{ marginTop: 6 }}>
          {[...revisions].reverse().map((r) => (
            <li key={r.version} className="desk-row between wrap gap-2 t-sm">
              <span>
                <span className="w6">Version {r.version}</span>{r.version === live ? <span className="chip chip-pos t-2xs" style={{ marginLeft: 6 }}>✓ Live</span> : null}
                <span className="t-xs c-4"> · {WHEN(r.at)} by {r.by}{r.note ? ` · ${r.note}` : ""}</span>
              </span>
              <span className="row gap-2">
                <button type="button" className="u t-xs" onClick={() => setBlocks(r.recipe.blocks)}>Load into the editor</button>
                {r.version !== live ? (
                  <button type="button" className="btn btn-sm btn-g" disabled={pending}
                    onClick={() => act(() => publishCampaign({ id, action: live !== null && r.version < live ? "rollback" : "publish", version: r.version, requestId: crypto.randomUUID() }))}>
                    {live !== null && r.version < live ? "Roll back to this" : "Publish this"}
                  </button>
                ) : (
                  <button type="button" className="btn btn-sm btn-g" disabled={pending} onClick={() => act(() => publishCampaign({ id, action: "unpublish", version: null, requestId: crypto.randomUUID() }))}>Unpublish</button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {history.length ? (
          <p className="t-xs c-4" style={{ marginTop: 8 }}>
            {[...history].reverse().slice(0, 5).map((h) => `${h.action === "unpublish" ? "Unpublished" : h.action === "rollback" ? `Rolled back to version ${h.version}` : `Published version ${h.version}`} ${WHEN(h.at)} by ${h.by}`).join(" · ")}
          </p>
        ) : null}
        <p className="t-xs c-4" style={{ marginTop: 6 }}>Someone who opened an earlier version keeps seeing it; publishing changes what new visitors see.</p>
      </section>
      {error ? <p role="alert" className="t-sm c-neg">{error}</p> : null}
    </div>
  );
}
