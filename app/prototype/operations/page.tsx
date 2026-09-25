import type { Metadata } from "next";
import { Suspense } from "react";
import { OpsMock } from "@/components/rift/ops/OpsMock";

export const metadata: Metadata = { title: "Operations mock-up", robots: { index: false } };

/**
 * The Operations mock-up for Kaleb's review (Blueprint v5 §8, decision D15).
 * Made-up data; nothing is saved. The real screens are rebuilt only after he
 * has clicked through this and said what to keep or change.
 */
export default function OperationsMockPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading the mock-up…</p>}>
      <OpsMock />
    </Suspense>
  );
}
