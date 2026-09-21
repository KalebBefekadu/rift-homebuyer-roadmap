/**
 * Rift — retention and consent policy.
 *
 * People hand this product their savings balance, their timeline and the name
 * of the person they are buying with, before they have agreed to anything.
 * Being able to state plainly what happens to that — and to act on a request to
 * delete it in one click — is not a compliance chore here. It is the same
 * argument the whole product makes: show them the truth before asking for
 * something.
 *
 * Not legal advice. The consent wording below is written to be honest and
 * specific; counsel should review it before it collects a real phone number.
 *
 * This is DATA, and it lives in the domain layer because the server writes it
 * to `rift_consents` and the browser renders it, and those two must be the same
 * text. It used to sit in a "use client" module, which meant the server-side
 * capture path imported a client module to learn what somebody had agreed to.
 * The client-side helpers that act on this data stay in lib/prototype/privacy.ts.
 */

/* ------------------------------------------------------------------ *
 * Retention
 * ------------------------------------------------------------------ */

export interface RetentionRule {
  id: string;
  what: string;
  keptFor: string;
  why: string;
  thenWhat: string;
}

export const RETENTION: RetentionRule[] = [
  {
    id: "unconverted",
    what: "An assessment nobody ever came back to",
    keptFor: "18 months",
    why: "A buyer on a 'nine to eighteen months' answer is still inside their own stated timeline. Deleting at ninety days would throw away the person the product was built for.",
    thenWhat: "Deleted outright — not anonymised, not archived.",
  },
  {
    id: "abandoned",
    what: "A part-finished assessment with no contact details",
    keptFor: "30 days",
    why: "Long enough to resume on the same device, short enough that it is not a collection of strangers' finances.",
    thenWhat: "Deleted outright.",
  },
  {
    id: "client",
    what: "The record of someone we actually worked with",
    keptFor: "As required by Georgia licence law",
    why: "Transaction records are not ours to discard. The retention period is set by the state and the brokerage, not by us.",
    thenWhat: "Retained per brokerage policy, then destroyed on their schedule.",
  },
  {
    id: "analytics",
    what: "Funnel measurement — which question people stop on",
    keptFor: "24 months",
    why: "Carries the question id and the time spent, never the answer. We know someone stopped on the savings question; we do not know what they typed.",
    thenWhat: "Aggregated counts survive, individual event rows do not.",
  },
  {
    /* Added because the panel was silent about it, and a retention list that
       omits one category is not a retention list — it is a selection. This
       record is also the only thing that can later prove the contact was
       lawful, which is why it outlives the relationship it came from. */
    id: "consent",
    what: "A record of what you agreed to, and the exact wording you agreed to",
    keptFor: "The relationship, then five years",
    why: "It is the evidence that we were allowed to contact you at all. Keeping the wording rather than a reference to it means we cannot quietly change what you agreed to after the fact.",
    thenWhat: "Deleted with the rest of the record.",
  },
  {
    /* Added the day /offer shipped, for the reason the note above gives. An
       inbound offer is a genuinely new category: it is the only record here
       that is ABOUT A THIRD PARTY — a property somebody else owns, and often a
       buyer who is not the person typing. Leaving it off the list because the
       submitter is not the subject would be the same selection this file
       already refuses once. */
    id: "offer",
    what: "An offer you submitted, and the address it was on",
    keptFor: "While it is live, then 24 months",
    why: "An offer is a document somebody may act on, and the record of what was sent is the only protection either side has if the terms are later disputed. The address belongs to a property, not to you — we do not treat it as yours to delete, and we do not attach it to anybody who has not asked us to.",
    thenWhat: "Deleted outright. A phone number given to deliver an offer is passed on with it and never stored.",
  },
];

/* ------------------------------------------------------------------ *
 * Consent
 * ------------------------------------------------------------------ */

/**
 * US telemarketing rules require prior express WRITTEN consent before an
 * autodialed or prerecorded marketing call or text. A pre-ticked box is not
 * consent, and consent bundled into a terms-of-service link is not consent
 * either — it has to be a separate, unticked, specific agreement, and the exact
 * wording shown has to be retained alongside the record.
 *
 * Which is also why the phone number is optional here. Email costs nothing to
 * offer and carries none of this.
 */
export const CONSENT_VERSION = "2026-09-01";

export const PHONE_CONSENT =
  "I agree that Kaleb Befekadu and Rift may call and text me at this number about my " +
  "enquiry, including with an automatic dialling system or a prerecorded message. " +
  "I understand this is not a condition of buying or selling anything, that message " +
  "and data rates may apply, and that I can stop it any time by replying STOP.";

export const EMAIL_NOTE =
  "We email you your readout and tell you when something in it changes. No newsletter, " +
  "no list, and nothing sold on. One click unsubscribes.";


/* ------------------------------------------------------------------ *
 * Who else touches it
 * ------------------------------------------------------------------ */

export interface Subprocessor {
  name: string;
  does: string;
  /** What of somebody's data actually reaches them. Specific, not "data". */
  sees: string;
}

/**
 * The third parties that hold any part of somebody's record.
 *
 * Named rather than summarised as "trusted partners", which is the phrase a
 * privacy policy uses when it would rather you did not check. Each line says
 * what that company actually receives, because "we share data with service
 * providers" is true of every company that has ever leaked anything.
 *
 * Nothing on this list is an advertising or data-brokerage relationship, and
 * that is the sentence worth being able to write. If one is ever added, it
 * goes here first.
 */
export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase",
    does: "The database, and the agent's sign-in",
    sees: "Everything stored: your answers, your readout, your contact details and your consent record.",
  },
  {
    name: "Vercel",
    does: "Runs the site",
    sees: "The ordinary request log of any web host — your IP address and which pages were requested.",
  },
  {
    name: "Brevo",
    does: "Sends the emails",
    sees: "Your email address and the content of the messages sent to you, including the figures in your readout.",
  },
  {
    name: "Sentry",
    does: "Reports errors so they get fixed",
    sees: "Technical detail about a failure — the page, the browser, the error. Session recording is switched off, so it never receives what you typed.",
  },
  {
    name: "Cal.com",
    does: "Holds a booked time",
    sees: "Your name, email, and the time you chose — only if you book a call.",
  },
];

/* ------------------------------------------------------------------ *
 * Reaching a human
 * ------------------------------------------------------------------ */

/**
 * Where a privacy request goes.
 *
 * `null` until there is a real monitored mailbox. Rendering a plausible
 * address that nobody reads would be worse than the honest degradation below:
 * a privacy policy naming a dead inbox is a promise that fails silently, in
 * the one document whose entire job is to be relied on.
 *
 * The delete button does not depend on this. It never did — it is one click on
 * the readout and it needs no address, no account and no reply from anyone.
 */
export const CONTACT_EMAIL: string | null = null;
