"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ico, Mark } from "@/components/rift/icons";
import { Track } from "@/components/rift/Track";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { PHONE_CONSENT, EMAIL_NOTE, CONSENT_VERSION, recordConsent } from "@/lib/prototype/privacy";

/* Two working weeks of slots, deterministic so the prototype never drifts. */
const DAYS = [
  { d: "Mon", n: 8, m: "Sep", slots: ["8:00", "12:30"] },
  { d: "Tue", n: 9, m: "Sep", slots: ["8:00", "9:00", "6:30"] },
  { d: "Wed", n: 10, m: "Sep", slots: [] },
  { d: "Thu", n: 11, m: "Sep", slots: ["7:30", "12:00", "6:00", "7:00"] },
  { d: "Fri", n: 12, m: "Sep", slots: ["8:30", "1:00"] },
  { d: "Sat", n: 13, m: "Sep", slots: ["9:00", "10:00", "11:00"] },
];

function Book() {
  const q = useSearchParams();
  const v = q.get("v") === "sell" ? "sell" : "buy";
  const topic = q.get("topic") || "";
  const name = q.get("n") || "";

  const [day, setDay] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);

  const chosen = useMemo(() => DAYS.find((d) => d.n === day), [day]);

  useTrack({ name: "booking_start", side: v });

  const covers = useMemo(() => {
    const base = topic
      ? [topic]
      : v === "buy"
      ? ["Which assistance programs are actually worth applying for"]
      : ["Whether your payoff and timing actually work together"];
    return [
      ...base,
      v === "buy"
        ? "What a lender will say that we can't"
        : "What a buyer will pay more for, and what they won't notice",
      "What the next four weeks should look like",
    ];
  }, [topic, v]);

  if (done) {
    return (
      <div className={v} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="card p-6" style={{ maxWidth: 480 }}>
          <Ico.checkCircle size={26} className="c-pos" />
          <h1 className="serif" style={{ fontSize: 32, marginTop: 14, letterSpacing: "-0.024em", lineHeight: 1.1 }}>
            {chosen?.d} the {chosen?.n}th, {slot}.
          </h1>
          <p className="t-md c-2" style={{ marginTop: 12, lineHeight: 1.65 }}>
            Fifteen minutes. Kaleb calls you — you don&apos;t have to be anywhere. A calendar
            invite is on its way, and it has a cancel link in it that works right up until the
            minute before.
          </p>
          <div className="card p-4" style={{ marginTop: 18, background: "var(--sunk)" }}>
            <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>He&apos;ll already have</div>
            <div className="col gap-2" style={{ marginTop: 8 }}>
              {["Your figures, exactly as you saw them", "The one thing standing in your way", "Your question sheet"].map((x) => (
                <div key={x} className="row gap-2"><Ico.check size={13} className="c-pos" /><span className="t-sm">{x}</span></div>
              ))}
            </div>
          </div>
          <Link href={`/prototype/${v}/results`} className="btn btn-s" style={{ marginTop: 18, width: "100%" }}>
            Back to my numbers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={v} style={{ minHeight: "100vh" }}>
      <Track />
      <header className="between" style={{ padding: "15px clamp(16px,4vw,32px)", borderBottom: "1px solid var(--line-2)" }}>
        <Link href={`/prototype/${v}`} className="row gap-2">
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
        </Link>
        <Link href={`/prototype/${v}/results`} className="btn btn-g btn-sm">Back to my numbers</Link>
      </header>

      <div className="shell-w" style={{ paddingTop: "clamp(28px,4vw,56px)", paddingBottom: 80 }}>
        <div className="split-w">
          <div>
            <h1 className="serif" style={{ fontSize: "clamp(28px,3.8vw,44px)", lineHeight: 1.1, letterSpacing: "-0.025em", maxWidth: 520 }}>
              Fifteen minutes{name ? `, ${name}` : ""}. Pick one.
            </h1>
            <p className="lede" style={{ marginTop: 14, maxWidth: 440 }}>
              Kaleb calls you. Nothing to install, nothing to sign, and no listing presentation.
            </p>

            <div className="card" style={{ marginTop: 26, overflow: "hidden" }}>
              <div className="row railscroll" style={{ borderBottom: "1px solid var(--line-2)", gap: 2, padding: "8px" }}>
                {DAYS.map((d) => (
                  <button key={d.n} onClick={() => { setDay(d.n); setSlot(null); }} disabled={!d.slots.length}
                    className="col" style={{
                      minWidth: 62, padding: "9px 4px", borderRadius: 10, gap: 2, alignItems: "center",
                      background: day === d.n ? "var(--ink)" : "transparent",
                      color: day === d.n ? "#fff" : d.slots.length ? "var(--ink-2)" : "var(--ink-5)",
                      cursor: d.slots.length ? "pointer" : "not-allowed", border: 0,
                    }}>
                    <span className="t-2xs">{d.d}</span>
                    <span className="num" style={{ fontSize: 17 }}>{d.n}</span>
                    <span className="t-2xs" style={{ opacity: 0.7 }}>{d.slots.length || "—"}</span>
                  </button>
                ))}
              </div>

              <div style={{ padding: 16 }}>
                {!chosen ? (
                  <p className="t-sm c-4" style={{ padding: "18px 0", textAlign: "center" }}>
                    Pick a day. The number under each one is how many times he&apos;s free.
                  </p>
                ) : (
                  <>
                    <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>
                      {chosen.d} {chosen.n} {chosen.m}
                    </div>
                    <div className="row gap-2 wrap">
                      {chosen.slots.map((t) => (
                        <button key={t} onClick={() => setSlot(t)} className="btn btn-lg" style={{
                          minWidth: 92,
                          background: slot === t ? "var(--brand)" : "var(--paper)",
                          color: slot === t ? "#fff" : "var(--ink)",
                          border: `1px solid ${slot === t ? "var(--brand)" : "var(--line)"}`,
                        }}>{t}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {slot ? (
                <div className="fade-in" style={{ padding: 16, borderTop: "1px solid var(--line-2)", background: "var(--sunk)" }}>
                  <div className="g2 gap-3">
                    <label className="field">
                      <span className="label">Your name</span>
                      <input className="input" defaultValue={name} placeholder="First and last" />
                    </label>
                    <label className="field">
                      <span className="label">Where to reach you</span>
                      <input className="input" placeholder={phone ? "(404) 555-0142" : "you@example.com"} />
                    </label>
                  </div>
                  <button className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 8 }}
                    onClick={() => { setPhone(!phone); setConsent(false); }}>
                    {phone ? "Use email instead" : "I'd rather give a phone number"}
                  </button>

                  {/* Prior express written consent. Unticked, specific, separate
                      from every other agreement, and stored with its version. */}
                  {phone ? (
                    <label className="opt fade-in" data-on={consent} style={{ marginTop: 12, alignItems: "flex-start" }}>
                      <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} />
                      <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{PHONE_CONSENT}</span>
                    </label>
                  ) : (
                    <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.55 }}>{EMAIL_NOTE}</p>
                  )}

                  <button className="btn btn-brand btn-lg" style={{ width: "100%", marginTop: 14 }}
                    disabled={phone && !consent}
                    onClick={() => {
                      recordConsent(phone ? "phone" : "email");
                      track({ name: "booking_complete", side: v, meta: { slot: slot ?? "", consent: CONSENT_VERSION } });
                      setDone(true);
                    }}>
                    Book {chosen?.d} at {slot}
                  </button>
                  <p className="t-xs c-4" style={{ marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
                    {phone && !consent
                      ? "Tick the box above, or switch back to email — either works."
                      : "Cancel any time from the invite. No card, no agreement, no obligation."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="card p-5">
              <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>What he&apos;ll actually cover</div>
              <div className="col gap-3" style={{ marginTop: 12 }}>
                {covers.map((c) => (
                  <div key={c} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <Ico.check size={14} className="c-brand" style={{ marginTop: 3, flex: "none" }} />
                    <span className="t-sm" style={{ lineHeight: 1.55 }}>{c}</span>
                  </div>
                ))}
              </div>
              <div className="hr" style={{ margin: "20px 0" }} />
              <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>What it isn&apos;t</div>
              <div className="col gap-2" style={{ marginTop: 10 }}>
                {[
                  v === "buy" ? "A push toward a particular lender" : "A listing presentation",
                  "A commitment to work together",
                  "A conversation you have to prepare for",
                ].map((c) => (
                  <div key={c} className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <Ico.x size={13} className="c-4" style={{ marginTop: 3, flex: "none" }} />
                    <span className="t-sm c-3" style={{ lineHeight: 1.55 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5" style={{ marginTop: 12 }}>
              <p className="serif" style={{ fontSize: 17, lineHeight: 1.5, letterSpacing: "-0.01em" }}>
                &ldquo;He told me not to buy the first house I loved. He was right, and it cost him
                a commission that month.&rdquo;
              </p>
              <div className="t-xs c-4" style={{ marginTop: 10 }}>Priya R. · Bought in DeKalb, Dec 2025</div>
            </div>

            <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6 }}>
              Everything in your readout is yours whether or not you take this call, and it stays
              yours if you cancel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Book /></Suspense>;
}
