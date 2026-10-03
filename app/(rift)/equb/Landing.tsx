"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Tibeb } from "@/components/rift/art";
import { LiveRegion } from "@/components/rift/Live";
import { useTrack, useCaptureTouch, track, flush } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";
import { ETHIOPIC_STACK } from "@/lib/core/i18n";

/**
 * Bet Equb: a savings group that ends in a home.
 *
 * The working name comes from the brief and is a placeholder. The page makes
 * one promise (a group, a schedule, a professional holding the money) and is
 * careful never to make a second one. The outcome is written as a goal, not a
 * guarantee, and nothing here says "win", "draw" or "lottery".
 *
 * Three answers the brief left as blanks (how the order is decided, what
 * happens on a missed payment, exactly how funds are protected) are shown as
 * what they are: not final yet, and given in writing before anyone commits.
 * Bracketed notes to the author never reach a visitor, and a visitor is never
 * handed a made-up policy in their place.
 */

const AM: React.CSSProperties = { fontFamily: ETHIOPIC_STACK };

const STEPS: [string, string][] = [
  ["Join a group", "Families commit to a fixed monthly contribution for a fixed cycle."],
  ["Save together", "Contributions are made through the app and held by an independent, licensed professional. Every member can see every payment."],
  ["Get mortgage-ready", "While you save, we help you with credit, pre-approval, and down payment assistance programs you may qualify for."],
  ["Receive your down payment", "When your turn comes, your funds go directly to closing on your new home."],
  ["Move in", "Keep contributing until the cycle is complete so every family in your group gets home too."],
];

const WHY: [keyof typeof Ico, string, string][] = [
  ["users", "Built on tradition", "The Equb you know, with the same spirit of trust and community."],
  ["shield", "Protected by professionals", "Structured with attorneys, CPAs, and financial professionals. Funds are held independently, never by individual members."],
  ["search", "Fully transparent", "A shared dashboard shows every contribution and every payout, in real time."],
  ["home", "Your money goes straight to closing", "Funds are delivered to your closing attorney for your home purchase."],
  ["key", "Guided from start to finish", "Credit coaching, lender matching, down payment assistance, and home search, all in one place."],
  ["send", "English and Amharic", "Every document, every conversation, in the language you're most comfortable with."],
];

const FAQ: [string, string][] = [
  ["How is my money protected?", "Contributions are held by an independent licensed professional and paid directly to closing. The exact structure is being finalized with our attorney, and you will get it in writing, in full, before you commit anything."],
  ["How is the order decided?", "The method is not final yet. You will see it written out, and agree to it, before the group starts."],
  ["What if I miss a payment?", "The policy is not final yet. It will be in writing before you commit, so nobody learns the rule after they need it."],
  ["Do I need perfect credit?", "No. We help members build credit and get mortgage-ready during the cycle."],
  ["Can I use down payment assistance too?", "Yes. We help you find and combine programs you qualify for."],
];

/* Free text on purpose: these are choices a person makes about their own
   plan, and a dropdown that guesses the range wrong loses the lead. */
const TIMELINES = ["Within 6 months", "6 to 12 months", "1 to 2 years", "Just exploring"];

const sentence = (s: string) => {
  const t = s.trim();
  if (!t) return t;
  const up = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(up) ? up : `${up}.`;
};

const focusOnShow = (el: HTMLElement | null) => el?.focus();

export function Landing({ phoneConsent, emailNote }: { phoneConsent: string; emailNote: string }) {
  useCaptureTouch();
  /* The page, and nothing the visitor says on it. Household size, language
     and target price stay in the form and the lead; telemetry keeps question
     ids and timings only. */
  useTrack({ name: "landing_view", side: "buy", meta: { page: "equb" } });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [household, setHousehold] = useState("");
  const [lang, setLang] = useState<"English" | "አማርኛ">("English");
  const [price, setPrice] = useState("");
  const [timeline, setTimeline] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  /* A seat request is answered by phone or email; either will do, but the
     phone consent box gates the number exactly as it does on /book. */
  const reachable = emailOk || phoneOk;
  const blocked = Boolean(phone) && !consent;
  const ready = Boolean(name.trim()) && reachable && !blocked;

  const submit = async () => {
    if (!ready || state === "sending") return;
    setState("sending");
    setError("");
    try {
      /* The capture API has no columns for an Equb's answers, and adding them
         is a migration. They travel in the lead's `timing` line, which is
         stored with the lead and quoted verbatim in the agent's alert: so the
         agent sees them, and nothing here touches telemetry. */
      const detail = [
        "Equb seat",
        household && `household ${household}`,
        `language ${lang}`,
        price && `target ${price}`,
        timeline && `timeline ${timeline}`,
      ].filter(Boolean).join(" · ");
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId: "",
          sessionId: sessionId(),
          name, email: emailOk ? email : "", phone, phoneConsent: consent,
          lead: { side: "buy", timing: detail, completion: 1, source: "equb" },
        }),
      });
      const d = await res.json();
      if (!d.ok || d.stored === false) {
        setState("error");
        setError(d.ok === false && d.error
          ? sentence(String(d.error))
          : "We could not save your request just now, so it has not reached us. Please try again in a minute.");
        return;
      }
      track({ name: "booking_complete", side: "buy", meta: { live: false } });
      flush();
      setState("done");
    } catch {
      setState("error");
      setError("We could not send your request, so it has not reached us. Check your connection and try again; what you typed is still here.");
    }
  };

  return (
    <div className="buy">
      <header className="site-head">
        <div className="shell-w between site-head-in">
          <Link href="/equb" className="row gap-2" aria-label="Bet Equb">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Bet Equb</span>
            <span className="chip chip-brand hide-xs">Equb for a home</span>
          </Link>
          <nav className="row gap-4 site-nav" aria-label="Main">
            <a href="#how" className="hide-sm">How it works</a>
            <a href="#faq" className="hide-sm">FAQ</a>
            <a href="#reserve" className="btn btn-p btn-sm">Reserve My Seat</a>
          </nav>
        </div>
        <Tibeb className="c-brand" height={8} style={{ opacity: 0.5 }} />
      </header>

      <main>
        <section className="shell-w" style={{ paddingTop: "clamp(34px,5vw,64px)" }}>
          <div style={{ maxWidth: 720 }}>
            <h1 className="serif" style={{ fontSize: "clamp(32px,4.8vw,58px)", lineHeight: 1.06, letterSpacing: "-0.028em" }}>
              The Equb your family trusted, built to buy you a home.
            </h1>
            <p className="lede" style={{ marginTop: 16, maxWidth: 600 }}>
              Join a group of families saving together, each receiving a down payment on a set
              schedule, with attorneys, CPAs, lenders, and a licensed real estate agent guiding
              every step.
            </p>
            <p lang="am" className="t-md c-3" style={{ marginTop: 14, lineHeight: 1.85, ...AM }}>
              እቁብ ለቤት። በአንድነት እንቆጥባለን፣ በአንድነት ቤት እንገዛለን።
            </p>
            <a href="#reserve" className="btn btn-p" style={{ marginTop: 22 }}
              onClick={() => track({ name: "hero_answer", side: "buy", meta: { qid: "equb_cta", page: "equb" } })}>
              Reserve My Seat <Ico.arrowR size={15} />
            </a>
          </div>
        </section>

        <section className="shell-w sec">
          <div className="card p-5" style={{ maxWidth: 760, background: "var(--sunk)" }}>
            <div className="kicker c-brand">The problem</div>
            <p className="t-lg serif" style={{ marginTop: 10, lineHeight: 1.4 }}>
              Rent keeps going up. Saving a down payment alone can take 7 to 10 years, and many
              hardworking families have strong income but thin credit history. Banks see a file.
              We see a community.
            </p>
          </div>
        </section>

        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <div className="kicker c-brand">Our vision</div>
              <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,36px)", letterSpacing: "-0.02em", lineHeight: 1.14, marginTop: 12, maxWidth: 440 }}>
                Same trust. A clear path to a home.
              </h2>
            </div>
            <div>
              <p className="t-md c-2" style={{ lineHeight: 1.7 }}>
                Generations of Ethiopians built businesses, paid for weddings, and brought
                families across oceans through Equb. It worked because it was built on trust.
              </p>
              <p className="t-md c-2" style={{ marginTop: 12, lineHeight: 1.7 }}>
                Bet Equb takes that same tradition and gives it the structure of modern
                homebuying: a secure platform, professional oversight, and a clear path from
                renter to homeowner.
              </p>
              <p className="t-md w6" style={{ marginTop: 12, lineHeight: 1.6 }}>
                Our goal is simple: every member of every group walks away with the keys to
                their own home.
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="shell-w sec">
          <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em" }}>How it works</h2>
          <ol className="card" style={{ overflow: "hidden", marginTop: 22, listStyle: "none", padding: 0 }}>
            {STEPS.map(([t, b], i) => (
              <li key={t} className="row gap-3" style={{
                padding: "16px 20px", alignItems: "flex-start",
                borderBottom: i === STEPS.length - 1 ? undefined : "1px solid var(--line-3)",
              }}>
                <span className="chip chip-brand" style={{ flex: "none" }} aria-hidden>{i + 1}</span>
                <div>
                  <div className="t-md w6">{t}</div>
                  <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.6 }}>{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="shell-w sec">
          <div className="card p-5" style={{ maxWidth: 560 }}>
            <div className="kicker c-brand">Example group</div>
            <table className="t-md" style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Members", "24 families"],
                  ["Monthly contribution", "$2,000"],
                  ["Cycle", "24 months"],
                  ["Each member receives", "~$48,000 toward their home"],
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid var(--line-3)" }}>
                    <th scope="row" className="c-3 w5" style={{ textAlign: "left", padding: "9px 0", fontWeight: 500 }}>{k}</th>
                    <td className="w6" style={{ textAlign: "right", padding: "9px 0" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-xs c-4" style={{ marginTop: 12 }}>
              Example for illustration. Group sizes and amounts vary.
            </p>
          </div>
        </section>

        <section className="shell-w sec">
          <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em" }}>Why Bet Equb</h2>
          <div className="g3 gap-3" style={{ marginTop: 22 }}>
            {WHY.map(([ic, t, b]) => {
              const Icon = Ico[ic] ?? Ico.check;
              return (
                <div key={t} className="card p-4">
                  <Icon size={16} className="c-brand" />
                  <div className="t-md w6" style={{ marginTop: 8 }}>{t}</div>
                  <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6 }}>{b}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="shell-w sec">
          <div className="split-w">
            <div>
              <div className="kicker c-brand">Who it&apos;s for</div>
              <p className="t-lg serif" style={{ marginTop: 10, lineHeight: 1.4, maxWidth: 460 }}>
                Families who are ready to stop renting, have steady income, and want a
                disciplined, community-backed path to owning a home in metro Atlanta.
              </p>
            </div>
            <div>
              <div className="kicker c-brand">Meet the team</div>
              <p className="t-md c-2" style={{ marginTop: 10, lineHeight: 1.7 }}>
                A licensed Georgia real estate agent, raised in the Ethiopian community, working
                alongside attorneys, CPAs, and mortgage professionals.
              </p>
              <p className="t-sm c-3" style={{ marginTop: 10 }}>
                Members are free to work with our agent or bring their own.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="shell-w sec">
          <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", letterSpacing: "-0.02em" }}>Questions</h2>
          <div className="g2 gap-3" style={{ marginTop: 22 }}>
            {FAQ.map(([q, a]) => (
              <div key={q} className="card p-4">
                <div className="t-md w6">{q}</div>
                <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.65 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reserve" className="shell-w sec" style={{ scrollMarginTop: 70 }}>
          <div className="card" style={{ padding: "clamp(24px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h2 className="serif" style={{ fontSize: "clamp(24px,2.9vw,36px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Your home is closer than you think.
            </h2>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.66)", fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}>
              Groups are forming now. Reserve your seat and we&apos;ll contact you about the next
              information session.
            </p>
          </div>

          {state === "done" ? (
            <div className="card p-5" role="status" tabIndex={-1} ref={focusOnShow} style={{ maxWidth: 600, margin: "20px auto 0" }}>
              <div className="row gap-2">
                <Ico.checkCircle size={18} className="c-pos" />
                <span className="t-md w6">Got it. Your seat request is in.</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>
                A seat request is not a commitment and no money changes hands. We&apos;ll reach
                out about the next information session, in {lang === "English" ? "English" : "አማርኛ"}.
              </p>
            </div>
          ) : (
            <div className="card p-5" style={{ maxWidth: 600, margin: "20px auto 0" }}>
              <label className="field">
                <span className="label">Name</span>
                <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="label">Phone</span>
                <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0100" />
              </label>
              {phone ? (
                <label className="opt fade-in" data-on={consent} style={{ marginTop: 12, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} style={{ marginTop: 3 }} />
                  <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{phoneConsent}</span>
                </label>
              ) : null}
              <label className="field" style={{ marginTop: 12 }}>
                <span className="label">Email</span>
                <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                <span className="t-2xs c-4" style={{ marginTop: 5, display: "block", lineHeight: 1.5 }}>{emailNote}</span>
              </label>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="label">Household size</span>
                <input className="input" inputMode="numeric" value={household} onChange={(e) => setHousehold(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </label>
              <div className="field" style={{ marginTop: 12 }}>
                <span className="label" id="eq-lang">Preferred language</span>
                <div className="g2 gap-2" style={{ marginTop: 6 }} role="radiogroup" aria-labelledby="eq-lang">
                  {(["English", "አማርኛ"] as const).map((l) => (
                    <label key={l} className="opt" data-on={lang === l}>
                      <input type="radio" name="lang" checked={lang === l} onChange={() => setLang(l)} />
                      <span className="t-sm" style={l === "English" ? undefined : AM}>{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="label">Target home price</span>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d$,]/g, "").slice(0, 12))} placeholder="$350,000" />
              </label>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="label">Current timeline</span>
                <input className="input" list="eq-timelines" value={timeline} onChange={(e) => setTimeline(e.target.value.slice(0, 60))} placeholder="Within 6 months" />
                <datalist id="eq-timelines">{TIMELINES.map((x) => <option key={x} value={x} />)}</datalist>
              </label>

              <LiveRegion kind="alert">
                {error ? (
                  <p className="t-xs c-neg row gap-2" style={{ marginTop: 12 }}>
                    <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
                  </p>
                ) : null}
              </LiveRegion>

              <button className="btn btn-p" style={{ width: "100%", marginTop: 16 }} disabled={!ready || state === "sending"} onClick={submit}>
                {state === "sending" ? "Sending…" : !name.trim() ? "Add your name" : !reachable ? "Add a phone number or email"
                  : blocked ? "Tick the box so we can call you" : "Reserve My Seat"}
              </button>
              <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.5 }}>
                Reserving a seat is not a commitment, and nothing is charged.
              </p>
            </div>
          )}
        </section>

        <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 48 }}>
          <div className="shell-w" style={{ padding: "26px 0 60px" }}>
            <p className="t-xs c-4" style={{ maxWidth: 620, lineHeight: 1.6 }}>
              Bet Equb is a working name. The program is being structured with legal and tax
              professionals; the terms you receive in writing, not this page, govern. Examples
              are for illustration and are not a promise of any outcome.
            </p>
            <div className="row gap-4" style={{ marginTop: 14 }}>
              <Link href="/privacy" className="t-sm c-3">What we keep</Link>
              <Link href="/buy" className="t-sm c-3">Buying on your own</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
