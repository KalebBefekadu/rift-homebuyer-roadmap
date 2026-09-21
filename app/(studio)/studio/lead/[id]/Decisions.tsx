"use client";

import { useState, useTransition } from "react";
import {
  newDecision, addDecisionOption, dropDecisionOption,
  releaseDecision, withdrawDecision, decide, reopenDecision, deleteDecision,
} from "../../actions";
import {
  canRelease, statusOf, KIND_LABEL,
  type Decision, type Kind,
} from "@/lib/core/decision";
import { DecisionRoom } from "@/components/rift/DecisionRoom";
import { Ico } from "@/components/rift/icons";

/**
 * Assembling a decision room, and releasing it.
 *
 * The agent sees EXACTLY what the client will see — the same `DecisionRoom`
 * component the plan page renders, not a second rendering of the same data.
 * Two renderings of one thing drift, and the one that drifts is always the one
 * nobody is looking at. The seller readout learned this the expensive way: a
 * correction applied to the verdict did not travel to four other surfaces
 * saying the same thing.
 *
 * `canRelease` runs here for the live warning and again on the server, which
 * is not redundancy. The server one is the check; this one is the courtesy of
 * showing it before the button is pressed.
 */
export function Decisions({
  leadId,
  decisions,
  agentFirst,
}: {
  leadId: string;
  decisions: Decision[];
  /** His own name, because the preview must read exactly as the client's does. */
  agentFirst: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section style={{ marginTop: 28 }}>
      <div className="between gap-2 wrap" style={{ alignItems: "center" }}>
        <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
          Decisions
        </div>
        <button type="button" className="btn btn-g btn-sm" onClick={() => setAdding((a) => !a)}>
          <Ico.plus size={13} />{adding ? "Cancel" : "New decision"}
        </button>
      </div>

      {adding ? <NewRoom leadId={leadId} onDone={() => setAdding(false)} /> : null}

      {decisions.length === 0 && !adding ? (
        <div className="card p-4" style={{ marginTop: 10 }}>
          <p className="t-sm c-3" style={{ lineHeight: 1.6, maxWidth: 560 }}>
            Nothing here yet. A decision room is for the moments somebody actually stalls —
            which price to target, which offer nets more, whether to sell first. Two or more
            options, each with its number and its trade-off, and the answer written down once
            it is made.
          </p>
        </div>
      ) : null}

      <div className="col gap-4" style={{ marginTop: 12 }}>
        {decisions.map((d) => (
          <Room key={d.id} leadId={leadId} decision={d} agentFirst={agentFirst} />
        ))}
      </div>
    </section>
  );
}

function NewRoom({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>("affordability");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [by, setBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const r = await newDecision({
        leadId, kind, question,
        context: context || null,
        decideBy: by || null,
      });
      if (!r.ok) setError(r.error);
      else onDone();
    });
  };

  return (
    <div className="card p-4" style={{ marginTop: 10 }}>
      <div className="row wrap gap-2">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`chip ${kind === k ? "chip-brand" : ""}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <label className="col gap-1" style={{ marginTop: 14 }}>
        <span className="t-2xs c-4 w6">The question, as they would ask it</span>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Which price should we actually target?"
          maxLength={200}
        />
      </label>

      <label className="col gap-1" style={{ marginTop: 12 }}>
        <span className="t-2xs c-4 w6">Your framing — optional</span>
        <textarea
          className="input"
          rows={2}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What makes this worth deciding now."
        />
      </label>

      <label className="col gap-1" style={{ marginTop: 12, maxWidth: 220 }}>
        <span className="t-2xs c-4 w6">Decide by — optional</span>
        <input type="date" className="input" value={by} onChange={(e) => setBy(e.target.value)} />
      </label>

      {error ? <p className="t-sm c-neg" style={{ marginTop: 10 }} role="alert">{error}</p> : null}

      <button
        type="button"
        className="btn btn-p btn-sm"
        style={{ marginTop: 14 }}
        onClick={save}
        disabled={pending || question.trim().length < 5}
      >
        {pending ? "Creating…" : "Create the room"}
      </button>
    </div>
  );
}

function Room({ leadId, decision, agentFirst }: { leadId: string; decision: Decision; agentFirst: string }) {
  const [addingOption, setAddingOption] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const status = statusOf(decision);
  const check = canRelease(decision);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "that did not work");
    });
  };

  return (
    <div>
      <div className="row gap-2 wrap" style={{ alignItems: "center", marginBottom: 8 }}>
        <span className={`chip t-2xs ${status === "decided" ? "chip-pos" : status === "open" ? "chip-brand" : "chip-warn"}`}>
          {status === "draft" ? "Not shared yet" : status === "open" ? "With them" : "Decided"}
        </span>
        {status === "draft" ? (
          <span className="t-2xs c-4">Only you can see this</span>
        ) : null}
      </div>

      {/* Literally what they see. */}
      <DecisionRoom decision={decision} agentFirst={agentFirst} />

      {/* Why it cannot go out yet. Shown against the room rather than on the
          button, because every one of these is a statement about the
          comparison itself. */}
      {!check.ok && status === "draft" ? (
        <div className="card p-4" style={{ marginTop: 8, borderColor: "var(--warn-line)", background: "var(--warn-wash)" }}>
          {check.blocks.map((b) => (
            <p key={b} className="t-sm c-2" style={{ lineHeight: 1.6 }}>{b}</p>
          ))}
        </div>
      ) : null}

      {check.warns.length && status !== "decided" ? (
        <div className="card p-4" style={{ marginTop: 8 }}>
          {check.warns.map((w) => (
            <p key={w} className="t-xs c-3" style={{ lineHeight: 1.6 }}>{w}</p>
          ))}
        </div>
      ) : null}

      <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-g btn-sm" onClick={() => setAddingOption((a) => !a)}>
          <Ico.plus size={12} />{addingOption ? "Cancel" : "Add an option"}
        </button>

        {status === "draft" ? (
          <button
            type="button"
            className="btn btn-p btn-sm"
            disabled={pending || !check.ok}
            onClick={() => run(() => releaseDecision(leadId, decision.id))}
          >
            <Ico.send size={12} />Share it with them
          </button>
        ) : null}

        {status === "open" ? (
          <>
            <button type="button" className="btn btn-s btn-sm" disabled={pending}
              onClick={() => setDeciding((d) => !d)}>
              <Ico.check size={12} />Record the decision
            </button>
            <button type="button" className="btn btn-g btn-sm" disabled={pending}
              onClick={() => run(() => withdrawDecision(leadId, decision.id))}>
              Take it back
            </button>
          </>
        ) : null}

        {status === "decided" ? (
          <button type="button" className="btn btn-g btn-sm" disabled={pending}
            onClick={() => run(() => reopenDecision(leadId, decision.id))}>
            Reopen
          </button>
        ) : null}

        {status === "draft" ? (
          <button type="button" className="btn btn-g btn-sm" disabled={pending}
            onClick={() => run(() => deleteDecision(leadId, decision.id))}>
            Delete
          </button>
        ) : null}
      </div>

      {error ? <p className="t-sm c-neg" style={{ marginTop: 8 }} role="alert">{error}</p> : null}

      {addingOption ? (
        <NewOption leadId={leadId} decisionId={decision.id} onDone={() => setAddingOption(false)} />
      ) : null}

      {deciding ? (
        <RecordOutcome leadId={leadId} decision={decision} onDone={() => setDeciding(false)} />
      ) : null}

      {/* Removing an option, only while nobody has decided from it. */}
      {status === "draft" && decision.options.length ? (
        <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
          {decision.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="chip"
              disabled={pending}
              onClick={() => run(() => dropDecisionOption(leadId, o.id))}
            >
              <Ico.x size={10} />Remove &ldquo;{o.label}&rdquo;
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewOption({ leadId, decisionId, onDone }: { leadId: string; decisionId: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [amountLabel, setAmountLabel] = useState("");
  const [upside, setUpside] = useState("");
  const [downside, setDownside] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const dollars = amount.trim() ? Number(amount.replace(/[^0-9.-]/g, "")) : null;
    start(async () => {
      const r = await addDecisionOption(leadId, {
        decisionId,
        label,
        detail: detail || null,
        /* Cents, converted once and here. Money as a float anywhere in this
           product is a rounding error somebody reads off a screen. */
        amountCents: dollars !== null && Number.isFinite(dollars) ? Math.round(dollars * 100) : null,
        amountLabel: amountLabel || null,
        upside: upside || null,
        downside: downside || null,
      });
      if (!r.ok) setError(r.error);
      else onDone();
    });
  };

  return (
    <div className="card p-4" style={{ marginTop: 10 }}>
      <label className="col gap-1">
        <span className="t-2xs c-4 w6">This option, in a few words</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
      </label>

      <label className="col gap-1" style={{ marginTop: 12 }}>
        <span className="t-2xs c-4 w6">What it means — optional</span>
        <textarea className="input" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </label>

      <div className="row wrap gap-3" style={{ marginTop: 12 }}>
        <label className="col gap-1" style={{ maxWidth: 180 }}>
          <span className="t-2xs c-4 w6">The figure — optional</span>
          <input className="input" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="412300" />
        </label>
        <label className="col gap-1" style={{ maxWidth: 240 }}>
          <span className="t-2xs c-4 w6">What that figure is</span>
          <input className="input" value={amountLabel}
            onChange={(e) => setAmountLabel(e.target.value)} placeholder="would reach you" />
          <span className="t-2xs c-4">Required if there is a figure, and the same on every option.</span>
        </label>
      </div>

      <div className="row wrap gap-3" style={{ marginTop: 12 }}>
        <label className="col gap-1 grow">
          <span className="t-2xs c-4 w6">What is good about it</span>
          <input className="input" value={upside} onChange={(e) => setUpside(e.target.value)} />
        </label>
        <label className="col gap-1 grow">
          <span className="t-2xs c-4 w6">And what is not</span>
          <input className="input" value={downside} onChange={(e) => setDownside(e.target.value)} />
        </label>
      </div>
      <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.55, maxWidth: 520 }}>
        Both or neither. An option with an upside and no trade-off is a recommendation, and a
        room full of them is not a comparison.
      </p>

      {error ? <p className="t-sm c-neg" style={{ marginTop: 10 }} role="alert">{error}</p> : null}

      <button type="button" className="btn btn-p btn-sm" style={{ marginTop: 14 }}
        onClick={save} disabled={pending || !label.trim()}>
        {pending ? "Adding…" : "Add it"}
      </button>
    </div>
  );
}

function RecordOutcome({ leadId, decision, onDone }: { leadId: string; decision: Decision; onDone: () => void }) {
  const [pick, setPick] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const r = await decide(leadId, decision.id, pick, note || undefined);
      if (!r.ok) setError(r.error);
      else onDone();
    });
  };

  return (
    <div className="card p-4" style={{ marginTop: 10 }}>
      <div className="t-xs c-3 w6">Which did they choose?</div>
      <div className="row wrap gap-2" style={{ marginTop: 8 }}>
        {decision.options.map((o) => (
          <button key={o.id} type="button" className={`chip ${pick === o.id ? "chip-pos" : ""}`}
            aria-pressed={pick === o.id} onClick={() => setPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      <label className="col gap-1" style={{ marginTop: 12 }}>
        <span className="t-2xs c-4 w6">Why — optional, and they will read it</span>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error ? <p className="t-sm c-neg" style={{ marginTop: 10 }} role="alert">{error}</p> : null}

      <button type="button" className="btn btn-p btn-sm" style={{ marginTop: 12 }}
        onClick={save} disabled={pending || !pick}>
        {pending ? "Recording…" : "Record it"}
      </button>
    </div>
  );
}
