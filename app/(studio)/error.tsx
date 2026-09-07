"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Ico } from "@/components/rift/icons";

/**
 * Studio's error boundary.
 *
 * The public surfaces had one and the agent surface did not, which is the wrong
 * way round for whose day it ruins. A stack trace here reaches the one person
 * who cannot route around the product, usually while they are trying to answer
 * somebody.
 *
 * It says what is and is not affected, because the first question on seeing
 * this screen is whether the leads are still there. They are — this boundary
 * catches a rendering failure, not a data one.
 */
export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <main className="shell-w sec" style={{ maxWidth: 560 }}>
      <div className="row gap-2">
        <Ico.alert size={18} className="c-neg" />
        <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>Studio could not draw this.</h1>
      </div>
      <p className="t-sm c-3" style={{ marginTop: 12, lineHeight: 1.65 }}>
        Nothing is lost. This is a screen that failed to render, not data that failed to save —
        your leads, their readouts and every consent record are where they were. It has been
        reported automatically.
      </p>
      <div className="row gap-2 wrap" style={{ marginTop: 18 }}>
        <button className="btn btn-p" onClick={reset}>Try again</button>
        <Link href="/studio" className="btn btn-g">Back to Today</Link>
      </div>
      {error.digest ? (
        <p className="t-2xs c-4" style={{ marginTop: 18 }}>Reference {error.digest}</p>
      ) : null}
    </main>
  );
}
