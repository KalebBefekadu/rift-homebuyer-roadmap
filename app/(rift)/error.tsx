"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * The public surfaces' error boundary.
 *
 * Paid traffic lands here. A stack trace or a blank page is a lost lead and a
 * lost impression of the product, so this says what happened in plain terms and
 * gives somewhere to go: the standing rule that nothing is ever a dead end.
 *
 * It also captures, because an error nobody is told about is one nobody fixes.
 */
export default function RiftError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <main className="shell-w sec buy">
      <h1 className="serif" style={{ fontSize: "clamp(24px,3.2vw,36px)", letterSpacing: "-0.02em", maxWidth: 620 }}>
        Something on our side broke.
      </h1>
      {/* This said "none of your answers were lost. They are saved on this
          device", on every public page. True for the value questions, whose
          answers live on the device, and for readouts, whose answers live in
          the address. Untrue on /offer and /book, where what was typed lives
          only in the form this boundary has just replaced. A reassurance that
          is false on the page where somebody typed the most is worse than
          none, so it says which is which. */}
      <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>
        Not your browser, and nothing you did. It has been reported automatically. Answers
        kept on this device or in the page address are safe, and trying again brings them back.
        Anything typed into a form on this page, like an offer or a request for a call, may need
        typing again.
      </p>
      <div className="row gap-2 wrap" style={{ marginTop: 20 }}>
        <button className="btn btn-p" onClick={reset}>Try that again</button>
        <Link href="/buy" className="btn btn-g">Start over</Link>
        <Link href="/buy/programs" className="btn btn-g">See the programs</Link>
      </div>
      {error.digest ? (
        <p className="t-2xs c-4" style={{ marginTop: 18 }}>Reference {error.digest}</p>
      ) : null}
    </main>
  );
}
