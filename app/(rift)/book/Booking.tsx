"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { LiveRegion } from "@/components/rift/Live";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { track, useTrack, flush } from "@/lib/rift/track";
import { translator, ETHIOPIC_STACK, isLocale } from "@/lib/core/i18n";
import { sessionId } from "@/lib/rift/session";

/* The confirmation replaces the button that was pressed, and a focused
   element that disappears drops focus to the top of the page. Stable, so it
   runs once when the message appears and never pulls focus back later. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

/* The server's refusals are lower-case fragments ("that email address does
   not look right"); on the page they are sentences. */
const sentence = (s: string) => {
  const t = s.trim();
  if (!t) return t;
  const up = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(up) ? up : `${up}.`;
};

/**
 * The consultation booking.
 *
 * Three things this screen does that a generic "book a call" form does not,
 * each of which came out of the specification rather than taste:
 *
 *   1. It names what the call is ABOUT: the computed blocker, carried in the
 *      URL from the readout. A generic slot asks somebody to decide what to
 *      talk about, which is work, and work at the moment of conversion.
 *   2. It is short. The 5 October review cut it to a heading, one line and
 *      the form; "what this call is not" went with it.
 *   3. The phone consent box is unticked, specific, separate from everything
 *      else, and blocks submission while a phone number is present. Consent
 *      bundled into a "by continuing you agree" line is not consent.
 *
 * Blueprint v5 §5.9 (Kaleb R2): the form is centred; the fields run name,
 * phone, email, then the time; the phone is required, because a call is what
 * is being booked; and the question is "What time works best for you?".
 */
export function Booking({ phoneConsent, emailNote, slots, source }: {
  phoneConsent: string;
  emailNote: string;
  slots: { start: string; label: string }[];
  source: "calendar" | "unconfigured" | "error";
}) {
  const q = useSearchParams();
  const topic = q.get("topic") ?? "your numbers";
  const v = q.get("v");
  const side = v === "sell" ? "sell" : "buy";
  /* Three visitors reach this page, and two of them arrived without a readout.
     Sending them "back" to one they never had is a link to a stranger's page. */
  const abroad = v === "abroad";
  /* Carried from the Amharic pages. The form stays English: see the note on
     book.band.* in lib/core/i18n.ts, but arriving from an Amharic page and
     being handed English with no explanation reads as the product giving up
     on you at the last step. */
  const langParam = q.get("lang");
  const am = isLocale(langParam) && langParam === "am";
  const t = translator(am ? "am" : "en");
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};
  const lang = am ? "?lang=am" : "";

  const backLabel = am ? t("book.back") : "Back";
  const backHref = abroad ? `/abroad${lang}` : side === "sell" ? "/sell" : "/buy";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [slot, setSlot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  /* Whether the calendar actually holds the slot. The server books only
     with an email address, and a calendar that fails after the request is
     stored is reported, not raised: either way the request reached Kaleb
     and the time did not, so the page must not say "Held". */
  const [held, setHeld] = useState(false);

  useTrack({ name: "booking_start", side, meta: { hasTopic: topic !== "your numbers" } });

  /* When there is no real availability we ask for a preference rather than
     offering invented times. A person choosing "whenever suits" and being
     called back is a slightly worse experience; a person choosing 6pm Thursday
     and finding it never existed is a broken promise. */
  const live = source === "calendar" && slots.length > 0;

  const blocked = Boolean(phone) && !consent;
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  /* Email is always required (manual review WS7.3). The calendar holds a time
     only for an address, and without a calendar it is where Kaleb confirms
     the time he offers. The server refuses a booking without one too. */
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = phoneOk && emailOk && (live ? Boolean(slot) : true) && !blocked;

  const submit = async () => {
    if (!ready || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: q.get("a") ?? "",
          sessionId: sessionId(),
          name, email, phone,
          phoneConsent: consent,
          lead: { side, timing: q.get("t") ?? "", completion: 1, source: "booking" },
          ...(live ? { slotStart: slot, topic } : {}),
        }),
      });
      const d = await res.json();
      /* A refusal without a reason is still a refusal: this fell through to
         "done" whenever the server said no without saying why. */
      if (!d.ok) {
        setState("error");
        setError(d.error ? sentence(String(d.error)) : "We could not save your request just now, so it has not reached Kaleb. Please try again in a minute.");
        return;
      }
      /* This rendered "done" over a request that stored nothing, so somebody
         who had just asked the agent for a call believed they had, and he never
         heard of it. Happened on every cold start. */
      if (d.stored === false) {
        setState("error");
        setError("We could not save your request just now, so it has not reached Kaleb. Please try again in a minute.");
        return;
      }
      track({ name: "booking_complete", side, meta: { live } });
      flush();
      setHeld(d.booking === "held");
      setState("done");
    } catch {
      setState("error");
      setError("We could not send your request, so it has not reached Kaleb. Check your connection and try again; what you typed is still here.");
    }
  };

  const slotLabel = slots.find((s) => s.start === slot)?.label ?? "your time";

  /* Inside the same header and footer as the form, so sending does not look
     like being dropped off the site. */
  if (state === "done") {
    return (
      <div className={side}>
        <SiteHeader side={abroad ? "abroad" : side} current="/book" />
        <main className="shell-w sec">
          <div className="card p-5" role="status" tabIndex={-1} ref={focusOnShow} style={{ maxWidth: 560, margin: "0 auto" }}>
            <div className="row gap-2">
              <Ico.checkCircle size={18} className="c-pos" />
              <span className="t-md w6">
                {live ? (held ? `Held: ${slotLabel}.` : `Asked for ${slotLabel}.`) : "Got it."}
              </span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>
              {live && !held ? "The time is not held in Kaleb's calendar yet. He" : "Kaleb"}{" "}
              {live ? "confirms" : "replies with a time"} by email or phone, usually within a few hours, and
              always the same day. If it stops working, say so and it moves; there is nothing to
              cancel and no deposit.
            </p>
            <Link href={backHref} className="btn btn-g" style={{ marginTop: 16 }}>
              <Ico.chevL size={14} /><span style={script}>{backLabel}</span>
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className={side}>
      <SiteHeader side={abroad ? "abroad" : side} current="/book" />

      <main className="shell-w sec" style={{ maxWidth: 600 }}>
        <Link href={backHref} className="row gap-1 t-sm c-3" style={{ marginBottom: 16, ...script }}>
          <Ico.chevL size={13} />{backLabel}
        </Link>
        {am ? (
          <div className="card p-4" style={{ marginBottom: 22, background: "var(--brand-wash)", borderColor: "var(--line-2)" }}>
            <div className="t-md w6" style={script}>{t("book.band.h")}</div>
            <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.85, ...script }}>
              {t("book.band.b")}
            </p>
          </div>
        ) : null}
        <h1 className="serif" style={{ fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 1.14, letterSpacing: "-0.02em" }}>
          {abroad ? "Fifteen minutes, at a time that works where you are" : `Twenty minutes about ${topic.toLowerCase()}`}
        </h1>
        {abroad ? (
          <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
            Times below are Atlanta time (Eastern). Tell us your city and Kaleb will work
            around it. He speaks English and Amharic.
          </p>
        ) : null}
        {/* Simpler (manual review WS7.1): the heading, one line, the form. */}
        <p className="lede" style={{ marginTop: 14 }}>
          One conversation about what stands between you and a move.
        </p>

        <div className="card p-5" style={{ marginTop: 20 }}>
          <label className="field">
            <span className="label">Your name</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Phone</span>
            <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0100" />
          </label>

          {/* The gate. Unticked, specific, separate, and it blocks the button.
              Only shown when there is a number for it to govern: an unticked
              box next to an empty field is noise that teaches people to ignore
              the box that matters. */}
          {phone ? (
            <label className="opt fade-in" data-on={consent} style={{ marginTop: 12, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} style={{ marginTop: 3 }} />
              <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{phoneConsent}</span>
            </label>
          ) : null}

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              required aria-describedby="book-email-note" />
            <span id="book-email-note" className="t-2xs c-4" style={{ marginTop: 5, display: "block", lineHeight: 1.5 }}>{emailNote}</span>
          </label>

          <div className="field" style={{ marginTop: 16 }}>
            <span className="label" id="book-time">What time works best for you?</span>
            {live ? (
              <>
                <div className="col gap-2" style={{ marginTop: 6 }}
                  role="radiogroup" aria-labelledby="book-time">
                  {slots.map((s) => (
                    <label key={s.start} className="opt" data-on={slot === s.start}>
                      <input type="radio" name="slot" checked={slot === s.start} onChange={() => setSlot(s.start)} />
                      <span className="t-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
                <p className="t-2xs c-4" style={{ marginTop: 8 }}>
                  Real openings in Kaleb&apos;s calendar. Taking one holds it, and the booking goes to your email.
                </p>
              </>
            ) : (
              <>
                <textarea
                  className="input"
                  aria-labelledby="book-time"
                  rows={2}
                  style={{ marginTop: 6, resize: "vertical" }}
                  placeholder="Evenings after 6, or weekends, whatever works"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                />
                {source === "error" ? (
                  <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
                    The calendar is not responding, so we are not going to show you times that might not exist. Tell us roughly when suits.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <LiveRegion kind="alert">
            {error ? (
              <p className="t-xs c-neg row gap-2" style={{ marginTop: 12 }}>
                <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
              </p>
            ) : null}
          </LiveRegion>

          <button className="btn btn-p" style={{ width: "100%", marginTop: 16 }} disabled={!ready || state === "sending"} onClick={submit}>
            {state === "sending" ? "Sending…" : !phoneOk ? "Add your phone number" : blocked ? "Tick the box so Kaleb can call you"
              : !emailOk ? "Add your email" : live && !slot ? "Choose a time" : live ? "Book this time" : "Ask for a call"}
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
