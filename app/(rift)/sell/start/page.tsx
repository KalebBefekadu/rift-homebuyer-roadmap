import type { Metadata } from "next";
import { Suspense } from "react";
import { readFunnel } from "@/lib/db/assessments";
import { Assessment } from "@/components/rift/Assessment";

export const metadata: Metadata = {
  title: "Your numbers",
  description: "Six questions. No account, and you keep the result.",
};

export const dynamic = "force-dynamic";

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
    <Suspense fallback={null}>
      <Assessment funnel={funnel} />
    </Suspense>
  );
}
