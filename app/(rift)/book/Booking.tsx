"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { track, useTrack, flush } from "@/lib/rift/track";

/**
 * The consultation booking.
 *
 * Three things this screen does that a generic "book a call" form does not,
 * each of which came out of the specification rather than taste:
 *
 *   1. It names what the call is ABOUT — the computed blocker, carried in the
 *      URL from the readout. A generic slot asks somebody to decide what to
 *      talk about, which is work, and work at the moment of conversion.
 *   2. It says what the call is NOT. The objection that stops most people is
 *      the fear of being sold to, and the only thing that answers it is saying
 *      so plainly before they ask.
 *   3. The phone consent box is unticked, specific, separate from everything
 *      else, and blocks submission while a phone number is present. Consent
 *      bundled into a "by continuing you agree" line is not consent.
 */
export function Booking({ phoneConsent, emailNote }: { phoneConsent: string; emailNote: string }) {
  const q = useSearchParams();
  const topic = q.get("topic") ?? "your numbers";
  const side = q.get("v") === "sell" ? "sell" : "buy";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [slot, setSlot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useTrack({ name: "booking_start", side, meta: { hasTopic: topic !== "your numbers" } });

  /* Placeholder times until the calendar integration lands in this phase's
     remaining work. They are labelled as indicative rather than presented as
     confirmed availability — offering a slot that may not exist is a promise
     the product cannot keep. */
  const slots = [
    "Tomorrow, 6:00pm", "Thursday, 12:30pm", "Thursday, 7:00pm", "Saturday, 10:00am",
  ];

  const blocked = Boolean(phone) && !consent;
  const ready = (email || phone) && slot && !blocked;

  const submit = async () => {
    if (!ready) return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: q.get("a") ?? "",
          name, email, phone,
          phoneConsent: consent,
          lead: { side, timing: q.get("t") ?? "", completion: 1, source: "booking" },
        }),
      });
      const d = await res.json();
      if (!d.ok && d.error) { setState("error"); setError(d.error); return; }
      track({ name: "booking_complete", side, meta: { slot: slots.indexOf(slot) } });
      flush();
      setState("done");
    } catch {
      setState("error");
      setError("Something went wrong on our side. Your readout is unaffected.");
    }
  };

  if (state === "done") {
    return (
      <main className={`shell-w sec ${side}`}>
        <div className="card p-5" style={{ maxWidth: 560 }}>
          <div className="row gap-2">
            <Ico.checkCircle size={18} className="c-pos" />
            <span className="t-md w6">Asked for {slot.toLowerCase()}.</span>
          </div>
          <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>
            Kaleb confirms by {email ? "email" : "phone"} — usually within a few hours, and
            always the same day. If that time stops working, say so and it moves; there is
            nothing to cancel and no deposit.
          </p>
          <Link href="/buy/results" className="btn btn-g" style={{ marginTop: 16 }}>
            <Ico.chevL size={14} />Back to my readout
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className={side}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/buy" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></Link>
          <Link href="/buy/results" className="t-xs c-3">Back to my readout</Link>
        </div>
      </header>

      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 1.14, letterSpacing: "-0.02em", maxWidth: 620 }}>
          Twenty minutes about {topic.toLowerCase()}
        </h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>
          Not a pitch, not a tour of houses, and not a credit check. One conversation about the
          thing standing between you and a date.
        </p>

        <div className="card p-4" style={{ marginTop: 20, maxWidth: 560, background: "var(--sunk)" }}>
          <div className="t-sm w6" style={{ marginBottom: 8 }}>What this call is not</div>
          <div className="col gap-1">
            {[
              "You are not committing to work with Kaleb, or to buy anything.",
              "Nobody runs your credit, and no lender is called on your behalf.",
              "If the answer is that you should wait a year, that is what you will be told.",
            ].map((t) => (
              <div key={t} className="row gap-2" style={{ alignItems: "flex-start" }}>
                <Ico.x size={11} className="c-4" style={{ flex: "none", marginTop: 4 }} />
                <span className="t-xs c-3" style={{ lineHeight: 1.55 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5" style={{ marginTop: 20, maxWidth: 560 }}>
          <div className="field">
            <span className="label">When suits you?</span>
            <div className="col gap-2" style={{ marginTop: 6 }}>
              {slots.map((s) => (
                <label key={s} className="opt" data-on={slot === s}>
                  <input type="radio" name="slot" checked={slot === s} onChange={() => setSlot(s)} />
                  <span className="t-sm">{s}</span>
                </label>
              ))}
            </div>
            <p className="t-2xs c-4" style={{ marginTop: 8 }}>
              Indicative times — Kaleb confirms the exact slot when he replies.
            </p>
          </div>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="label">Your name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </label>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <span className="t-2xs c-4" style={{ marginTop: 5, display: "block", lineHeight: 1.5 }}>{emailNote}</span>
          </label>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Phone <span className="c-4 w5">— optional</span></span>
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0100" />
          </label>

          {/* The gate. Unticked, specific, separate, and it blocks the button.
              Only shown when there is a number for it to govern — an unticked
              box next to an empty field is noise that teaches people to ignore
              the box that matters. */}
          {phone ? (
            <label className="opt fade-in" data-on={consent} style={{ marginTop: 12, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} style={{ marginTop: 3 }} />
              <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{phoneConsent}</span>
            </label>
          ) : null}

          {error ? (
            <p className="t-xs c-neg row gap-2" style={{ marginTop: 12 }}>
              <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
            </p>
          ) : null}

          <button className="btn btn-p" style={{ width: "100%", marginTop: 16 }} disabled={!ready || state === "sending"} onClick={submit}>
            {state === "sending" ? "Sending…" : blocked ? "Tick the box to use a phone number" : "Ask for this time"}
          </button>
          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.5 }}>
            Your readout stays yours either way, and works whether or not you book anything.
          </p>
        </div>
      </main>
    </div>
  );
}
