"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Mark } from "@/components/rift/icons";

/**
 * The client pages' error boundary.
 *
 * Without one, a read that threw on a buyer's page fell through to the
 * root's bare error screen: no name, no way back to their move, and nothing
 * to say whether what they had just sent was kept. Every write on these
 * pages is stored before the page says so, so a page that fails to draw
 * afterwards has lost nothing, and this says that.
 *
 * "Try again" reloads rather than calling `reset`: these pages are drawn on
 * the server, and resetting the boundary re-renders the same failed reply.
 */
export default function ClientError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <main className="shell-w sec" style={{ maxWidth: 520 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>
      <div className="card p-5">
        <h1 className="serif" style={{ fontSize: 24 }}>This page did not load.</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Something on our side broke, and it has been reported. Anything you sent and saw confirmed is saved;
          this did not change it.
        </p>
        <div className="row gap-2 wrap" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-p" onClick={() => window.location.reload()}>Try again</button>
          <Link href="/app" className="btn btn-g">Your move</Link>
        </div>
        {error.digest ? <p className="t-2xs c-4" style={{ marginTop: 14 }}>Reference {error.digest}</p> : null}
      </div>
    </main>
  );
}
