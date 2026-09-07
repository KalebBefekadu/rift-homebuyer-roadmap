import type { Metadata } from "next";
import { Suspense } from "react";
import { readFunnel } from "@/lib/db/assessments";
import { Assessment } from "./Assessment";

export const metadata: Metadata = {
  title: "Your numbers",
  description: "Seven questions. No account, and you keep the result.",
};

export const dynamic = "force-dynamic";

/**
 * The assessment.
 *
 * The funnel definition is read on the server so the questions are in the first
 * paint. A form that renders after a round trip loses people on a phone before
 * it has asked anything, and this is the one screen where that cost is measured
 * directly in leads.
 */
export default async function StartPage() {
  const read = await readFunnel("buy");
  const funnel = read.ok && "data" in read ? read.data.funnel : null;

  if (!funnel) {
    /* Refusing to render a broken assessment. Half a form is worse than an
       honest apology, because the visitor answers three questions and then
       discovers it. */
    return (
      <main className="shell-w sec buy">
        <h1 className="serif" style={{ fontSize: 28 }}>The assessment is briefly unavailable.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Nothing you do would be saved right now, so we would rather not take you through it.
          Try again in a few minutes.
        </p>
      </main>
    );
  }

  return (
    <Suspense fallback={<main className="shell-w sec buy"><p className="t-sm c-4">Loading your questions…</p></main>}>
      <Assessment funnel={funnel} />
    </Suspense>
  );
}
