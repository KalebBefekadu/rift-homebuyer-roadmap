"use client";

import { useState } from "react";
import { money } from "@/lib/core/compute";
import {
  INTEREST_LABEL, LISTING_LABEL, SHOWING_LABEL, checklist, listingLine, listingStatus, showingCounts,
  type Interest, type ListingEvent, type ListingKind, type Review, type Showing,
} from "@/lib/core/listing";
import { useWrite } from "./useWrite";
import { georgiaDay, showTime } from "@/lib/core/day";
import { newRequestId } from "@/lib/core/ids";
import { typedNumber } from "@/lib/core/typed";

const WHEN = (iso: string) => showTime(iso, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const DAY = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const today = () => georgiaDay();

/**
 * Listing and launch, showings and weekly reviews (S06 to S09). Every entry
 * is the agent's record of what happened; the page never publishes
 * anything, and access details are never written here.
 */
export function SellerListing({ journeyId, events, showings, reviews }: { journeyId: string; events: ListingEvent[]; showings: Showing[]; reviews: Review[] }) {
  const { busy, error, setError, write } = useWrite(`${events.length}:${showings.map((s) => s.history.length).join(",")}:${reviews.length}`);
  const [kind, setKind] = useState<ListingKind>("photos");
  const [form, setForm] = useState<null | "event" | "showing" | "review">(null);
  const [step, setStep] = useState<Showing | null>(null);
  const [decision, setDecision] = useState<"keep" | "change" | "undecided">("keep");
  const status = listingStatus(events);
  const counts = showingCounts(showings);
  const req = () => newRequestId();

  const done = (r: { ok: boolean }) => { if (r.ok) { setForm(null); setStep(null); } };
  const fd = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); return new FormData(e.currentTarget); };
  const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

  return (
    <div className="col gap-4">
      <p className="t-sm w6">{listingLine(events, showings)}</p>

      <section aria-labelledby="launch-h">
        <h3 id="launch-h" className="t-sm w6">Launch checklist</h3>
        <ul style={{ marginTop: 4 }}>
          {checklist(events).map((c) => (
            <li key={c.kind} className="desk-row t-sm">
              <span className={c.done ? "c-pos" : "c-4"}>{c.done ? "✓" : "○"}</span> {c.label}
              {c.done ? <span className="t-xs c-4"> · {c.done.detail}, {DAY(c.done.at)}</span> : <span className="t-xs c-4"> · not done</span>}
            </li>
          ))}
          <li className="desk-row t-sm">
            <span className={status.status === "live" ? "c-pos" : "c-4"}>{status.status === "live" ? "✓" : "○"}</span> Live on the MLS
            {status.live?.url ? <> · <a className="u t-xs" href={status.live.url} target="_blank" rel="noreferrer">the listing</a></> : null}
            {status.status === "live" && !status.syndicated ? <span className="t-xs c-4"> · other sites not confirmed yet (a delay, not a failure)</span> : null}
            {status.status === "withdrawn" ? <span className="t-xs c-warn"> · withdrawn</span> : null}
          </li>
        </ul>
        {form === "event" ? (
          <form className="desk-form" onSubmit={async (e) => {
            const f = fd(e);
            const price = typedNumber(f.get("price"));
            if (Number.isNaN(price)) { setError("The price is not a number of dollars"); return; }
            done(await write("listing", { journeyId, kind, detail: s(f, "detail"), url: s(f, "url") || null, price, requestId: req() }));
          }}>
            <label>What happened
              <select className="select input-sm" value={kind} onChange={(e) => setKind(e.target.value as ListingKind)}>
                {(Object.keys(LISTING_LABEL) as ListingKind[]).map((k) => <option key={k} value={k}>{LISTING_LABEL[k]}</option>)}
              </select></label>
            <label style={{ flex: "2 1 220px" }}>Detail
              <input className="input input-sm" name="detail" required minLength={3} maxLength={300}
                placeholder={kind === "access" ? "ShowingTime set up; lockbox on the back door (never the code)" : "Photos by Peach Media, 24 images"} /></label>
            {kind === "mls-live" || kind === "syndicated" || kind === "relisted" ? <label style={{ flex: "2 1 220px" }}>Link<input className="input input-sm" name="url" type="url" required={kind === "mls-live"} placeholder="https://" /></label> : null}
            {kind === "price-change" ? <label>New price<input className="input input-sm" name="price" required inputMode="numeric" /></label> : null}
            <button className="btn btn-p btn-sm" disabled={busy}>Record</button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setForm(null)}>Cancel</button>
          </form>
        ) : <button type="button" className="u t-xs" style={{ marginTop: 6 }} onClick={() => { setError(null); setForm("event"); }}>Record something done on the listing</button>}
      </section>

      <section aria-labelledby="showings-h">
        <h3 id="showings-h" className="t-sm w6">Showings</h3>
        <p className="t-xs c-3" style={{ marginTop: 2 }}>{counts.line}</p>
        {showings.length ? (
          <ul style={{ marginTop: 4 }}>
            {showings.map((x) => (
              <li key={x.key} className="desk-row t-sm">
                <span className="w6">{WHEN(x.startsAt)}</span> · {SHOWING_LABEL[x.state]}{x.showingAgent ? ` · ${x.showingAgent}` : ""}
                {x.feedback ? <div className="desk-meta">Feedback: {x.feedback}{x.interest ? ` (${INTEREST_LABEL[x.interest].toLowerCase()})` : ""}</div>
                  : x.state === "done" ? <div className="desk-meta">No feedback given.</div> : null}
                {x.state !== "cancelled" && !(x.state === "done" && x.feedback) ? (
                  <button type="button" className="u t-xs" onClick={() => { setError(null); setStep(x); setForm("showing"); }}>Update</button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {form === "showing" ? (
          <form className="desk-form" onSubmit={async (e) => {
            const f = fd(e);
            const at = s(f, "startsAt");
            done(await write("showing", {
              journeyId, key: step?.key ?? null, startsAt: at ? new Date(at).toISOString() : step?.startsAt ?? "", state: s(f, "state"),
              showingAgent: s(f, "showingAgent") || null, feedback: s(f, "feedback") || null, interest: s(f, "interest") || null, requestId: req(),
            }));
          }}>
            {!step ? <label>When<input className="input input-sm" name="startsAt" type="datetime-local" required /></label> : <span className="t-xs">{WHEN(step.startsAt)}</span>}
            <label>Now
              <select className="select input-sm" name="state" defaultValue={step ? (step.state === "requested" ? "confirmed" : "done") : "requested"}>
                {(Object.keys(SHOWING_LABEL) as (keyof typeof SHOWING_LABEL)[]).map((k) => <option key={k} value={k}>{SHOWING_LABEL[k]}</option>)}
              </select></label>
            {!step ? <label>Showing agent<input className="input input-sm" name="showingAgent" maxLength={160} placeholder="Name, brokerage" /></label> : null}
            <label style={{ flex: "2 1 220px" }}>Feedback, if they gave any<input className="input input-sm" name="feedback" maxLength={1000} /></label>
            <label>Interest they said
              <select className="select input-sm" name="interest" defaultValue="">
                <option value="">Not said</option>{(Object.keys(INTEREST_LABEL) as Interest[]).map((k) => <option key={k} value={k}>{INTEREST_LABEL[k]}</option>)}
              </select></label>
            <button className="btn btn-p btn-sm" disabled={busy}>Record</button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => { setForm(null); setStep(null); }}>Cancel</button>
          </form>
        ) : <button type="button" className="u t-xs" style={{ marginTop: 6 }} onClick={() => { setError(null); setStep(null); setForm("showing"); }}>Add a showing</button>}
      </section>

      <section aria-labelledby="reviews-h">
        <h3 id="reviews-h" className="t-sm w6">Weekly reviews</h3>
        {reviews.length ? (
          <ul style={{ marginTop: 4 }}>
            {[...reviews].reverse().map((r) => (
              <li key={r.at} className="desk-row t-sm">
                <span className="w6">Week of {DAY(r.weekOf)}</span> · {r.decision === "keep" ? "Keep the strategy" : r.decision === "change" ? `Change: ${r.decisionNote}` : "Not decided yet"}
                <div className="desk-meta">{r.summary}{r.metrics ? ` Figures: ${r.metrics}.` : ""}</div>
              </li>
            ))}
          </ul>
        ) : <p className="t-xs c-4" style={{ marginTop: 2 }}>None yet.</p>}
        {form === "review" ? (
          <form className="desk-form" onSubmit={async (e) => {
            const f = fd(e);
            done(await write("review", { journeyId, weekOf: s(f, "weekOf"), metrics: s(f, "metrics") || null, summary: s(f, "summary"), decision, decisionNote: s(f, "decisionNote") || null, requestId: req() }));
          }}>
            <label>Week of<input className="input input-sm" name="weekOf" type="date" required max={today()} defaultValue={today()} /></label>
            <label style={{ flex: "2 1 220px" }}>Figures you read, and where<input className="input input-sm" name="metrics" maxLength={1000} placeholder="FMLS: 412 views, 9 saves" /></label>
            <label style={{ flex: "3 1 280px" }}>The account for the seller<input className="input input-sm" name="summary" required minLength={10} maxLength={1500} placeholder={`${counts.done} showings; what the feedback said`} /></label>
            <label>They decided
              <select className="select input-sm" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                <option value="keep">Keep the strategy</option><option value="change">Change it</option><option value="undecided">Not yet</option>
              </select></label>
            {decision === "change" ? <label style={{ flex: "2 1 200px" }}>What changes<input className="input input-sm" name="decisionNote" required maxLength={500} placeholder="New photos; price to $415,000" /></label> : null}
            <button className="btn btn-p btn-sm" disabled={busy}>Record</button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setForm(null)}>Cancel</button>
          </form>
        ) : <button type="button" className="u t-xs" style={{ marginTop: 6 }} onClick={() => { setError(null); setForm("review"); }}>Write this week&apos;s review</button>}
      </section>

      {status.price ? <p className="t-xs c-4">Current list price after changes: {money(status.price)}.</p> : null}
      {error ? <p role="alert" className="t-xs c-neg">{error}</p> : null}
    </div>
  );
}
