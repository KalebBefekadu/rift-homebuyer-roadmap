"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * The public surfaces' error boundary.
 *
 * Paid traffic lands here. A stack trace or a blank page is a lost lead and a
 * lost impression of the product, so this says what happened in plain terms and
 * gives somewhere to go — the standing rule that nothing is ever a dead end.
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
      <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>
        Not your browser, and nothing you did. It has been reported automatically, and none of
        your answers were lost — they are saved on this device.
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
