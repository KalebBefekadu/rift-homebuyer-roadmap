"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { ForgetMe } from "@/components/rift/Forget";
import { LiveRegion } from "@/components/rift/Live";
import { track } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";
import { ETHIOPIC_STACK, type Locale } from "@/lib/core/i18n";
import { PHONE_CONSENT } from "@/lib/core/privacy";

/**
 * The abroad readout, made durable, and deletable.
 *
 * This page could not produce a lead. Every other readout in the product can
 * send itself to somebody; this one offered a call and nothing else, so the
 * single funnel written for people who are not in the country was also the
 * only one with no floor under it. Somebody arrives from an Amharic search,
 * reads a complete honest answer, and leaves no trace either of them can use.
 *
 * It also had no delete control, on the page whose readers have the most
 * reason to ask what a U.S. company now holds about them.
 *
 * Blueprint v5 §5.4 (Kaleb R1): a phone number can be left too, under the
 * same rule as everywhere else: unticked, specific consent, and a number
 * without it is refused. The phone part is English on the Amharic page, and
 * says so, until a native speaker writes it; consent wording is the last
 * place a machine translation belongs.
 *
 * No share token and no snapshot, unlike the buyer readout. This page is pure
 * arithmetic on four URL parameters, so its own address IS the durable
 * document: there is nothing to freeze that the link does not already carry.
 */
export function Keep({
  locale, t, shareUrl, county, cashIn,
}: {
  locale: Locale;
  /* The dictionary is passed in rather than rebuilt: the server already chose
     the language and this component must not get a second opinion. */
  t: Record<string, string>;
  shareUrl: string;
  county: string;
  cashIn: number;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const blocked = Boolean(phone.trim()) && !consent;
  const [state, setState] = useState<"idle" | "working" | "sent" | "off" | "bad" | "err">("idle");

  const am = locale === "am";
  const script = am ? { fontFamily: ETHIOPIC_STACK } : {};
  const body = am ? { ...script, lineHeight: 1.85 } : {};

  const send = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setState("bad"); return; }
    if (blocked) return;
    setState("working");

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: value,
          ...(phone.trim() ? { phone: phone.trim(), phoneConsent: consent } : {}),
          lead: {
            side: "buy",
            /* Their own words are on the landing page, not here. Completion is
               1 because this readout is the end of that funnel, not a partial
               answer: and `source` is what tells Studio that a lead needs a
               conversation about ITINs and wire transfers rather than about
               Georgia Dream, which this person cannot use. */
            completion: 1,
            value: cashIn,
            source: "abroad",
            contactable: true,
          },
          sessionId: sessionId(),
          deliver: {
            /* Absolute. The server renders a relative path because that is
               what the page needs, and an <a href="/abroad/results?…"> in an
               email resolves against the mail client. */
            shareUrl: typeof window === "undefined" ? shareUrl : new URL(shareUrl, window.location.origin).toString(),
            county,
            /* The abroad figure IS cash to close: down payment plus closing
               costs, the whole of what has to arrive. It is named cashIn on
               this page because "closing" means something else to somebody
               wiring money from another country. */
            cashToClose: cashIn,
            gap: 0,
            monthsToClose: null,
          },
        }),
      }).then((x) => x.json());

      track({ name: "email_capture", side: "buy", meta: { delivered: res?.delivery === "sent" } });
      if (!res?.ok || res?.stored === false) { setState("err"); return; }
      /* Three outcomes, kept apart. "Saved but not sent" is the live state of
         this product until Brevo has a verified sender, and telling somebody
         their email is on its way when it is not is the one thing this page
         cannot afford to do. */
      setState(res.delivery === "sent" ? "sent" : "off");
    } catch {
      setState("err");
    }
  };

  const note =
    state === "sent" ? t["res.email.sent"]
      : state === "off" ? t["res.email.off"]
        : state === "bad" ? t["res.email.bad"]
          : state === "err" ? t["res.email.err"]
            : null;

  return (
    <section className="sec">
      <div className="split-w">
        <div className="card p-5">
          <div className="t-lg w6" style={{ ...script, lineHeight: am ? 1.5 : undefined }}>
            {t["res.email.h"]}
          </div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65, ...body }}>
            {t["res.email.body"]}
          </p>

          {/* Both regions stay in the page for as long as the form could fill
              them, so the outcome is read out: a region that arrives with its
              text already inside is often skipped. */}
          <LiveRegion>
            {state === "sent" || state === "off" ? (
              <div className="row-t gap-2" style={{ marginTop: 16 }}>
                <Ico.checkCircle size={14} className={state === "sent" ? "c-pos" : "c-4"} style={{ flex: "none", marginTop: 3 }} />
                <p className="t-sm c-3" style={{ lineHeight: 1.6, ...body }}>{note}</p>
              </div>
            ) : null}
          </LiveRegion>
          {state === "sent" || state === "off" ? null : (
            <>
              {/* Tied to their inputs by id. The labels sat beside the
                  boxes without naming them, so a screen reader announced
                  two unnamed text fields. */}
              <label htmlFor="keep-email" className="t-xs c-4" style={{ display: "block", marginTop: 16, ...script }}>
                {t["res.email.field"]}
              </label>
              <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                <input
                  id="keep-email"
                  className="input grow"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  style={{ minWidth: 200 }}
                  value={email}
                  aria-invalid={state === "bad"}
                  aria-describedby={note ? "keep-note" : undefined}
                  onChange={(e) => { setEmail(e.target.value); if (state === "bad") setState("idle"); }}
                  placeholder="you@example.com"
                />
                <button className="btn btn-p" onClick={send} disabled={state === "working" || blocked}>
                  <span style={script}>{t["res.email.cta"]}</span>
                  <Ico.arrowR size={14} />
                </button>
              </div>
              <div lang="en" style={{ marginTop: 14 }}>
                <label htmlFor="keep-phone" className="t-xs c-4" style={{ display: "block" }}>
                  Phone, with your country code (optional){am ? " · English only for now" : ""}
                </label>
                <input id="keep-phone" className="input" type="tel" autoComplete="tel" style={{ marginTop: 6, maxWidth: 280 }}
                  value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 91 234 5678" />
                {phone.trim() ? (
                  <label className="opt fade-in" data-on={consent} style={{ marginTop: 10, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} style={{ marginTop: 3 }} />
                    <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{PHONE_CONSENT}</span>
                  </label>
                ) : null}
                {blocked ? <p className="t-xs c-3" style={{ marginTop: 6 }}>Tick the box to include your phone number, or leave it empty.</p> : null}
              </div>
              <LiveRegion kind="alert" id="keep-note">
                {note ? (
                  <p className="t-xs c-neg row-t gap-2" style={{ marginTop: 8, lineHeight: 1.6, ...body }}>
                    <Ico.alert size={12} style={{ flex: "none", marginTop: 3 }} />{note}
                  </p>
                ) : null}
              </LiveRegion>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="t-lg w6" style={{ ...script, lineHeight: am ? 1.5 : undefined }}>
            {t["res.forget.h"]}
          </div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65, ...body }}>
            {t["res.forget.body"]}
          </p>
          <div style={{ marginTop: 14 }}>
            {/* Labels come from the same dictionary the rest of the page uses.
                An English button under an Amharic paragraph is the exact
                half-translated seam this page was built to remove. */}
            <ForgetMe
              side="buy"
              labels={{
                /* The heading and body are directly above this card. */
                blurb: null,
                cta: t["res.forget.cta"],
                working: t["res.forget.working"],
                done: t["res.forget.done"],
                partial: t["res.forget.partial"],
              }}
              style={body}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
