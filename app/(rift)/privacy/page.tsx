import type { Metadata } from "next";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import {
  RETENTION, SUBPROCESSORS, PHONE_CONSENT, EMAIL_NOTE, CONSENT_VERSION, CONTACT_EMAIL,
} from "@/lib/core/privacy";
import { EVENT_NAMES, ALLOWED_META } from "@/lib/core/telemetry";

export const metadata: Metadata = {
  title: "What we keep",
  description:
    "Everything Rift collects, who else sees it, how long it is kept, and how to delete all of it in one click without an account.",
};

/**
 * The privacy page.
 *
 * Written last, which is the wrong order and worth saying: the product had a
 * retention policy, a consent record, an allowlist enforced in three layers
 * and a working one-click delete for months before it had a page a stranger
 * could read any of that on. The policy was real and unreachable, which from
 * outside is the same as not having one.
 *
 * Every figure here is rendered from the module that enforces it rather than
 * retyped: RETENTION, ALLOWED_META, the consent wording, the version. A
 * privacy policy that is prose drifts from the code within one change, and
 * then the document that exists to be relied upon is the least reliable thing
 * on the site. `lib/core/docs.test.ts` already fails when the markdown drifts
 * from RETENTION; this page cannot drift at all, because there is nothing to
 * keep in sync.
 *
 * Not legal advice, and not reviewed by counsel. It is an honest description
 * of what the software does, which is a lower bar than a compliant policy and
 * a higher one than most of them clear.
 */
export default function PrivacyPage() {
  return (
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/" className="row gap-2">
            <Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <Link href="/buy/start" className="btn btn-g btn-sm">Get my numbers</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          What we keep, and what we do not
        </h1>
        <p className="lede" style={{ marginTop: 14 }}>
          You can use this entire product without telling us who you are. If you do give us an
          email address, this is everything that happens to it.
        </p>

        <Block title="The short version">
          <ul>
            <li>No account, ever. Nothing here requires you to make one.</li>
            <li>We never store what you typed into a question next to who you are. Those are two separate records with two separate lifetimes.</li>
            <li>We never ask for a credit score, a social security number, or a bank login.</li>
            <li>Nothing is sold, shared for advertising, or given to a data broker. There is no advertising on this site.</li>
            <li>
              You can delete everything in one click from the bottom of your readout, with no
              account and without asking anyone.
            </li>
          </ul>
        </Block>

        <Block title="What we collect, and only when you give it">
          <p>
            <strong>Your answers.</strong> The county, the price you are aiming at, what you have
            saved, what you owe, when you want to move. These produce your readout. They are
            stored against a random session id, not against your name, until and unless you
            give us contact details.
          </p>
          <p>
            <strong>Your contact details</strong>, if you ask for your readout by email, book a
            call, or ask a question. An email address is enough; a phone number is optional and
            is only stored if you tick the box quoted below. Tick nothing and we store nothing.
          </p>
          <p>
            <strong>A record of what you agreed to</strong> (the exact wording, not a reference
            to it), so that we cannot quietly change the terms after the fact, and so there is
            evidence that contacting you was allowed.
          </p>
          <p>
            <strong>Which questions people stop on.</strong> This is how the questions get
            better. It carries the question and the time spent, never the answer.
          </p>
        </Block>

        <Block title="What the measurement is allowed to carry">
          <p>
            Rather than describe this, here is the actual list. These are the only keys our
            measurement will accept; anything else is dropped before it is written, by the
            application and again by a constraint in the database.
          </p>
          <div className="card p-4" style={{ marginTop: 12 }}>
            <div className="kicker c-4">Permitted fields</div>
            <p className="t-xs c-2" style={{ marginTop: 8, lineHeight: 1.8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {ALLOWED_META.join(" · ")}
            </p>
            <div className="kicker c-4" style={{ marginTop: 16 }}>Events we record</div>
            <p className="t-xs c-2" style={{ marginTop: 8, lineHeight: 1.8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {EVENT_NAMES.join(" · ")}
            </p>
          </div>
          <p>
            This used to be written the other way round (a list of things to block), and a
            blocklist lets through everything nobody thought of. It did. The buyers-abroad page
            logged a visitor&rsquo;s residency situation on every view for as long as that page
            existed, because &ldquo;status&rdquo; was not on anybody&rsquo;s list of dangerous
            words. It is an allowlist now, in all three places, and those rows were deleted.
          </p>
        </Block>

        <Block title="How long each thing is kept">
          <div className="card" style={{ marginTop: 12 }}>
            {RETENTION.map((r, n) => (
              <div key={r.id} style={{ padding: "14px 18px", borderBottom: n < RETENTION.length - 1 ? "1px solid var(--line-3)" : undefined }}>
                <div className="between wrap gap-3" style={{ alignItems: "baseline" }}>
                  <span className="t-sm w6">{r.what}</span>
                  <span className="chip chip-out t-2xs" style={{ flex: "none" }}>{r.keptFor}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{r.why}</p>
                <p className="t-xs c-4" style={{ marginTop: 4, lineHeight: 1.6 }}>{r.thenWhat}</p>
              </div>
            ))}
          </div>
          <p>
            A job runs on a schedule and deletes what is past its date. It is not a policy
            somebody remembers to apply.
          </p>
        </Block>

        <Block title="What you agreed to, word for word">
          <p>
            If you gave us a phone number, this is the wording you ticked, and this exact text is
            stored with your record:
          </p>
          <div className="card p-4" style={{ marginTop: 12, background: "var(--sunk)" }}>
            <p className="t-sm" style={{ lineHeight: 1.65 }}>{PHONE_CONSENT}</p>
            <p className="t-2xs c-4" style={{ marginTop: 10 }}>Version {CONSENT_VERSION}</p>
          </div>
          <p style={{ marginTop: 14 }}>And about email:</p>
          <div className="card p-4" style={{ marginTop: 12, background: "var(--sunk)" }}>
            <p className="t-sm" style={{ lineHeight: 1.65 }}>{EMAIL_NOTE}</p>
          </div>
          <p>
            A phone number is never a condition of anything. It is never pre-ticked. If you gave
            us an email address and not a number, we will not call you, because we do not have a
            number to call.
          </p>
        </Block>

        <Block title="Who else sees any of it">
          <p>
            Named, rather than summarised as partners. Each of these holds some part of a record
            because the product cannot work without it. None of them is an advertising or
            data-brokerage relationship.
          </p>
          <div className="card" style={{ marginTop: 12 }}>
            {SUBPROCESSORS.map((s, n) => (
              <div key={s.name} style={{ padding: "13px 18px", borderBottom: n < SUBPROCESSORS.length - 1 ? "1px solid var(--line-3)" : undefined }}>
                <div className="row gap-2">
                  <span className="t-sm w6">{s.name}</span>
                  <span className="t-xs c-4">{s.does}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 5, lineHeight: 1.6 }}>{s.sees}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Deleting it">
          <p>
            There is a button at the bottom of your readout that deletes your answers, your
            readout, your contact details and your consent record. One click. No account, no
            form, no reply from anyone, and no question about why.
          </p>
          <p>
            One thing survives it, and it is fair that you know which: if you became a client and
            we worked on a transaction together, Georgia licence law requires that the
            transaction record is kept, and it is not ours to discard. Everything that is ours to
            discard, goes.
          </p>
          <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
            <Link href="/buy" className="btn btn-g btn-sm">Buyer answers<Ico.arrowR size={13} /></Link>
            <Link href="/sell" className="btn btn-g btn-sm">Seller answers<Ico.arrowR size={13} /></Link>
          </div>
        </Block>

        <Block title="Asking us something">
          <p>
            {CONTACT_EMAIL ? (
              <>
                Write to <a href={`mailto:${CONTACT_EMAIL}`} className="c-brand">{CONTACT_EMAIL}</a> and
                a person will answer.
              </>
            ) : (
              /* Honest degradation rather than a plausible dead address. See
                 the note on CONTACT_EMAIL in lib/core/privacy.ts. */
              <>
                Reply to any email we have sent you and it reaches Kaleb directly. If we have
                never emailed you, then we are not holding an address for you, and the delete
                button on your readout works without contacting anyone at all.
              </>
            )}
          </p>
          <p>
            Rift is operated by Kaleb Befekadu, a licensed residential real-estate agent in
            Georgia, with Peachtree Cardinal. This page describes what the software does. It is
            not a contract and it is not legal advice.
          </p>
        </Block>

        <p className="t-xs c-4" style={{ marginTop: 34, lineHeight: 1.6 }}>
          Every figure on this site is a planning estimate, not a lending commitment, approval,
          or valuation. Not tax or legal advice.
        </p>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>{title}</h2>
      <div className="t-sm c-2 how-body" style={{ marginTop: 10, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}
