import type { Metadata } from "next";
import { Suspense } from "react";
import { readFunnel } from "@/lib/db/assessments";
import { Assessment } from "@/components/rift/Assessment";

export const metadata: Metadata = {
  title: "Your numbers",
  description: "Six questions. No account, and you keep the result.",
};

/**
 * Cached, not dynamic.
 *
 * This page renders the same thing for everybody: the funnel definition. The
 * only per-visitor part is `Assessment`, a client component that reads the
 * URL in the browser — nothing about the server render varies by who is
 * asking. It was `force-dynamic` anyway, which cost every visitor a full
 * render on the one page where the product first asks for something: about
 * 1.7 seconds to first byte, against 0.19 for the landing page they arrived
 * from, on a funnel whose own copy says people leave after two.
 *
 * Correctness is not traded for it. `publishQuestions` calls
 * `revalidatePath("/{side}/start")`, so an edit in Studio invalidates this the
 * moment it is published; the window below is the safety net for anything
 * that changes the funnel without going through that action, not the
 * mechanism.
 */
export const revalidate = 300;

/**
 * The seller assessment.
 *
 * The same component as the buyer side. The questions, the live panel and the
 * parameters it hands to the readout are all driven by the funnel's `side`, so
 * there is exactly one assessment implementation to keep correct — the two
 * sides cannot drift apart in how they record answers, count abandonment, or
 * pin a version.
 */
export default async function SellStartPage() {
  const read = await readFunnel("sell");
  const funnel = read.ok && "data" in read ? read.data.funnel : null;

  if (!funnel) {
    return (
      <main className="shell-w" style={{ paddingTop: 80 }}>
        <h1 className="serif" style={{ fontSize: 30 }}>This is briefly unavailable.</h1>
        <p className="t-md c-3" style={{ marginTop: 12 }}>
          Please try again in a moment.
        </p>
      </main>
    );
  }

  return (
    /* A fallback with words in it, matching the buyer side. `null` here meant
       the seller funnel's front door was a blank screen until JavaScript
       arrived — on a slow phone, an empty white page on the one screen where
       the product first asks for something. The buyer side has always shown a
       line; there was never a reason for the two to differ. */
    <Suspense fallback={<main className="shell-w sec sell"><p className="t-sm c-4">Loading your questions…</p></main>}>
      <Assessment funnel={funnel} />
    </Suspense>
  );
}
