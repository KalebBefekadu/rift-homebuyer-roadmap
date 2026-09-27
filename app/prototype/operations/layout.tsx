import type { Metadata } from "next";
import { OpsShell } from "./OpsShell";

export const metadata: Metadata = { title: "Operations mock-up", robots: { index: false } };

/** Blueprint v5 §8 and D15: the proposed Operations layout, for Kaleb to click through. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
