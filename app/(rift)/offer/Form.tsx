"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import type { Candidates, Field } from "@/lib/core/offer-extract";
import {
  readSubmission, read, ASSUMED_COMMISSION_PCT,
  MIN_COMMISSION_PCT, MAX_COMMISSION_PCT,
} from "@/lib/core/offer-intake";
import { sessionId } from "@/lib/rift/session";
import { money } from "@/lib/core/compute";
import { typedNumber } from "@/lib/core/typed";


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
 *
 * Blueprint v5 §5.9 (Kaleb R2): it starts with the PDF. Rift reads it and
 * fills the boxes, each marked with the page it came from until the sender
 * changes or confirms it; a read that is off, over its limit or failed says
 * so and leaves the boxes to fill by hand. Sending is the point of the page,
 * so who is sending and a phone number are required.
 */
export function Form() {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [concessions, setConcessions] = useState("");
  const [earnest, setEarnest] = useState("");
  const [financing, setFinancing] = useState<string>("conventional");
  const [financingOther, setFinancingOther] = useState("");
  const [closeOn, setCloseOn] = useState("");
  const [dueDiligenceDays, setDueDiligenceDays] = useState("");
  const [contingencies, setContingencies] = useState<string[]>(["Inspection", "Appraisal"]);
  const [preapproval, setPreapproval] = useState(false);
  const [proofOfFunds, setProofOfFunds] = useState(false);
  const [commissionPct, setCommissionPct] = useState(ASSUMED_COMMISSION_PCT);

  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  /* No default: "a real estate agent or the buyer" is theirs to say (§5.9). */
  const [representing, setRepresenting] = useState<"self" | "buyer" | null>(null);

  /* The PDF, and what reading it proposed. A box stays marked "from your
     PDF" until the sender edits it, so nothing read is mistaken for typed. */
  const [reading_, setReading] = useState<"idle" | "reading" | "done">("idle");
  const [readSay, setReadSay] = useState<string | null>(null);
  const [documentToken, setDocumentToken] = useState<string | null>(null);
  const [fromPdf, setFromPdf] = useState<Candidates>({});
  const touched = (f: Field) => setFromPdf((c) => { const n = { ...c }; delete n[f]; return n; });

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /* Distinguished from "you left the address blank": one is theirs to fix and
     one is ours, and only ours warrants sending them somewhere else. */
  const [failedToSend, setFailedToSend] = useState(false);

  /* "$350,000" reads; "5k" is said back to them rather than sent as $5
     (lib/core/typed.ts). The reading on the page uses the same numbers. */
  const num = (v: string) => {
    const n = typedNumber(v);
    return n !== null && Number.isFinite(n) ? n : 0;
  };
  const unreadable = ([["The price", price], ["Concessions", concessions], ["Earnest money", earnest]] as const)
    .filter(([, v]) => Number.isNaN(typedNumber(v)))
    .map(([label]) => `${label}: write it as a number of dollars, like 5000.`);

  /* Read against the real parser, so the page cannot show a figure the
     endpoint would reject: the two used to be a validation function and a
     form that agreed by coincidence. */
  const draft = useMemo(() => ({
    address: address || "placeholder address",
    price: num(price), concessions: num(concessions),
    earnest: num(earnest), financing, financingOther, closeOn, dueDiligenceDays, contingencies,
    preapproval, proofOfFunds, documentToken,
    from: from || "Someone", email: email || "someone@example.com",
    phone: phone || "000 000 0000", note, representing: representing ?? "buyer",
  }), [address, price, concessions, earnest, financing, financingOther, closeOn, dueDiligenceDays,
       contingencies, preapproval, proofOfFunds, documentToken, from, email, phone, note, representing]);

  const parsed = readSubmission(draft);
  const reading = parsed.ok && !unreadable.length && num(price) > 0 ? read(parsed.value, commissionPct) : null;

  const toggle = (c: string) =>
    setContingencies((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setReading("reading");
    setReadSay(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/offer/read", { method: "POST", body });
      const j = await res.json().catch(() => null) as null | { ok: boolean; error?: string; say?: string; token?: string | null; candidates?: Candidates };
      if (!j?.ok) { setReadSay(j?.error ?? "That file could not be read. Fill in the boxes instead."); setReading("done"); return; }
      setDocumentToken(j.token ?? null);
      const c = j.candidates ?? {};
      if (c.address) setAddress(c.address.value);
      if (c.price) setPrice(c.price.value);
      if (c.earnest) setEarnest(c.earnest.value);
      if (c.concessions) setConcessions(c.concessions.value);
      if (c.financing) setFinancing(c.financing.value);
      if (c.financingOther) setFinancingOther(c.financingOther.value);
      if (c.closeOn) setCloseOn(c.closeOn.value);
      if (c.dueDiligenceDays) setDueDiligenceDays(c.dueDiligenceDays.value);
      if (c.contingencies) setContingencies(c.contingencies.value.split(", "));
      setFromPdf(c);
      setReadSay(j.say ?? null);
    } catch {
      setReadSay("That file could not be sent. Fill in the boxes instead.");
    }
    setReading("done");
  };

  const send = async () => {
    if (unreadable.length) { setErrors(unreadable); setFailedToSend(false); return; }
    const real = readSubmission({ ...draft, address, from, email, phone, representing });
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
      <SiteHeader side="home" current="/offer" />

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif d2">Submit an offer</h1>

        <section className="card p-5" style={{ marginTop: 24, background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
          <div className="t-md w6">Upload your offer in PDF</div>
          <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}>
            We read it and fill in the boxes below for you to check. Or skip this and type them.
          </p>
          <label className="btn btn-brand" style={{ marginTop: 12, cursor: "pointer" }}>
            <Ico.doc size={15} />{reading_ === "reading" ? "Reading your offer…" : documentToken ? "Choose a different PDF" : "Choose the PDF"}
            <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={reading_ === "reading"}
              onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {readSay ? <p className="t-sm c-2" role="status" style={{ marginTop: 10, lineHeight: 1.6 }}>{readSay}</p> : null}
        </section>

        <section className="card p-5" style={{ marginTop: 24 }}>
          <div className="t-sm w6">The offer</div>

          <label className="field" style={{ marginTop: 14 }}>
            <span className="label">Property address<FromPdf c={fromPdf.address} /></span>
            <input className="input" value={address} onChange={(e) => { setAddress(e.target.value); touched("address"); }}
              placeholder="119 Peachtree Way, Atlanta, GA 30309" />
          </label>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Offer price<FromPdf c={fromPdf.price} /></span>
              <input className="input" inputMode="numeric" value={price}
                onChange={(e) => { setPrice(e.target.value); touched("price"); }} placeholder="410,000" />
            </label>
            <label className="field">
              <span className="label">Earnest money<FromPdf c={fromPdf.earnest} /></span>
              <input className="input" inputMode="numeric" value={earnest}
                onChange={(e) => { setEarnest(e.target.value); touched("earnest"); }} placeholder="5,000" />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Seller concessions asked<FromPdf c={fromPdf.concessions} /></span>
              <input className="input" inputMode="numeric" value={concessions}
                onChange={(e) => { setConcessions(e.target.value); touched("concessions"); }} placeholder="0" />
            </label>
            <label className="field">
              <span className="label">Due diligence days<FromPdf c={fromPdf.dueDiligenceDays} /></span>
              <input className="input" inputMode="numeric" value={dueDiligenceDays}
                onChange={(e) => { setDueDiligenceDays(e.target.value.replace(/[^0-9]/g, "")); touched("dueDiligenceDays"); }} placeholder="10" />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Financing<FromPdf c={fromPdf.financing} /></span>
              <select className="input" value={financing} onChange={(e) => { setFinancing(e.target.value); touched("financing"); }}>
                {FINANCING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Target closing date<FromPdf c={fromPdf.closeOn} /></span>
              <input className="input" type="date" value={closeOn} onChange={(e) => { setCloseOn(e.target.value); touched("closeOn"); }} />
            </label>
          </div>
          {financing === "other" ? (
            <label className="field" style={{ marginTop: 12 }}>
              <span className="label">What kind of financing?<FromPdf c={fromPdf.financingOther} /></span>
              <input className="input" value={financingOther} maxLength={80}
                onChange={(e) => { setFinancingOther(e.target.value); touched("financingOther"); }} placeholder="For example, seller financing" />
            </label>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <span className="label">Contingencies<FromPdf c={fromPdf.contingencies} /></span>
            <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
              {CONTINGENCIES.map((c) => (
                <button key={c} type="button" className={`chip ${contingencies.includes(c) ? "chip-brand" : ""}`}
                  aria-pressed={contingencies.includes(c)} onClick={() => { toggle(c); touched("contingencies"); }}>
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
          <div className="t-md w6">Send it to Kaleb</div>

          <fieldset style={{ marginTop: 12, border: 0, padding: 0 }}>
            <legend className="label">You are</legend>
            <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
              {([["buyer", "A real estate agent"], ["self", "The buyer"]] as const).map(([v, l]) => (
                <button key={v} type="button" className={`btn btn-sm ${representing === v ? "btn-p" : "btn-g"}`}
                  aria-pressed={representing === v} onClick={() => setRepresenting(v)}>{l}</button>
              ))}
            </div>
          </fieldset>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Your name</span>
              <input className="input" autoComplete="name" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Phone</span>
              <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Anything else <span className="c-4">(optional)</span></span>
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {/* Said before the button, not after. A phone number handed over to
              deliver an offer is not consent to be called about anything else,
              and nothing here stores one. */}
          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
            We keep the offer, the PDF if you uploaded one, and your name, phone and email so Kaleb
            can reply. None of it is used for marketing.{" "}
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
      <SiteFooter />
    </>
  );
}

/** "From your PDF, page 3", with the words it was read from on hover and for a screen reader. */
function FromPdf({ c }: { c?: { page: number; quote: string } }) {
  if (!c) return null;
  return (
    <span className="chip chip-brand t-2xs" style={{ marginLeft: 6, height: 20 }} title={`“${c.quote}”`}>
      From your PDF, page {c.page}<span className="sr-only">: “{c.quote}”. Check it.</span>
    </span>
  );
}
