"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { ForgetMe } from "@/components/rift/Forget";
import { track } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";
import { ETHIOPIC_STACK, type Locale } from "@/lib/core/i18n";

/**
 * The abroad readout, made durable — and deletable.
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
 * No share token and no snapshot, unlike the buyer readout. This page is pure
 * arithmetic on four URL parameters, so its own address IS the durable
 * document — there is nothing to freeze that the link does not already carry.
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
  const [state, setState] = useState<"idle" | "working" | "sent" | "off" | "bad" | "err">("idle");

  const am = locale === "am";
  const script = am ? { fontFamily: ETHIOPIC_STACK } : {};
  const body = am ? { ...script, lineHeight: 1.85 } : {};

  const send = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setState("bad"); return; }
    setState("working");

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: value,
          lead: {
            side: "buy",
            /* Their own words are on the landing page, not here. Completion is
               1 because this readout is the end of that funnel, not a partial
               answer — and `source` is what tells Studio that a lead needs a
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

          {state === "sent" || state === "off" ? (
            <div className="row-t gap-2" style={{ marginTop: 16 }}>
              <Ico.checkCircle size={14} className={state === "sent" ? "c-pos" : "c-4"} style={{ flex: "none", marginTop: 3 }} />
              <p className="t-sm c-3" style={{ lineHeight: 1.6, ...body }}>{note}</p>
            </div>
          ) : (
            <>
              <label className="t-xs c-4" style={{ display: "block", marginTop: 16, ...script }}>
                {t["res.email.field"]}
              </label>
              <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                <input
                  className="input grow"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  style={{ minWidth: 200 }}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === "bad") setState("idle"); }}
                  placeholder="you@example.com"
                />
                <button className="btn btn-p" onClick={send} disabled={state === "working"}>
                  <span style={script}>{t["res.email.cta"]}</span>
                  <Ico.arrowR size={14} />
                </button>
              </div>
              {note ? (
                <p className="t-xs c-neg" style={{ marginTop: 8, lineHeight: 1.6, ...body }}>{note}</p>
              ) : null}
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
