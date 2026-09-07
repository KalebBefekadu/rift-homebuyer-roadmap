"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import type { Funnel, Question } from "@/lib/core/funnel";
import { OWNERSHIP_CAVEAT, type Ownership } from "@/lib/core/funnel";
import { BUYER_DEFAULTS, cashToClose, cashGap, money } from "@/lib/core/compute";
import { track, flush, useCaptureTouch } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";

/**
 * The assessment.
 *
 * Everything here follows from one measurement: paid traffic is mostly phones,
 * and a phone is where a long form dies. So —
 *
 *   * One question per screen. Choosing an option advances on its own; making
 *     somebody tap an answer and then tap Next is asking twice.
 *   * The live value panel stays on screen. It is the reason to keep going, and
 *     hiding it below the fold on mobile removes the reason.
 *   * Answers persist locally from the first one, with no account, so a
 *     returning visitor resumes rather than restarts.
 *   * Questions already answered on the landing page are not asked again.
 */

const DRAFT = "rift.buy.draft";

type Answers = Record<string, string | number>;

export function Assessment({ funnel }: { funnel: Funnel }) {
  const router = useRouter();
  const q = useSearchParams();
  const [answers, setAnswers] = useState<Answers>({});
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const assessmentId = useRef<string | null>(null);
  const shownAt = useRef<number>(Date.now());

  useCaptureTouch();

  const questions = useMemo(() => funnel.questions.filter((x) => x.enabled), [funnel]);

  /* Restore, then apply anything the landing page already asked. Landing
     answers win: they are the most recent thing the person said. */
  useEffect(() => {
    let restored: Answers = {};
    try {
      const raw = window.localStorage.getItem(DRAFT);
      if (raw) restored = JSON.parse(raw) as Answers;
    } catch { /* storage unavailable — start clean */ }

    const fromLanding: Answers = {};
    const c = q.get("c"); const t = q.get("t");
    if (c) fromLanding.county = c;
    if (t) fromLanding.timing = t;

    const merged = { ...restored, ...fromLanding };
    setAnswers(merged);

    const answered = questions.findIndex((x) => merged[x.id] === undefined);
    setI(answered === -1 ? questions.length - 1 : answered);
    setReady(true);

    const resumed = Object.keys(restored).length > 0;
    track({ name: resumed ? "assessment_resume" : "assessment_start", side: "buy", meta: { prefilled: Object.keys(fromLanding).length } });

    fetch("/api/assessment/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId(), side: "buy", county: merged.county ?? null }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.id) assessmentId.current = d.id; })
      .catch(() => { /* the assessment still works; it just is not stored */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(DRAFT, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, ready]);

  const current = questions[i];

  useEffect(() => {
    if (!ready || !current) return;
    shownAt.current = Date.now();
    track({ name: "question_view", side: "buy", questionKey: current.id, meta: { step: i + 1, of: questions.length } });
  }, [i, ready, current, questions.length]);

  /* The panel is computed from whatever has been answered so far, on defaults
     for the rest. Showing a number that moves as they answer is the entire
     argument for finishing. */
  const live = useMemo(() => {
    const inputs = {
      ...BUYER_DEFAULTS,
      county: String(answers.county ?? BUYER_DEFAULTS.county),
      price: Number(answers.price ?? BUYER_DEFAULTS.price),
      savings: Number(answers.savings ?? BUYER_DEFAULTS.savings),
      monthlySaving: Number(answers.monthlySaving ?? BUYER_DEFAULTS.monthlySaving),
      assistance: 0,
    };
    const cash = cashToClose(inputs);
    const gap = cashGap(inputs);
    return { cash, gap, inputs };
  }, [answers]);

  const answeredCount = questions.filter((x) => answers[x.id] !== undefined).length;

  const answer = (value: string | number) => {
    if (!current) return;
    const key = current.bound ?? current.id;
    track({
      name: "question_answer", side: "buy", questionKey: current.id,
      dwellMs: Date.now() - shownAt.current,
      meta: { step: i + 1 },
    });

    setAnswers((a) => ({ ...a, [current.id]: value, ...(current.bound ? { [key]: value } : {}) }));

    if (assessmentId.current) {
      /* The question key is stored; the value is stored in `rift_answers`,
         which is a different table from telemetry with a different retention
         rule. The two must never be joinable. */
      fetch("/api/assessment/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: assessmentId.current, questionKey: current.id, value }),
      }).catch(() => { /* the readout is still computable from local state */ });
    }
  };

  const next = () => {
    if (i < questions.length - 1) { setI(i + 1); return; }
    finish();
  };

  const finish = () => {
    flush();
    if (assessmentId.current) {
      fetch("/api/assessment/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: assessmentId.current }),
      }).catch(() => { /* ignore */ });
    }
    const p = new URLSearchParams({
      c: String(answers.county ?? BUYER_DEFAULTS.county),
      p: String(answers.price ?? BUYER_DEFAULTS.price),
      s: String(answers.savings ?? BUYER_DEFAULTS.savings),
      r: String(answers.monthlySaving ?? BUYER_DEFAULTS.monthlySaving),
      t: String(answers.timing ?? "3 to 9 months"),
      o: String(answers.ownership ?? "none"),
    });
    router.push(`/buy/results?${p}`);
  };

  /* Leaving without finishing is the most common outcome and the most valuable
     event in the funnel. It is recorded on the way out, not inferred later. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (answeredCount >= questions.length) return;
      track({ name: "assessment_abandon", side: "buy", questionKey: current?.id, meta: { answered: answeredCount, of: questions.length } });
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [answeredCount, questions.length, current]);

  if (!ready || !current) {
    return <main className="shell-w sec buy"><p className="t-sm c-4">Loading your questions…</p></main>;
  }

  const value = answers[current.id];
  const hasValues = answeredCount > 0;

  return (
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/buy" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <span className="t-xs c-4">{i + 1} of {questions.length}</span>
        </div>
        <div style={{ height: 3, background: "var(--line-3)" }}>
          <div style={{ height: "100%", width: `${((i + 1) / questions.length) * 100}%`, background: "var(--brand)", transition: "width .3s ease" }} />
        </div>
      </header>

      <main className="shell-w askgrid" data-values={hasValues ? "1" : "0"} style={{ paddingTop: 24 }}>
        <aside>
          <div className="card p-4">
            <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
              So far
            </div>
            <div className="num" style={{ fontSize: 26, marginTop: 6 }}>{money(live.cash.total)}</div>
            <div className="t-xs c-4">cash to close, not {money(live.cash.down)} down</div>
            {live.gap.gap > 0 ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                <div className="t-sm w6">{money(live.gap.gap)} still to find</div>
                <div className="t-xs c-4" style={{ marginTop: 2 }}>
                  {live.gap.monthsToClose !== null ? `about ${live.gap.monthsToClose} months at your rate` : "tell us a saving rate for a date"}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                <div className="t-sm w6 c-pos">Covered on savings alone</div>
              </div>
            )}
            <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Updating as you answer. Assistance is not counted here — it is upside, and only
              a lender can confirm it.
            </p>
          </div>
        </aside>

        <section>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
            {current.topic}
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(22px,3.4vw,34px)", lineHeight: 1.15, letterSpacing: "-0.02em", marginTop: 8, maxWidth: 560 }}>
            {current.title}
          </h1>
          {current.description ? (
            <p className="t-sm c-3" style={{ marginTop: 10, maxWidth: 520, lineHeight: 1.6 }}>{current.description}</p>
          ) : null}

          <div style={{ marginTop: 20, maxWidth: 520 }}>
            <Field q={current} value={value} onChange={answer} onAdvance={next} />
          </div>

          {current.id === "ownership" && typeof value === "string" && OWNERSHIP_CAVEAT[value as Ownership] ? (
            <p className="t-xs c-3" style={{ marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>
              <Ico.info size={11} style={{ marginRight: 5 }} />
              {OWNERSHIP_CAVEAT[value as Ownership]}
            </p>
          ) : null}

          <div className="ask-nav row gap-2" style={{ marginTop: 24 }}>
            {i > 0 ? (
              <button className="btn btn-g" onClick={() => setI(i - 1)}><Ico.chevL size={14} />Back</button>
            ) : null}
            <div className="spacer" />
            <button className="btn btn-p" onClick={next} disabled={current.required && value === undefined}>
              {i === questions.length - 1 ? "Show my numbers" : "Next"}
              <Ico.arrowR size={14} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Fields
 * ------------------------------------------------------------------ */

function Field({ q, value, onChange, onAdvance }: {
  q: Question;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
  onAdvance: () => void;
}) {
  if (q.type === "choice" || q.type === "select") {
    return (
      <div className={q.type === "select" ? "" : "col gap-2"}>
        {q.type === "select" ? (
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose one</option>
            {(q.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          (q.options ?? []).map((o) => (
            <button
              key={o.value}
              className="opt"
              data-on={value === o.value}
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => {
                onChange(o.value);
                /* Advance on its own, after just long enough for the selection
                   to register visually. Making somebody confirm an answer they
                   have already given is asking the same question twice. */
                setTimeout(onAdvance, 190);
              }}
            >
              <span className="t-sm">{o.label}</span>
            </button>
          ))
        )}
      </div>
    );
  }

  if (q.type === "slider") {
    return <Slider q={q} value={Number(value ?? q.min ?? 0)} onChange={onChange} />;
  }

  return (
    <input
      className="input"
      value={String(value ?? "")}
      placeholder={q.fieldLabel ?? "Type your answer"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Slider({ q, value, onChange }: { q: Question; value: number; onChange: (v: number) => void }) {
  const min = q.min ?? 0;
  const max = q.max ?? 100;
  const step = q.step ?? 1;

  /* A ref, not the prop. Two taps inside one render both read the same stale
     value otherwise, so a quick double-tap moves one step instead of two. */
  const live = useRef(value);
  live.current = value;
  const nudge = (d: -1 | 1) => {
    const nextV = Math.min(max, Math.max(min, live.current + d * step));
    live.current = nextV;
    onChange(nextV);
  };

  const shown = q.unit === "$"
    ? money(value)
    : `${value.toLocaleString()} ${q.unit ? (value === 1 ? q.unit.replace(/s$/, "") : q.unit) : ""}`.trim();

  return (
    <div>
      <div className="between" style={{ marginBottom: 10 }}>
        <span className="t-sm c-4">{q.fieldLabel ?? "Amount"}</span>
        <span className="num" style={{ fontSize: 22 }}>{shown}</span>
      </div>
      <div className="row gap-2">
        <button className="btn btn-g btn-ico" onClick={() => nudge(-1)} aria-label="Less"><Ico.minus size={14} /></button>
        <input
          className="rng grow"
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={q.fieldLabel ?? q.title}
        />
        <button className="btn btn-g btn-ico" onClick={() => nudge(1)} aria-label="More"><Ico.plus size={14} /></button>
      </div>
    </div>
  );
}
