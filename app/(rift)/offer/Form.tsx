"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import {
  readSubmission, read, ASSUMED_COMMISSION_PCT,
  MIN_COMMISSION_PCT, MAX_COMMISSION_PCT, MAX_DUE_DILIGENCE_DAYS, OFFER_CONTINGENCIES,
} from "@/lib/core/offer-intake";
import { sessionId } from "@/lib/rift/session";
import type { Extracted, Source } from "@/lib/core/offer-extract";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const FINANCING = [
  ["conventional", "Conventional"], ["cash", "Cash"], ["fha", "FHA"],
  ["va", "VA"], ["usda", "USDA"], ["other", "Other"],
] as const;

const CONTINGENCIES: readonly string[] = OFFER_CONTINGENCIES;

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
  const [earnest, setEarnest] = useState("");
  const [financing, setFinancing] = useState<string>("conventional");
  const [financingDetail, setFinancingDetail] = useState("");
  const [dueDiligence, setDueDiligence] = useState("");
  const [closeOn, setCloseOn] = useState("");
  const [contingencies, setContingencies] = useState<string[]>(["Inspection", "Appraisal"]);
  const [preapproval, setPreapproval] = useState(false);
  const [proofOfFunds, setProofOfFunds] = useState(false);
  const [commissionPct, setCommissionPct] = useState(ASSUMED_COMMISSION_PCT);

  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  /* Nothing preselected: which one they are is theirs to say (§5.9). */
  const [representing, setRepresenting] = useState<"self" | "buyer" | null>(null);

  /* Upload first (Blueprint v5 §5.9). What it fills carries where it came
     from, and sending needs the sender to say they checked it (DOC-02). */
  const [pdf, setPdf] = useState<"idle" | "reading" | "filled" | "manual">("idle");
  const [readNote, setReadNote] = useState<string | null>(null);
  const [sources, setSources] = useState<Extracted["sources"]>({});
  const [checked, setChecked] = useState(false);
  const filledFromPdf = Object.keys(sources).length > 0;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setPdf("reading");
    setReadNote(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const j = await fetch("/api/offer/extract", { method: "POST", body }).then((r) => r.json());
      if (!j?.ok) { setPdf("manual"); setReadNote(j?.say ?? j?.error ?? "We could not read that PDF. Fill in the boxes from it."); return; }
      const x = j.extracted as Extracted;
      if (x.address) setAddress(x.address);
      if (x.price !== undefined) setPrice(String(x.price));
      if (x.earnest !== undefined) setEarnest(String(x.earnest));
      if (x.concessions !== undefined) setConcessions(String(x.concessions));
      if (x.financing) setFinancing(x.financing);
      if (x.financingDetail) setFinancingDetail(x.financingDetail);
      if (x.dueDiligenceDays !== undefined) setDueDiligence(String(x.dueDiligenceDays));
      if (x.closeOn) setCloseOn(x.closeOn);
      if (x.contingencies) setContingencies(x.contingencies);
      setSources(x.sources);
      setChecked(false);
      setPdf("filled");
      setReadNote(x.dropped > 0
        ? "Some terms could not be read with confidence and were left for you to fill in."
        : null);
    } catch {
      setPdf("manual");
      setReadNote("That upload did not get through. Fill in the boxes from your PDF.");
    }
  };

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
    price: num(price), concessions: num(concessions), repairCredit: 0,
    earnest: num(earnest), financing, financingDetail: financingDetail || "not said yet",
    dueDiligenceDays: dueDiligence, closeOn, contingencies,
    preapproval, proofOfFunds,
    from: from || "Someone", email: email || "someone@example.com",
    phone: phone || "0000000", note, representing: representing ?? "buyer",
  }), [address, price, concessions, earnest, financing, financingDetail, dueDiligence, closeOn,
       contingencies, preapproval, proofOfFunds, from, email, phone, note, representing]);

  const parsed = readSubmission(draft);
  const reading = parsed.ok && num(price) > 0 ? read(parsed.value, commissionPct) : null;

  const toggle = (c: string) =>
    setContingencies((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const send = async () => {
    const real = readSubmission({ ...draft, address, from, email, phone, financingDetail, representing });
    const unchecked = filledFromPdf && !checked ? ["Check the boxes filled from your PDF against it, then tick that you have."] : [];
    if (!real.ok || unchecked.length) { setErrors([...(real.ok ? [] : real.errors), ...unchecked]); setFailedToSend(false); return; }
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
      <SiteHeader side="buy" current="/offer" />

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        {/* The old heading promised "any Georgia address" and a paragraph of
            reassurance before the form (Kaleb, R2): the form says it. */}
        <h1 className="serif ctr" style={{ fontSize: "clamp(30px,4vw,46px)", lineHeight: 1.1, letterSpacing: "-0.025em" }}>
          Submit an offer
        </h1>

        <section className="card p-5" style={{ marginTop: 24, background: "var(--brand-wash)", borderColor: "var(--brand-line)" }} aria-labelledby="upload-h">
          <div id="upload-h" className="t-md w6">Upload your offer in PDF</div>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            We read it and fill in the boxes below. You check each one against your PDF before
            sending. No PDF? Fill them in yourself.
          </p>
          <label className="btn btn-brand" style={{ marginTop: 12, cursor: "pointer", position: "relative" }}>
            <Ico.doc size={14} />{pdf === "reading" ? "Reading your PDF…" : pdf === "filled" ? "Upload a different PDF" : "Choose a PDF"}
            <input type="file" accept="application/pdf,.pdf" className="sr-only"
              disabled={pdf === "reading"}
              onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <div role="status" aria-live="polite">
            {pdf === "filled" ? (
              <p className="t-sm c-2 row gap-2" style={{ marginTop: 10, alignItems: "flex-start" }}>
                <Ico.checkCircle size={15} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
                Filled in from your PDF. Each box says where it was found: check them against your document.
              </p>
            ) : null}
            {readNote ? <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.55 }}>{readNote}</p> : null}
          </div>
          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
            The PDF is read by Anthropic&apos;s Claude to fill in the boxes, and Rift does not keep it.{" "}
            <Link href="/privacy" className="u">Who sees what</Link>.
          </p>
        </section>

        <section className="card p-5" style={{ marginTop: 16 }}>
          <div className="t-sm w6">The offer</div>

          <label className="field" style={{ marginTop: 14 }}>
            <span className="label">Property address</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="119 Peachtree Way, Atlanta, GA 30309" />
            <FromPdf source={sources.address} />
          </label>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Offer price</span>
              <input className="input" inputMode="numeric" value={price}
                onChange={(e) => setPrice(e.target.value)} placeholder="410,000" />
              <FromPdf source={sources.price} />
            </label>
            <label className="field">
              <span className="label">Earnest money</span>
              <input className="input" inputMode="numeric" value={earnest}
                onChange={(e) => setEarnest(e.target.value)} placeholder="5,000" />
              <FromPdf source={sources.earnest} />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Seller concessions asked</span>
              <input className="input" inputMode="numeric" value={concessions}
                onChange={(e) => setConcessions(e.target.value)} placeholder="0" />
              <FromPdf source={sources.concessions} />
            </label>
            <label className="field">
              <span className="label">Due diligence days</span>
              <input className="input" inputMode="numeric" value={dueDiligence}
                onChange={(e) => setDueDiligence(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                placeholder="10" aria-describedby="dd-hint" />
              <span id="dd-hint" className="t-2xs c-4">0 to {MAX_DUE_DILIGENCE_DAYS}. Leave it empty if there is none.</span>
              <FromPdf source={sources.dueDiligenceDays} />
            </label>
          </div>

          <div className="g2 gap-2" style={{ marginTop: 12 }}>
            <label className="field">
              <span className="label">Financing</span>
              <select className="input" value={financing} onChange={(e) => setFinancing(e.target.value)}>
                {FINANCING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <FromPdf source={sources.financing} />
            </label>
            <label className="field">
              <span className="label">Target closing date</span>
              <input className="input" type="date" value={closeOn} onChange={(e) => setCloseOn(e.target.value)} />
              <FromPdf source={sources.closeOn} />
            </label>
          </div>

          {financing === "other" ? (
            <label className="field" style={{ marginTop: 12 }}>
              <span className="label">What is the other financing?</span>
              <input className="input" value={financingDetail} maxLength={120}
                onChange={(e) => setFinancingDetail(e.target.value)} placeholder="Seller financing, a 1031 exchange, a portfolio loan…" />
              <FromPdf source={sources.financingDetail} />
            </label>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <span className="label">Contingencies</span>
            <FromPdf source={sources.contingencies} />
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
          <div className="t-sm w6" id="who-h">Who is sending it?</div>

          <div role="radiogroup" aria-labelledby="who-h" className="g2 gap-2" style={{ marginTop: 12 }}>
            {([["buyer", "I'm a real estate agent", "Sending for my buyer"], ["self", "I'm the buyer", "Sending for myself"]] as const).map(([v, l, h]) => (
              <button key={v} type="button" role="radio" className="opt" data-on={representing === v}
                aria-checked={representing === v} onClick={() => setRepresenting(v)}
                style={{ width: "100%", textAlign: "left" }}>
                <span className="grow">
                  <span className="t-md w55">{l}</span>
                  <span className="t-xs c-4" style={{ display: "block", marginTop: 1 }}>{h}</span>
                </span>
                {representing === v ? <Ico.checkCircle size={16} className="c-brand" /> : null}
              </button>
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

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Phone</span>
            <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

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

          {filledFromPdf ? (
            <label className="opt" data-on={checked} style={{ marginTop: 12, alignItems: "flex-start" }}>
              <input type="checkbox" checked={checked} onChange={() => setChecked(!checked)} style={{ marginTop: 3 }} />
              <span className="t-sm c-2" style={{ lineHeight: 1.5 }}>
                I have checked every box filled from my PDF against it, and corrected anything that was wrong.
              </span>
            </label>
          ) : null}

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

/** Where a box's value was read from, so the sender can find it in their PDF. */
function FromPdf({ source }: { source?: Source }) {
  if (!source) return null;
  return (
    <span className="t-2xs c-3" style={{ display: "block", marginTop: 4, lineHeight: 1.45 }}>
      From your PDF, page {source.page}: &ldquo;{source.quote}&rdquo;
    </span>
  );
}
