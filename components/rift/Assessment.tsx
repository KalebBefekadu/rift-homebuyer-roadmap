"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import type { Funnel, Question } from "@/lib/core/funnel";
import { OWNERSHIP_CAVEAT, type Ownership, optionsFor } from "@/lib/core/funnel";
import { BUYER_DEFAULTS, SELLER_DEFAULTS, cashToClose, cashGap, netProceeds, unclaimedValue, money } from "@/lib/core/compute";
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

/* Scoped by side. This was the single key "rift.buy.draft" — named for the
   only funnel that existed when it was written — and it kept serving both once
   this component was generalised. A visitor who looked at the seller
   assessment and later opened the buyer one had the seller's county, price and
   payoff restored into it, and reached a buyer readout computed from a
   stranger's numbers. Their own. Which is worse: it looked personal. */
const draftKey = (side: "buy" | "sell") => `rift.${side}.draft`;

type Answers = Record<string, string | number>;

export function Assessment({ funnel }: { funnel: Funnel }) {
  const router = useRouter();
  const q = useSearchParams();
  const [answers, setAnswers] = useState<Answers>({});
  /* Which questions the PERSON answered, as opposed to which have a seeded
     default sitting in them. Without this distinction the seeded sliders would
     count as progress and the abandonment event — the most valuable one in the
     funnel — would never fire. */
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const assessmentId = useRef<string | null>(null);
  const shownAt = useRef<number>(Date.now());
  /* Abandonment is reported once per session. See the effect below. */
  const abandonSent = useRef(false);

  useCaptureTouch();

  const questions = useMemo(() => funnel.questions.filter((x) => x.enabled), [funnel]);

  /* Restore, then apply anything the landing page already asked. Landing
     answers win: they are the most recent thing the person said. */
  useEffect(() => {
    let restored: Answers = {};
    try {
      const raw = window.localStorage.getItem(draftKey(funnel.side));
      if (raw) restored = JSON.parse(raw) as Answers;
    } catch { /* storage unavailable — start clean */ }

    const fromLanding: Answers = {};
    const c = q.get("c"); const t = q.get("t");
    if (c) fromLanding.county = c;
    if (t) fromLanding.timing = t;

    /* Seed every numeric question from the same defaults the live panel
       computes with.

       Without this the price slider rendered "$0" while the panel beside it
       said $26,188 — a figure derived from a $325,000 price the visitor could
       not see and had never given. Somebody who pressed Next without touching
       the slider would then get a readout built on $325,000 having been shown
       $0. Shown and used must be the same number; that is the whole product. */
    /* Per side. Seeding the seller funnel from BUYER_DEFAULTS put $325,000 in
       the price slider — the buyer default — while the panel beside it computed
       from the seller ones, and left `payoff` and `yearsOwned` unseeded
       entirely because no such buyer default exists. That is the same
       shown-vs-used split described above, reintroduced on the other side the
       day this component was made to serve both. */
    const DEFAULTS = funnel.side === "sell" ? SELLER_DEFAULTS : BUYER_DEFAULTS;
    const seeded: Answers = {};
    for (const question of questions) {
      if (question.type !== "slider" || !question.bound) continue;
      const d = (DEFAULTS as unknown as Record<string, unknown>)[question.bound];
      if (typeof d === "number") { seeded[question.id] = d; seeded[question.bound] = d; }
    }

    const merged = { ...seeded, ...restored, ...fromLanding };
    setAnswers(merged);

    /* Seeded defaults are not answers. Resume at the first question the person
       has not actually touched, or they would be dropped at the end of a form
       they never filled in. */
    const already = { ...restored, ...fromLanding };
    setTouched(new Set(Object.keys(already)));
    const answered = questions.findIndex((x) => already[x.id] === undefined);
    setI(answered === -1 ? questions.length - 1 : answered);
    setReady(true);

    const resumed = Object.keys(restored).length > 0;
    track({ name: resumed ? "assessment_resume" : "assessment_start", side: funnel.side, meta: { prefilled: Object.keys(fromLanding).length } });

    fetch("/api/assessment/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId(), side: funnel.side, county: merged.county ?? null }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.id) assessmentId.current = d.id; })
      .catch(() => { /* the assessment still works; it just is not stored */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(draftKey(funnel.side), JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, ready]);

  const current = questions[i];

  useEffect(() => {
    if (!ready || !current) return;
    shownAt.current = Date.now();
    track({ name: "question_view", side: funnel.side, questionKey: current.id, meta: { step: i + 1, of: questions.length } });
  }, [i, ready, current, questions.length]);

  /* The panel is computed from whatever has been answered so far, on defaults
     for the rest. Showing a number that moves as they answer is the entire
     argument for finishing. */
  const live = useMemo(() => {
    if (funnel.side === "sell") {
      const inputs = {
        ...SELLER_DEFAULTS,
        county: String(answers.county ?? SELLER_DEFAULTS.county),
        price: Number(answers.price ?? SELLER_DEFAULTS.price),
        payoff: Number(answers.payoff ?? SELLER_DEFAULTS.payoff),
        yearsOwned: Number(answers.yearsOwned ?? SELLER_DEFAULTS.yearsOwned),
      };
      const r = netProceeds(inputs);
      const unclaimed = unclaimedValue(inputs);
      return {
        headline: money(r.net),
        note: `reaches you, not the ${money(inputs.price)} price`,
        /* Underwater is a real outcome and the one most worth knowing early.
           It is stated rather than softened. */
        sub: r.net < 0
          ? { text: `${money(Math.abs(r.net))} short of the payoff`, tone: "c-neg", detail: "Selling at this price would need money brought to closing." }
          : unclaimed.length > 0
            ? { text: `${unclaimed.length} things worth a phone call`, tone: "c-brand", detail: "Exemptions and refunds that have nothing to do with selling." }
            : null,
        foot: "Updating as you answer. Costs are Georgia averages until we see the listing.",
      };
    }
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
    return {
      headline: money(cash.total),
      note: `cash to close, not ${money(cash.down)} down`,
      sub: gap.gap > 0
        ? {
            text: `${money(gap.gap)} still to find`,
            tone: "",
            detail: gap.monthsToClose !== null ? `about ${gap.monthsToClose} months at your rate` : "tell us a saving rate for a date",
          }
        : { text: "Covered on savings alone", tone: "c-pos", detail: "" },
      foot: "Updating as you answer. Assistance is not counted here — it is upside, and only",
    };
  }, [answers, funnel.side]);

  const answeredCount = questions.filter((x) => touched.has(x.id)).length;

  const answer = (value: string | number) => {
    if (!current) return;
    const key = current.bound ?? current.id;
    track({
      name: "question_answer", side: funnel.side, questionKey: current.id,
      dwellMs: Date.now() - shownAt.current,
      meta: { step: i + 1 },
    });

    setAnswers((a) => ({ ...a, [current.id]: value, ...(current.bound ? { [key]: value } : {}) }));
    setTouched((t) => new Set(t).add(current.id));

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
    /* Somebody who backgrounded the tab mid-way and came back to finish is not
       an abandonment. Without this the same person is counted in both. */
    abandonSent.current = true;
    flush();
    if (assessmentId.current) {
      fetch("/api/assessment/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: assessmentId.current }),
      }).catch(() => { /* ignore */ });
    }
    /* The readout is reached by URL, so the answers travel as query
       parameters rather than in a store. Each side carries the inputs its own
       compute engine needs — the keys differ because the questions do.

       Note "o" means ownership for a buyer and payoff for a seller. They never
       share a page, and each is parsed by its own side's parser. */
    const p = funnel.side === "sell"
      ? new URLSearchParams({
          c: String(answers.county ?? SELLER_DEFAULTS.county),
          p: String(answers.price ?? SELLER_DEFAULTS.price),
          o: String(answers.payoff ?? SELLER_DEFAULTS.payoff),
          y: String(answers.yearsOwned ?? SELLER_DEFAULTS.yearsOwned),
          t: String(answers.timing ?? "3 to 9 months"),
          w: answers.who ? "1" : "",
        })
      : new URLSearchParams({
          c: String(answers.county ?? BUYER_DEFAULTS.county),
          p: String(answers.price ?? BUYER_DEFAULTS.price),
          s: String(answers.savings ?? BUYER_DEFAULTS.savings),
          r: String(answers.monthlySaving ?? BUYER_DEFAULTS.monthlySaving),
          t: String(answers.timing ?? "3 to 9 months"),
          o: String(answers.ownership ?? "none"),
          /* Carries the co-buyer answer so the readout can score it. Their name
             is not needed and is not sent — only that somebody else is in the
             decision. */
          w: answers.who ? "1" : "",
        });
    router.push(`/${funnel.side}/results?${p}`);
  };

  /* Leaving without finishing is the most common outcome and the most valuable
     event in the funnel. It is recorded on the way out, not inferred later.
     
     Once per session, not once per visibility change. Abandonment is a STATE,
     not a repeated occurrence — and a phone user who switches apps four times
     while thinking about a question was emitting four abandonments, which
     would have made the single most important metric in the product read
     several times worse than reality. Found by looking at what a real run
     actually wrote to the database. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (abandonSent.current) return;
      if (answeredCount >= questions.length) return;
      abandonSent.current = true;
      track({ name: "assessment_abandon", side: funnel.side, questionKey: current?.id, meta: { answered: answeredCount, of: questions.length } });
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
    <div className={funnel.side}>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href={`/${funnel.side}`} className="row gap-2">
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
            <div className="num" style={{ fontSize: 26, marginTop: 6 }}>{live.headline}</div>
            <div className="t-xs c-4">{live.note}</div>
            {live.sub ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                <div className={`t-sm w6 ${live.sub.tone}`}>{live.sub.text}</div>
                {live.sub.detail ? (
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>{live.sub.detail}</div>
                ) : null}
              </div>
            ) : null}
            <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.5 }}>
              {live.foot}
              {funnel.side === "buy" ? " a lender can confirm it." : ""}
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
  /* Some questions carry their own options and some are bound to a list the
     product owns. County is the second kind: the funnel definition names the
     binding and the registry supplies the values, so that adding a county is
     one edit rather than an edit per funnel.

     Resolving it here was missing entirely. The county question rendered a
     select containing nothing but "Choose one", and county is question two of
     both funnels and required — so NOBODY could complete an assessment on
     either side. It failed the way the worst bugs in this product fail: the
     page rendered, nothing errored, and the control was simply empty. */
  const options = optionsFor(q);

  if (q.type === "choice" || q.type === "select") {
    return (
      <div className={q.type === "select" ? "" : "col gap-2"}>
        {q.type === "select" ? (
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose one</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          options.map((o) => (
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
      placeholder={q.placeholder ?? q.fieldLabel ?? "Type your answer"}
      /* The question is an <h1> above rather than a <label>, so without this a
         screen reader announces an unlabelled text box and the person has to
         infer what it wants from what was said before it. */
      aria-label={q.title}
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
