import type { Metadata } from "next";
import "../prototype/rift.css";

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
    <div className="rift">
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {children}
    </div>
  );
}
