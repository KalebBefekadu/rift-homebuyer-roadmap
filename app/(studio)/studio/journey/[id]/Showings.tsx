"use client";

import { useState } from "react";
import Link from "next/link";
import {
  OFFER_LABEL, TOUR_LABEL, slotLabel, zonedToUtc,
  type OfferInterest, type TourStatus, type TourStep, type TourView,
} from "@/lib/core/tour";
import { useWrite } from "./useWrite";

export interface ShowingView {
  id: string;
  address: string;
  requestedBy: string;
  availability: string | null;
  createdAt: string;
  steps: TourStep[];
  feedback: { who: string; offer: OfferInterest; reason: string | null; searchChange: string | null; at: string }[];
  view: TourView;
}

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const CHIP: Record<TourStatus, string> = {
  requested: "chip-warn", "awaiting-confirmation": "chip-warn", confirmed: "chip-pos",
  changed: "chip-warn", cancelled: "", completed: "",
};

/**
 * Showings, from the agent's side (journey contract B06).
 *
 * Every button records something that already happened in ShowingTime; none
 * of them books anything. "Confirmed" asks for the time ShowingTime gave,
 * because a request in somebody's calendar is not a confirmation (AT17). The
 * agreement is checked again at every step toward the showing, and a stop
 * that can no longer go ahead says so on its card (AT18).
 */
export function Showings({ journeyId, stops, homes, coverage, leadId, person, unavailable }: {
  journeyId: string;
  stops: ShowingView[];
  homes: { id: string; address: string }[];
  coverage: { covered: boolean; note: string };
  leadId: string;
  person: string;
  unavailable?: string;
}) {
  const { busy, error, write } = useWrite(stops.map((s) => `${s.id}:${s.steps.length}:${s.feedback.length}`).join("|"));
  const [req, setReq] = useState(newRequest);
  const [adding, setAdding] = useState(false);
  const [homeId, setHomeId] = useState("");
  const [availability, setAvailability] = useState("");
  const [showDone, setShowDone] = useState(false);

  if (unavailable) return <p className="t-xs c-warn">{unavailable}</p>;

  const run = async (op: string, body: Record<string, unknown>, after?: () => void) => {
    const r = await write(op, { journeyId, requestId: req, ...body });
    if (r.ok) { setReq(newRequest()); after?.(); }
  };

  const open = stops.filter((s) => s.view.status !== "cancelled" && s.view.status !== "completed");
  const done = stops.filter((s) => !open.includes(s));
  const awaitingAnswer = done.filter((s) => s.view.status === "completed" && s.feedback.length === 0);

  return (
    <div>
      {!coverage.covered ? (
        <div className="card p-3" style={{ background: "var(--sunk)" }}>
          <p className="t-xs c-warn" style={{ lineHeight: 1.6 }}>
            No showing can go ahead until {person}&apos;s buyer agreement is signed and in force. {coverage.note}{" "}
            <Link className="u" href={`/studio/lead/${leadId}`}>Update it on their record</Link>.
          </p>
        </div>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}

      {open.length === 0 && awaitingAnswer.length === 0 ? (
        <p className="t-xs c-4" style={{ marginTop: 8 }}>No showings in progress.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {[...open, ...awaitingAnswer].map((s) => (
            <Stop key={s.id} s={s} busy={busy} person={person} run={run} covered={coverage.covered} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {adding ? (
          <div className="card p-3" style={{ background: "var(--sunk)" }}>
            <div className="row gap-2 wrap">
              <label className="field" style={{ flex: "2 1 220px" }}>
                <span className="label">Home</span>
                <select className="input" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                  <option value="">Choose a home on the list</option>
                  {homes.map((h) => <option key={h.id} value={h.id}>{h.address}</option>)}
                </select>
              </label>
              <label className="field" style={{ flex: "2 1 220px" }}>
                <span className="label">When they could go (optional)</span>
                <input className="input" value={availability} maxLength={300} placeholder="Saturday afternoon, or weekdays after 5"
                  onChange={(e) => setAvailability(e.target.value)} />
              </label>
            </div>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <button className="btn btn-p btn-sm" disabled={busy || !homeId}
                onClick={() => run("tour-request", { homeId, availability }, () => { setAdding(false); setHomeId(""); setAvailability(""); })}>
                {busy ? "Recording…" : "Record the request"}
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
            <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
              This records that they want to see it. Ask for the time in ShowingTime; access and lockbox details stay there.
            </p>
          </div>
        ) : homes.length ? (
          <button className="btn btn-s btn-sm" onClick={() => setAdding(true)}>Record a showing request</button>
        ) : (
          <p className="t-2xs c-4">Add a home to the list first.</p>
        )}
      </div>

      {done.length > awaitingAnswer.length ? (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-g btn-sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} finished showings ({done.length - awaitingAnswer.length})
          </button>
          {showDone ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {done.filter((s) => !awaitingAnswer.includes(s)).map((s) => (
                <Stop key={s.id} s={s} busy={busy} person={person} run={run} covered={coverage.covered} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stop({ s, busy, person, run, covered }: {
  s: ShowingView;
  busy: boolean;
  person: string;
  /** Steps toward the showing need a signed agreement in force (AT18). */
  covered: boolean;
  run: (op: string, body: Record<string, unknown>, after?: () => void) => Promise<void>;
}) {
  const [form, setForm] = useState<null | "asked" | "time" | "cancel" | "answer">(null);
  const [ref, setRef] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState<OfferInterest>("maybe");
  const [reason, setReason] = useState("");
  const [change, setChange] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [history, setHistory] = useState(false);

  const status = s.view.status;
  const seq = s.steps.length ? s.steps[s.steps.length - 1]!.seq : 0;
  const step = (to: TourStatus, extra: Record<string, unknown> = {}) =>
    run("tour-step", { stopId: s.id, to, expectedSeq: seq, ...extra }, () => setForm(null));

  const timed = (to: "confirmed" | "changed") => {
    const startsAt = zonedToUtc(date, start), endsAt = zonedToUtc(date, end);
    if (!startsAt || !endsAt) { setLocal("Give the date and both times"); return; }
    setLocal(null);
    void step(to, { startsAt, endsAt, ref });
  };
  const timeLabel = status === "confirmed" ? "Record the new time" : "Record the confirmed time";

  return (
    <div className="card p-3">
      <div className="between gap-2 wrap">
        <div className="row gap-2 wrap">
          <span className="t-sm w6">{s.address}</span>
          <span className={`chip t-2xs ${CHIP[status]}`}>{TOUR_LABEL[status]}</span>
        </div>
        <span className="t-2xs c-4">Asked by {s.requestedBy}, {DAY(s.createdAt)}</span>
      </div>
      {s.view.slot ? (
        <p className="t-sm" style={{ marginTop: 6 }}>{slotLabel(s.view.slot.startsAt, s.view.slot.endsAt)}{status === "changed" ? " (proposed)" : ""}</p>
      ) : null}
      {s.availability ? <p className="t-xs c-3" style={{ marginTop: 4 }}>They could go: {s.availability}</p> : null}
      <p className={`t-xs ${s.view.blocked || s.view.overdue ? "c-warn" : "c-4"}`} style={{ marginTop: 6, lineHeight: 1.55 }}>
        {s.view.nextStep}
      </p>

      {s.feedback.map((f, i) => (
        <p key={i} className="t-xs" style={{ marginTop: 6, lineHeight: 1.55 }}>
          <span className="w6">{f.who}:</span> {OFFER_LABEL[f.offer]}{f.reason ? `. ${f.reason}` : ""}
          {f.searchChange ? <span className="c-3"> Search: {f.searchChange}</span> : null}
        </p>
      ))}

      {form === "asked" ? (
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
          <input className="input" style={{ flex: "1 1 200px" }} value={ref} maxLength={200} placeholder="ShowingTime reference (optional)"
            aria-label="ShowingTime reference" onChange={(e) => setRef(e.target.value)} />
          <button className="btn btn-p btn-sm" disabled={busy} onClick={() => step("awaiting-confirmation", { ref })}>
            {busy ? "Recording…" : "Record it"}
          </button>
          <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
        </div>
      ) : form === "time" ? (
        <div style={{ marginTop: 10 }}>
          <div className="row gap-2 wrap">
            <label className="field"><span className="label">Date</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field"><span className="label">Starts (Georgia time)</span>
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="field"><span className="label">Ends</span>
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          {local ? <p className="t-xs c-neg" style={{ marginTop: 6 }}>{local}</p> : null}
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-p btn-sm" disabled={busy} onClick={() => timed(status === "confirmed" ? "changed" : "confirmed")}>
              {busy ? "Recording…" : timeLabel}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
          </div>
          <p className="t-2xs c-4" style={{ marginTop: 6 }}>The time ShowingTime confirmed, not the one that was asked for.</p>
        </div>
      ) : form === "cancel" ? (
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
          <input className="input" style={{ flex: "1 1 220px" }} value={note} maxLength={500} placeholder="Why: sold, they changed their mind, seller declined"
            aria-label="Why it was cancelled" onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-p btn-sm" disabled={busy || !note.trim()} onClick={() => step("cancelled", { note })}>
            {busy ? "Recording…" : "Record the cancellation"}
          </button>
          <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
        </div>
      ) : form === "answer" ? (
        <div style={{ marginTop: 10 }}>
          <div className="row gap-2 wrap">
            <label className="field"><span className="label">Would they consider an offer?</span>
              <select className="input" value={offer} onChange={(e) => setOffer(e.target.value as OfferInterest)}>
                {(Object.keys(OFFER_LABEL) as OfferInterest[]).map((o) => <option key={o} value={o}>{OFFER_LABEL[o]}</option>)}
              </select></label>
            <label className="field" style={{ flex: "1 1 200px" }}><span className="label">Why (optional)</span>
              <input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
          </div>
          <label className="field" style={{ marginTop: 6 }}><span className="label">What should change in the search (optional)</span>
            <input className="input" value={change} maxLength={500} onChange={(e) => setChange(e.target.value)} /></label>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-p btn-sm" disabled={busy}
              onClick={() => run("tour-feedback", { stopId: s.id, offer, reason, searchChange: change, onBehalfOf: person }, () => setForm(null))}>
              {busy ? "Recording…" : `Record ${person}'s answer`}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
          </div>
          <p className="t-2xs c-4" style={{ marginTop: 6 }}>A search change here is a note for you. The brief changes only when you save a new revision.</p>
        </div>
      ) : (
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
          {status === "requested" ? (
            <button className="btn btn-s btn-sm" disabled={busy || !covered || Boolean(s.view.blocked)} onClick={() => setForm("asked")}>Asked in ShowingTime</button>
          ) : null}
          {status === "awaiting-confirmation" || status === "changed" ? (
            <button className="btn btn-s btn-sm" disabled={busy || !covered || Boolean(s.view.blocked)} onClick={() => setForm("time")}>
              {status === "changed" ? "Confirm the new time" : "Record the confirmed time"}
            </button>
          ) : null}
          {status === "confirmed" ? (
            <>
              <button className="btn btn-s btn-sm" disabled={busy} onClick={() => void step("completed")}>It happened</button>
              <button className="btn btn-g btn-sm" disabled={busy} onClick={() => setForm("time")}>The time changed</button>
            </>
          ) : null}
          {status === "completed" ? (
            <button className="btn btn-s btn-sm" disabled={busy} onClick={() => setForm("answer")}>Record their answer</button>
          ) : null}
          {status !== "cancelled" && status !== "completed" ? (
            <button className="btn btn-g btn-sm" disabled={busy} onClick={() => setForm("cancel")}>Cancel</button>
          ) : null}
          {s.steps.length > 1 ? (
            <button className="btn btn-g btn-sm" onClick={() => setHistory((v) => !v)}>{history ? "Hide" : "History"}</button>
          ) : null}
        </div>
      )}

      {history ? (
        <ol className="t-2xs c-3" style={{ marginTop: 8, display: "grid", gap: 2 }}>
          {s.steps.map((st) => (
            <li key={st.seq}>
              {DAY(st.at)}: {TOUR_LABEL[st.status]}
              {st.startsAt && st.endsAt ? `, ${slotLabel(st.startsAt, st.endsAt)}` : ""}
              {st.ref ? `, ref ${st.ref}` : ""}{st.note ? `, "${st.note}"` : ""} ({st.by})
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
