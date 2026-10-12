import type { Metadata } from "next";
import { Noto_Sans_Ethiopic } from "next/font/google";
import "../prototype/rift.css";

/* Self-hosted Ethiopic for the Amharic portal (WS11.6), as app/(rift)/layout.tsx. */
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ethiopic",
});

export const metadata: Metadata = {
  title: { default: "Your move · Rift", template: "%s · Rift" },
  robots: { index: false, follow: false },
};

/**
 * The buyer's signed-in pages (blueprint v4 §2, "Client"). Calm, personal,
 * mobile-first: one journey, what matters now, and nothing of the agent's
 * working notes. Never indexed.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rift ${ethiopic.variable}`}>
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {children}
    </div>
  );
}
