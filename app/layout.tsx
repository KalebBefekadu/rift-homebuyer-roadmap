import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rift",
  description:
    "Client experience and agent operating platform for the residential real-estate lifecycle.",
};

/**
 * Deliberately bare.
 *
 * The previous root layout wrapped every route in an `AuthProvider` that
 * belonged to the retired portal MVP. Nothing consumes a session yet — the
 * prototype has no accounts by design — so wrapping the tree in a provider
 * that nothing reads is a dependency pretending to be a decision.
 *
 * `lib/auth/*` is intact and working. Re-introduce a session provider here in
 * phase 3, when there are real accounts for it to serve. See docs/handoff.md.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
