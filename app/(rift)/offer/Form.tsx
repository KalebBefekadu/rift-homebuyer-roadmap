"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import {
  readSubmission, read, ASSUMED_COMMISSION_PCT,
  MIN_COMMISSION_PCT, MAX_COMMISSION_PCT,
} from "@/lib/core/offer-intake";
import { sessionId } from "@/lib/rift/session";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const FINANCING = [
  ["conventional", "Conventional"], ["cash", "Cash"], ["fha", "FHA"],
  ["va", "VA"], ["usda", "USDA"], ["other", "Other"],
] as const;

const CONTINGENCIES = ["Inspection", "Appraisal", "Financing", "Sale of buyer's home", "Survey"];

/**
 * The value comes first, and it comes from arithmetic in this browser.
 *
 * Nothing is sent to compute the reading. The moment there is an address and a
 * price the page can already say what the offer is worth to a seller, and it
 * keeps saying it whether or not the submitter ever presses send, which is
 * the product's central bargain, applied to the one funnel that did not have
 * a front end at all.
 */
export function Form() {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [concessions, setConcessions] = useState("");
  const [repairCredit, setRepairCredit] = useState("");
  const [earnest, setEarnest] = useState("");
  const [financing, setFinancing] = useState<string>("conventional");
  const [closeOn, setCloseOn] = useState("");
  const [contingencies, setContingencies] = useState<string[]>(["Inspection", "Appraisal"]);
  const [preapproval, setPreapproval] = useState(false);
  const [proofOfFunds, setProofOfFunds] = useState(false);
  const [commissionPct, setCommissionPct] = useState(ASSUMED_COMMISSION_PCT);

  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firm, setFirm] = useState("");
  const [note, setNote] = useState("");
  const [representing, setRepresenting] = useState<"self" | "buyer">("buyer");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /* Distinguished from "you left the address blank": one is theirs to fix and
     one is ours, and only ours warrants sending them somewhere else. */
  const [failedToSend, setFailedToSend] = useState(false);

  const num = (v: string) => {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  /* Read against the real parser, so the page cannot show a figure the
     endpoint would reject: the two used to be a validation function and a
     form that agreed by coincidence. */
  const draft = useMemo(() => ({
    address: address || "placeholder address",
    price: num(price), concessions: num(concessions), repairCredit: num(repairCredit),
    earnest: num(earnest), financing, closeOn, contingencies,
    preapproval, proofOfFunds,
    from: from || "Someone", email: email || "someone@example.com",
    phone, firm, note, representing,
  }), [address, price, concessions, repairCredit, earnest, financing, closeOn,
       contingencies, preapproval, proofOfFunds, from, email, phone, firm, note, representing]);

  const parsed = readSubmission(draft);
  const reading = parsed.ok && num(price) > 0 ? read(parsed.value, commissionPct) : null;

  const toggle = (c: string) =>
    setContingencies((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const send = async () => {
    const real = readSubmission({ ...draft, address, from, email });
    if (!real.ok) { setErrors(real.errors); setFailedToSend(false); return; }
    setErrors([]);
    setFailedToSend(false);
    setSending(true);
    try {
      const res = await fetch("/api/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...real.value, sessionId: sessionId() }),
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) setSent(true);
      else { setErrors([j?.error ?? "That did not get through."]); setFailedToSend(true); }
    } catch {
      setErrors(["That did not get through."]);
      setFailedToSend(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/" className="row gap-2">
            <Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <Link href="/sell" className="t-sm c-3 hide-sm">Selling instead?</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          Submit an offer on any Georgia address
        </h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: 620 }}>
          And see what it is actually worth to the seller before you send it. No account,
          nothing to install, and the arithmetic is yours whether or not you press send.
        </p>

        <section className="card p-5" style={{ marginTop: 24 }}>
          <div className="t-sm w6">The offer</div>

          <label className="field" style={{ marginTop: 14 }}>
            <span className="label">Property address</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="119 Peachtree Way, Atlanta, GA 30309" />
          </label>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Offer price</span>
              <input className="input" inputMode="numeric" value={price}
                onChange={(e) => setPrice(e.target.value)} placeholder="410,000" />
            </label>
            <label className="field">
              <span className="label">Earnest money</span>
              <input className="input" inputMode="numeric" value={earnest}
                onChange={(e) => setEarnest(e.target.value)} placeholder="5,000" />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Seller concessions asked</span>
              <input className="input" inputMode="numeric" value={concessions}
                onChange={(e) => setConcessions(e.target.value)} placeholder="0" />
            </label>
            <label className="field">
              <span className="label">Repair credit asked</span>
              <input className="input" inputMode="numeric" value={repairCredit}
                onChange={(e) => setRepairCredit(e.target.value)} placeholder="0" />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Financing</span>
              <select className="input" value={financing} onChange={(e) => setFinancing(e.target.value)}>
                {FINANCING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Target closing date</span>
              <input className="input" type="date" value={closeOn} onChange={(e) => setCloseOn(e.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="label">Contingencies</span>
            <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
              {CONTINGENCIES.map((c) => (
                <button key={c} type="button" className={`chip ${contingencies.includes(c) ? "chip-brand" : ""}`}
                  aria-pressed={contingencies.includes(c)} onClick={() => toggle(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="row gap-3 wrap" style={{ marginTop: 14 }}>
            <label className="row gap-2 t-sm">
              <input type="checkbox" checked={preapproval} onChange={(e) => setPreapproval(e.target.checked)} />
              Preapproval letter attached
            </label>
            <label className="row gap-2 t-sm">
              <input type="checkbox" checked={proofOfFunds} onChange={(e) => setProofOfFunds(e.target.checked)} />
              Proof of funds attached
            </label>
          </div>
        </section>

        {/* The value, given before anything is asked for. */}
        {reading ? (
          <section className="card p-5" style={{ marginTop: 16, background: "var(--sunk)" }}>
            <div className="t-sm w6">What this is worth to the seller</div>

            {reading.askedBack > 0 ? (
              <>
                <p className="t-sm c-2" style={{ marginTop: 10, lineHeight: 1.65 }}>
                  A dollar asked back is not a dollar off the price. Commission and transfer tax
                  are charged on the headline, so the seller loses the {money(reading.askedBack)}{" "}
                  you are asking for in full, while a price cut costs them only what is left
                  after those percentages come off it.
                </p>
                <div className="card p-4" style={{ marginTop: 12, background: "var(--paper)" }}>
                  <div className="between wrap gap-2">
                    <span className="t-sm">Your offer, as the seller sees it</span>
                    <span className="num t-lg">{money(reading.equivalentCleanPrice)}</span>
                  </div>
                  <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>
                    A clean offer at {money(reading.equivalentCleanPrice)}, nothing asked back,
                    leaves them exactly where yours does. Your headline overstates it by{" "}
                    <strong>{money(reading.headlineOverstatesBy)}</strong>, and every dollar you
                    ask back costs you <strong>${reading.costPerDollarBack.toFixed(2)}</strong> of
                    price.
                  </p>
                </div>
              </>
            ) : (
              <p className="t-sm c-2" style={{ marginTop: 10, lineHeight: 1.65 }}>
                Nothing is being asked back, so the headline is the headline: at{" "}
                {money(reading.equivalentCleanPrice)} there is no gap between what your offer
                says and what it is worth to them. That is worth more than it sounds: most
                offers at this price do have a gap.
              </p>
            )}

            {/* The assumption, visible and adjustable, because it is the
                seller's private arrangement and this product does not know it. */}
            <div className="row gap-2 wrap" style={{ marginTop: 14, alignItems: "center" }}>
              <span className="t-xs c-3">Assuming the seller pays</span>
              <input className="input" style={{ width: 72 }} inputMode="decimal"
                aria-label="Assumed seller commission, percent"
                value={String(commissionPct)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                  setCommissionPct(Number.isFinite(n) ? Math.min(MAX_COMMISSION_PCT, Math.max(MIN_COMMISSION_PCT, n)) : 0);
                }} />
              <span className="t-xs c-3">% commission. We do not know their arrangement, so change it.</span>
            </div>

            {reading.gaps.length ? (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
                <div className="t-xs w6">Not attached yet</div>
                <ul className="t-xs c-3" style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.6 }}>
                  {reading.gaps.map((g) => <li key={g}>{g}</li>)}
                </ul>
                {/* Facts, never a verdict. This product does not take a side in
                    somebody else's negotiation. */}
                <p className="t-2xs c-4" style={{ marginTop: 6 }}>
                  Stated as fact, not as a judgement about your offer.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="card p-5" style={{ marginTop: 16 }}>
          <div className="t-sm w6">Send it to Kaleb</div>
          <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            Optional. The arithmetic above is yours either way.
          </p>

          <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
            {([["buyer", "I represent the buyer"], ["self", "I am the buyer"]] as const).map(([v, l]) => (
              <button key={v} type="button" className={`btn btn-sm ${representing === v ? "btn-p" : "btn-g"}`}
                aria-pressed={representing === v} onClick={() => setRepresenting(v)}>{l}</button>
            ))}
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Your name</span>
              <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Phone <span className="c-4">(optional)</span></span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Brokerage <span className="c-4">(optional)</span></span>
              <input className="input" value={firm} onChange={(e) => setFirm(e.target.value)} />
            </label>
          </div>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Anything else <span className="c-4">(optional)</span></span>
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {/* Said before the button, not after. A phone number handed over to
              deliver an offer is not consent to be called about anything else,
              and nothing here stores one. */}
          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
            We keep the offer and your name and email so somebody can reply to it. A phone
            number is passed on with the offer and not stored for marketing.{" "}
            <Link href="/privacy" className="u">What we keep</Link>.
          </p>

          {errors.length ? (
            <div style={{ marginTop: 10 }}>
              <ul className="t-xs c-neg" style={{ paddingLeft: 16, lineHeight: 1.6 }}>
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
              {/* A dead end is not an honest failure, it is half of one.
                  Telling somebody to "send it to Kaleb directly" without
                  giving them a way to is the kind of message that reads as
                  helpful and leaves them exactly where they were. The booking
                  path does not depend on anything this one does. */}
              {failedToSend ? (
                <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
                  <p className="t-xs c-2" style={{ lineHeight: 1.6 }}>
                    Your terms are still on this page and the arithmetic above is still yours;
                    nothing was lost. The quickest way through is{" "}
                    <Link href="/book?v=offer" className="u">fifteen minutes with Kaleb</Link>,
                    which does not depend on whatever just failed here.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {sent ? (
            <div className="card p-4" style={{ marginTop: 12, background: "var(--pos-wash)", borderColor: "var(--pos-line)" }}>
              <div className="row gap-2">
                <Ico.check size={15} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
                <div className="t-sm c-2">
                  Sent. Kaleb has it, with the terms exactly as you entered them.
                </div>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-p" style={{ marginTop: 14 }}
              disabled={sending} onClick={send}>
              {sending ? "Sending…" : "Send this offer"}<Ico.arrowR size={14} />
            </button>
          )}
        </section>
      </main>
    </>
  );
}
