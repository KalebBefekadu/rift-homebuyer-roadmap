"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import { MoneyField } from "@/components/rift/value/MoneyField";
import { ASKS } from "@/lib/core/asks";
import { VALUES, type InputKey, type ValueSide } from "@/lib/core/values";
import {
  FEEDS, LIMITS, QUESTION_SIDES, askedBy, cleanWording, codeWording, diffWording, mergeAsk, optionsEditable,
  sideKeys, wordingErrors, wordingOf, type BuiltinWording, type Change, type CustomKey, type CustomQuestion, type Wording,
} from "@/lib/core/question-wording";
import { newRequestId } from "@/lib/core/ids";
import { publishWording } from "./actions";
import s from "./questions.module.css";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const SIDE_LABEL = Object.fromEntries(QUESTION_SIDES.map((x) => [x.id, x.label])) as Record<ValueSide, string>;

const rand = (n: number) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

/**
 * The question editor (D37).
 *
 * Edits are a draft in this page until they are published: one version, with
 * a note, listed below with who published it and when. The draft is kept raw
 * while typing (a cleaner that trims spaces would eat the space after every
 * word) and cleaned for the preview of what will be published, the checks
 * and the publish itself, which the server cleans again.
 *
 * Side tabs switch in the page rather than by link, so moving from Buyers to
 * Sellers does not throw away an unpublished edit; the side is kept in the
 * address so a reload returns to it.
 */
export function Editor({ side: firstSide, published, start, version, readOnly }: {
  side: ValueSide;
  /** What visitors read now. */
  published: Wording;
  /** Where the draft starts: the live words, or an earlier version being restored. */
  start: Wording;
  /** The live version number; 0 is the built-in wording. */
  version: number;
  /** Looking at an earlier version, or nothing can be published here. */
  readOnly: boolean;
}) {
  const router = useRouter();
  const [side, setSide] = useState<ValueSide>(firstSide);
  const [draft, setDraft] = useState<Wording>(start);
  const [open, setOpen] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const clean = useMemo(() => cleanWording(draft), [draft]);
  const changes = useMemo(() => diffWording(published, clean), [published, clean]);
  const errors = useMemo(() => wordingErrors(clean), [clean]);

  /* Leaving with unpublished edits asks first. */
  useEffect(() => {
    if (readOnly || !changes.length) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes.length, readOnly]);

  const pickSide = (next: ValueSide) => {
    setSide(next);
    setOpen(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("side", next);
      window.history.replaceState(null, "", u.toString());
    } catch { /* the address is a convenience */ }
  };

  const keys = sideKeys(side);
  const customHere = draft.custom.filter((q) => q.sides.includes(side));
  const publishedKeys = new Set(published.custom.map((q) => q.key));

  const setBuiltin = (key: InputKey, bw: BuiltinWording | null) => setDraft((d) => {
    const builtin = { ...d.builtin };
    if (bw) builtin[key] = bw; else delete builtin[key];
    return { ...d, builtin };
  });
  const setCustom = (key: CustomKey, patch: Partial<CustomQuestion> | null) => setDraft((d) => ({
    ...d,
    custom: patch === null ? d.custom.filter((q) => q.key !== key) : d.custom.map((q) => (q.key === key ? { ...q, ...patch } : q)),
  }));
  /* Up or down past the next question on this side; questions on other sides keep their places. */
  const move = (key: CustomKey, dir: -1 | 1) => setDraft((d) => {
    const list = [...d.custom];
    const i = list.findIndex((q) => q.key === key);
    let j = i + dir;
    while (j >= 0 && j < list.length && !list[j]!.sides.includes(side)) j += dir;
    if (i < 0 || j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j]!, list[i]!];
    return { ...d, custom: list };
  });
  const add = () => {
    const key = `x_${rand(8)}` as CustomKey;
    setDraft((d) => ({
      ...d,
      custom: [...d.custom, { key, type: "choice", title: "", why: null, options: [{ value: rand(6), label: "" }, { value: rand(6), label: "" }], sides: [side], values: [], enabled: true }],
    }));
    setOpen(key);
  };

  const publish = () => run(async () => {
    setError(null);
    const r = await publishWording({ wording: clean, expectedVersion: version, note: note.trim() || null, requestId: newRequestId() });
    if (!r.ok) { setError(r.error); return; }
    router.replace(`/operations/questions?side=${side}&published=${r.version}`);
    router.refresh();
  });

  const count = (id: ValueSide) => sideKeys(id).length + draft.custom.filter((q) => q.sides.includes(id)).length;

  return (
    <>
      <div className={s.toolbar}>
        <div className="ops-tabs" role="tablist" aria-label="Which side">
          {QUESTION_SIDES.map((t) => (
            <button key={t.id} type="button" role="tab" className="ops-tab" aria-selected={side === t.id}
              aria-current={side === t.id ? "page" : undefined} onClick={() => pickSide(t.id)}>
              {t.label}<span className="ops-tab-count">{count(t.id)}</span>
            </button>
          ))}
        </div>
        {!readOnly ? <span className="t-xs c-4">Edits stay on this page until you publish them.</span> : null}
      </div>

      {side === "abroad" ? (
        <div className="ops-notice ops-notice-info">
          <Ico.info size={15} className="ops-notice-ico" />
          <div className="ops-notice-body">
            <div className="ops-notice-title">The abroad landing page asks in its own words</div>
            <div className="ops-notice-text">
              These are the questions on Cost to buy and own. The first question at /abroad is translated into Amharic
              and is changed with a release, so its English and Amharic always say the same thing.
            </div>
          </div>
        </div>
      ) : null}

      <section className="ops-sec" aria-labelledby="builtin-h">
        <div className="ops-sec-head">
          <div>
            <h2 className="ops-sec-title" id="builtin-h">The values&apos; questions</h2>
            <p className="ops-sec-hint">
              Asked one at a time before a visitor sees their answer, each once: an answer given to one value is reused by every other.
              The words are yours to change. What an answer feeds is not.
            </p>
          </div>
        </div>
        <ol className={s.list}>
          {keys.map((k, i) => (
            <BuiltinCard key={k} n={i + 1} k={k} side={side} readOnly={readOnly}
              draft={draft.builtin[k] ?? codeWording(k)} clean={wordingOf(clean, k)} live={wordingOf(published, k)}
              mine={Boolean(clean.builtin[k])} open={open === k}
              onOpen={() => setOpen(open === k ? null : k)} onChange={(bw) => setBuiltin(k, bw)} />
          ))}
        </ol>
      </section>

      <section className="ops-sec" aria-labelledby="custom-h">
        <div className="ops-sec-head">
          <div>
            <h2 className="ops-sec-title" id="custom-h">Your own questions</h2>
            <p className="ops-sec-hint">
              Asked after someone saves their plan, on the screen that confirms it, so they never stand between a visitor and
              their answer or cost a saved plan. Always optional. Their answers appear on the person&apos;s record and feed no figure.
            </p>
          </div>
        </div>
        <ol className={s.list}>
          {customHere.map((q, i) => (
            <CustomCard key={q.key} n={i + 1} q={q} side={side} readOnly={readOnly} asked={customHere.filter((x) => x.enabled).length}
              published={publishedKeys.has(q.key)} live={published.custom.find((p) => p.key === q.key) ?? null}
              clean={clean.custom.find((p) => p.key === q.key) ?? q}
              first={i === 0} last={i === customHere.length - 1} open={open === q.key}
              onOpen={() => setOpen(open === q.key ? null : q.key)}
              onChange={(patch) => setCustom(q.key, patch)} onMove={(d) => move(q.key, d)} />
          ))}
          {!customHere.length ? (
            <li className="ops-empty">
              <div className="ops-empty-title">No questions of your own for {SIDE_LABEL[side].toLowerCase()}</div>
              <p className="ops-empty-text">Add one to learn something the values do not ask, such as how they heard of you. It is asked once, after they save.</p>
            </li>
          ) : null}
          {!readOnly && draft.custom.length < LIMITS.custom ? (
            <li><button type="button" className={`btn btn-s ${s.add}`} onClick={add}><Ico.plus size={14} />Add a question</button></li>
          ) : !readOnly ? (
            <li className="t-xs c-4">That is the most: {LIMITS.custom} of your own questions, across every side. Past that the confirmation becomes a second form.</li>
          ) : null}
        </ol>
      </section>

      {!readOnly && (changes.length || reviewing) ? (
        <section className="ops-sec" id="publish" aria-labelledby="publish-h">
          <div className="ops-sec-head">
            <div>
              <h2 className="ops-sec-title" id="publish-h">Publish</h2>
              <p className="ops-sec-hint">Everything that changes, as a visitor would notice it. Publishing makes version {version + 1}; version {version} stays in the history.</p>
            </div>
          </div>
          <div className="card">
            {changes.length ? <Diff changes={changes} /> : <p className="t-sm c-3 p-4">Nothing has changed since version {version}.</p>}
            <div className={s.publish}>
              {errors.length ? (
                <div className="ops-notice ops-notice-neg" role="alert" style={{ marginBottom: 0 }}>
                  <Ico.alert size={15} className="ops-notice-ico" />
                  <div className="ops-notice-body">
                    <div className="ops-notice-title">Fix these before publishing</div>
                    <ul className={s.errors}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                </div>
              ) : null}
              <label className="field">
                <span className="label">Note for the history <span className="c-4 w4">(optional)</span></span>
                <input className="input" maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why these words" />
              </label>
              {error ? (
                <p className="t-sm c-neg row-t gap-2" role="alert"><Ico.alert size={13} style={{ flex: "none", marginTop: 3 }} />{error}</p>
              ) : null}
              <div className="row gap-2 wrap">
                <button type="button" className="btn btn-p" disabled={pending || !changes.length || errors.length > 0} onClick={publish}>
                  {pending ? "Publishing…" : `Publish version ${version + 1}`}
                </button>
                <span className="t-xs c-4">Visitors see it within a minute. People who already saved keep the words they were shown.</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!readOnly && changes.length ? (
        <div className={s.bar} role="status">
          <span className={s.barText}><Ico.clock size={14} />{changes.length} unpublished change{changes.length === 1 ? "" : "s"}</span>
          <span className={s.barActions}>
            <button type="button" className={`btn btn-sm ${s.barGhost}`}
              onClick={() => { if (window.confirm("Discard every unpublished change on this page?")) { setDraft(published); setOpen(null); setReviewing(false); } }}>
              Discard
            </button>
            <button type="button" className={`btn btn-sm ${s.barMain}`}
              onClick={() => { setReviewing(true); requestAnimationFrame(() => document.getElementById("publish")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>
              Review and publish<Ico.arrowR size={13} />
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}

/** A list of changes, question by question. Shared with the history view. */
export function Diff({ changes }: { changes: Change[] }) {
  return (
    <div className={s.diff}>
      {changes.map((c, i) => (
        <div key={i} className={s.diffRow}>
          <div>
            <div className={s.diffQ}>{c.question}</div>
            <div className={s.diffWhat}>{c.what}</div>
          </div>
          <div className={s.diffChange}>
            {c.from !== undefined ? <span className={s.from}><span className="sr-only">Was: </span>{c.from}</span> : null}
            {c.to !== undefined ? <span className={s.to}><span className="sr-only">Now: </span>{c.to}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** `old` is an earlier version being read: its words were not live now, so never say they are. */
function StateChip({ kind, old }: { kind: "edited" | "mine" | "builtin" | "off" | "new"; old?: boolean }) {
  const map = {
    edited: { cls: s.stateEdited, icon: <Ico.clock size={11} />, word: "Not published" },
    new: { cls: s.stateEdited, icon: <Ico.plus size={11} />, word: "New, not published" },
    mine: { cls: s.stateMine, icon: <Ico.check size={11} />, word: old ? "Your words" : "Your words, live" },
    builtin: { cls: "", icon: <Ico.doc size={11} />, word: old ? "Built-in words" : "Built-in words, live" },
    off: { cls: s.stateOff, icon: <Ico.pause size={11} />, word: "Off" },
  }[kind];
  return <span className={`${s.state} ${map.cls}`}>{map.icon}{map.word}</span>;
}

function BuiltinCard({ n, k, side, draft, clean, live, mine, open, readOnly, onOpen, onChange }: {
  n: number; k: InputKey; side: ValueSide;
  /** Raw, as typed. */
  draft: BuiltinWording;
  /** As it would be published. */
  clean: BuiltinWording;
  /** As visitors read it now. */
  live: BuiltinWording;
  mine: boolean; open: boolean; readOnly: boolean;
  onOpen: () => void; onChange: (bw: BuiltinWording | null) => void;
}) {
  const def = ASKS[k];
  const edited = JSON.stringify(clean) !== JSON.stringify(live);
  const code = codeWording(k);
  const merged = mergeAsk(k, { builtin: { [k]: clean }, custom: [] });
  const here = askedBy(k, side);
  const elsewhere = QUESTION_SIDES.filter((x) => x.id !== side && askedBy(k, x.id).length);
  const set = (patch: Partial<BuiltinWording>) => onChange({ ...draft, ...patch });

  return (
    <li className={s.card} data-open={open}>
      <div className={s.head}>
        <div className={s.headText}>
          <div className={s.num}>Question {n}</div>
          <h3 className={s.title}>{clean.title}</h3>
          {clean.why ? <p className={s.why}>{clean.why}</p> : null}
          {def.type === "choice" && def.options && def.options.length <= 12 ? (
            <div className={s.chips}>
              {merged.options!.map((o) => <span key={o.value} className={s.choice}>{o.label}{o.hint ? <span> · {o.hint}</span> : null}</span>)}
            </div>
          ) : def.type === "money" ? (
            <div className={s.chips}><span className={s.choice}>{clean.unitLabel ?? "Amount"}<span> · {money(def.limits!.min)} to {money(def.limits!.max)}</span></span></div>
          ) : (
            <div className={s.chips}><span className={s.choice}>{def.options?.length ?? 0} choices</span></div>
          )}
          <p className={s.meta}>
            <strong>Asked by</strong> {here.map((v) => v.name).join(", ")}
            {elsewhere.length ? <> · <strong>Same words on</strong> {elsewhere.map((x) => x.label).join(", ")}</> : null}
          </p>
        </div>
        <div className={s.headActions}>
          <StateChip old={readOnly} kind={edited ? "edited" : mine ? "mine" : "builtin"} />
          {!readOnly ? (
            <button type="button" className="btn btn-s btn-sm" aria-expanded={open} onClick={onOpen}>
              {open ? <>Close<Ico.chevD size={12} style={{ transform: "rotate(180deg)" }} /></> : <>Edit<Ico.chevD size={12} /></>}
            </button>
          ) : null}
        </div>
      </div>

      {open && !readOnly ? (
        <div className={s.editor}>
          <div className={s.fields}>
            <label className="field">
              <span className="label">Question</span>
              <input className="input" maxLength={LIMITS.title.max} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
              {!draft.title.trim() ? <span className={s.fieldHint}>Empty: the built-in question is used.</span> : null}
            </label>
            <label className="field">
              <span className="label">Why we ask <span className="c-4 w4">(optional)</span></span>
              <textarea className={`ta ${s.textarea}`} maxLength={LIMITS.why} value={draft.why ?? ""} onChange={(e) => set({ why: e.target.value })} />
              <span className={s.fieldHint}>One line under the question. Leave it empty to show none.</span>
            </label>
            {def.type === "money" ? (
              <label className="field">
                <span className="label">Label beside the amount</span>
                <input className="input" maxLength={LIMITS.unit} value={draft.unitLabel ?? ""} onChange={(e) => set({ unitLabel: e.target.value })} />
              </label>
            ) : null}
            {optionsEditable(k) ? (
              <div>
                <span className="label">Choices</span>
                <div className={s.opts}>
                  {draft.options.map((o, i) => (
                    <div key={o.value} className={s.optRow}>
                      <input className="input input-sm" aria-label={`Choice ${i + 1}`} maxLength={LIMITS.optionLabel} value={o.label}
                        onChange={(e) => set({ options: draft.options.map((p) => (p.value === o.value ? { ...p, label: e.target.value } : p)) })} />
                      <input className="input input-sm" aria-label={`Hint under choice ${i + 1}`} placeholder="Hint (optional)" maxLength={LIMITS.hint} value={o.hint ?? ""}
                        onChange={(e) => set({ options: draft.options.map((p) => (p.value === o.value ? { ...p, hint: e.target.value } : p)) })} />
                      <span className={s.sends} title="What this choice sends to the figures. Fixed."><Ico.lock size={11} />Sends {o.value}</span>
                    </div>
                  ))}
                </div>
                <span className={s.fieldHint}>Choices keep their order and what they send; only the words change.</span>
              </div>
            ) : def.type === "choice" ? (
              <p className={s.fieldHint}>County names cannot be relabelled: they are the counties the programs, taxes and fees are matched on.</p>
            ) : null}

            <div className={s.fixed}>
              <Ico.lock size={13} />
              <span>
                <strong>What this answer feeds is fixed:</strong> {k === "county" ? "county" : "it"} feeds {FEEDS[k]}.{" "}
                {def.type === "money"
                  ? `Its limits (${money(def.limits!.min)} to ${money(def.limits!.max)}) and the slider stay as they are.`
                  : "Each choice sends the same value whatever it is called."}
              </span>
            </div>

            <div className={s.editActions}>
              <button type="button" className="btn btn-p btn-sm" onClick={onOpen}>Done</button>
              {edited ? <button type="button" className="btn btn-g btn-sm" onClick={() => onChange(JSON.stringify(live) === JSON.stringify(code) ? null : live)}>Undo my changes</button> : null}
              {mine ? <button type="button" className="btn btn-g btn-sm" onClick={() => onChange(null)}><Ico.refresh size={12} />Use the built-in words</button> : null}
            </div>
          </div>

          <div className={s.preview} aria-label="What a visitor sees">
            <div className={s.previewLabel}><Ico.users size={12} />What a visitor sees</div>
            <div className={side === "sell" ? "sell" : side === "abroad" ? "abroad" : "buy"}>
              <h4 className={`serif ${s.previewTitle}`}>{merged.title}</h4>
              {merged.why ? <p className={s.previewWhy}>{merged.why}</p> : null}
              {def.type === "choice" ? (
                <div className={`${s.previewOpts} ${merged.options!.length > 5 ? s.previewOpts2 : ""}`} aria-hidden>
                  {merged.options!.map((o) => (
                    <div key={o.value} className={s.previewOpt}><span>{o.label}{o.hint ? <small>{o.hint}</small> : null}</span><Ico.chevR size={13} className="c-4" /></div>
                  ))}
                </div>
              ) : (
                <div className={s.previewMoney}>
                  <MoneyField key={merged.unitLabel} def={merged} value={Number(def.fallback)} onDone={() => {}} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CustomCard({ n, q, clean, live, side, asked, published, first, last, open, readOnly, onOpen, onChange, onMove }: {
  n: number; q: CustomQuestion;
  /** How many are asked on this side, for the preview's heading. */
  asked: number; clean: CustomQuestion; live: CustomQuestion | null; side: ValueSide;
  published: boolean; first: boolean; last: boolean; open: boolean; readOnly: boolean;
  onOpen: () => void; onChange: (patch: Partial<CustomQuestion> | null) => void; onMove: (d: -1 | 1) => void;
}) {
  const edited = !live || JSON.stringify(clean) !== JSON.stringify(live);
  const valuesOn = VALUES.filter((v) => v.live && q.sides.includes(v.side));
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const onlyWhen = clean.values.map((id) => VALUES.find((v) => v.id === id)?.name ?? id);

  return (
    <li className={s.card} data-open={open} data-off={!clean.enabled}>
      <div className={s.head}>
        <div className={s.headText}>
          <div className={s.num}>Your question {n} · {clean.type === "text" ? "Short answer" : `${clean.options.length} choices`}</div>
          <h3 className={s.title}>{clean.title || <span className="c-4">Untitled question</span>}</h3>
          {clean.why ? <p className={s.why}>{clean.why}</p> : null}
          {clean.type === "choice" && clean.options.length ? (
            <div className={s.chips}>{clean.options.map((o) => <span key={o.value} className={s.choice}>{o.label || "(no label)"}</span>)}</div>
          ) : null}
          <p className={s.meta}>
            <strong>Asked of</strong> {clean.sides.map((x) => SIDE_LABEL[x]).join(", ") || "nobody yet"}
            {onlyWhen.length ? <>, when their plan has {onlyWhen.join(" or ")}</> : null} · <strong>Feeds</strong> no figure
          </p>
        </div>
        <div className={s.headActions}>
          {!live ? <StateChip kind="new" /> : edited ? <StateChip kind="edited" /> : null}
          {!clean.enabled ? <StateChip kind="off" /> : null}
          {!readOnly ? (
            <>
              <button type="button" className="btn btn-g btn-ico" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}><Ico.chevD size={13} style={{ transform: "rotate(180deg)" }} /></button>
              <button type="button" className="btn btn-g btn-ico" aria-label="Move down" disabled={last} onClick={() => onMove(1)}><Ico.chevD size={13} /></button>
              <button type="button" className="btn btn-s btn-sm" aria-expanded={open} onClick={onOpen}>{open ? "Close" : "Edit"}</button>
            </>
          ) : null}
        </div>
      </div>

      {open && !readOnly ? (
        <div className={s.editor}>
          <div className={s.fields}>
            <label className="field">
              <span className="label">Question</span>
              <input className="input" autoFocus={!q.title} maxLength={LIMITS.title.max} value={q.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="How did you hear about me?" />
            </label>
            <label className="field">
              <span className="label">Why we ask <span className="c-4 w4">(optional)</span></span>
              <input className="input" maxLength={LIMITS.why} value={q.why ?? ""} onChange={(e) => onChange({ why: e.target.value })} />
            </label>
            <div>
              <span className="label">Kind of answer</span>
              <div className={s.seg} role="group" aria-label="Kind of answer">
                <button type="button" className={s.segBtn} aria-pressed={q.type === "choice"}
                  onClick={() => onChange({ type: "choice", options: q.options.length >= 2 ? q.options : [...q.options, { value: rand(6), label: "" }, { value: rand(6), label: "" }].slice(0, Math.max(2, q.options.length)) })}>Choices</button>
                <button type="button" className={s.segBtn} aria-pressed={q.type === "text"} onClick={() => onChange({ type: "text" })}>Short answer</button>
              </div>
            </div>
            {q.type === "choice" ? (
              <div>
                <span className="label">Choices</span>
                <div className={s.opts}>
                  {q.options.map((o, i) => (
                    <div key={o.value} className={s.optRowCustom}>
                      <input className="input input-sm" aria-label={`Choice ${i + 1}`} maxLength={LIMITS.optionLabel} value={o.label}
                        onChange={(e) => onChange({ options: q.options.map((p) => (p.value === o.value ? { ...p, label: e.target.value } : p)) })} />
                      <button type="button" className="btn btn-g btn-ico" aria-label={`Remove choice ${i + 1}`} disabled={q.options.length <= LIMITS.customOptions.min}
                        onClick={() => onChange({ options: q.options.filter((p) => p.value !== o.value) })}><Ico.x size={13} /></button>
                    </div>
                  ))}
                </div>
                {q.options.length < LIMITS.customOptions.max ? (
                  <button type="button" className="btn btn-g btn-sm" style={{ marginTop: 6 }} onClick={() => onChange({ options: [...q.options, { value: rand(6), label: "" }] })}><Ico.plus size={12} />Add a choice</button>
                ) : null}
              </div>
            ) : <p className={s.fieldHint}>Up to {LIMITS.textAnswer} characters.</p>}

            <div>
              <span className="label">Who is asked</span>
              <div className={s.checks}>
                {QUESTION_SIDES.map((x) => (
                  <label key={x.id} className={s.check} data-on={q.sides.includes(x.id)}>
                    <input type="checkbox" className="ctl" checked={q.sides.includes(x.id)}
                      onChange={() => {
                        const sides = toggle(q.sides, x.id);
                        onChange({ sides, values: q.values.filter((id) => VALUES.some((v) => v.id === id && sides.includes(v.side))) });
                      }} />
                    {x.label}
                  </label>
                ))}
              </div>
              {!q.sides.includes(side) ? <span className={s.fieldHint}>It will leave this tab: it is no longer asked of {SIDE_LABEL[side].toLowerCase()}.</span> : null}
            </div>
            {valuesOn.length ? (
              <div>
                <span className="label">Only when their plan includes <span className="c-4 w4">(optional; none means any)</span></span>
                <div className={s.checks}>
                  {valuesOn.map((v) => (
                    <label key={v.id} className={s.check} data-on={q.values.includes(v.id)}>
                      <input type="checkbox" className="ctl" checked={q.values.includes(v.id)} onChange={() => onChange({ values: toggle(q.values, v.id) })} />
                      {v.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={s.fixed}>
              <Ico.lock size={13} />
              <span><strong>This question feeds no figure,</strong> and cannot be made to: it has no answer to feed and every value ignores it. Answers are never sent to the site&apos;s analytics.</span>
            </div>

            <div className={s.editActions}>
              <button type="button" className="btn btn-p btn-sm" onClick={onOpen}>Done</button>
              {published ? (
                <button type="button" className="btn btn-g btn-sm" onClick={() => onChange({ enabled: !q.enabled })}>
                  {q.enabled ? <><Ico.pause size={12} />Turn off</> : <><Ico.check size={12} />Turn back on</>}
                </button>
              ) : (
                <button type="button" className="btn btn-g btn-sm c-neg" onClick={() => onChange(null)}><Ico.x size={12} />Remove</button>
              )}
              {published ? <span className="t-xs c-4">A published question is turned off rather than removed, so it can come back as it was.</span> : null}
            </div>
          </div>

          <div className={s.preview} aria-label="What a visitor sees">
            <div className={s.previewLabel}><Ico.users size={12} />What a visitor sees after saving</div>
            <div className={s.previewSaved}>
              <div className="t-md w6">{asked > 1 ? "A few questions from Kaleb" : "One question from Kaleb"}</div>
              <p className="t-xs c-3" style={{ marginTop: 2 }}>Optional. Only Kaleb sees your answers, and they change none of your numbers.</p>
              <div className="t-sm w55" style={{ marginTop: 12 }}>{clean.title || "Your question"}</div>
              {clean.why ? <p className="t-xs c-4" style={{ marginTop: 3 }}>{clean.why}</p> : null}
              {clean.type === "choice" ? (
                <div className={s.previewOpts} aria-hidden style={{ marginTop: 8 }}>
                  {clean.options.map((o) => <div key={o.value} className={s.previewOpt} style={{ fontWeight: 400 }}>{o.label || "…"}</div>)}
                </div>
              ) : <input className="input" style={{ marginTop: 8 }} disabled aria-hidden />}
            </div>
            <p className={s.previewNote}>Shown under the saved plan&apos;s link, on {clean.sides.map((x) => SIDE_LABEL[x].toLowerCase()).join(", ") || "no side yet"}.</p>
          </div>
        </div>
      ) : null}
    </li>
  );
}
