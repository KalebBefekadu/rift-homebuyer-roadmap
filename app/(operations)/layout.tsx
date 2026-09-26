import type { Metadata } from "next";
import "../prototype/rift.css";

export const metadata: Metadata = {
  title: { default: "Operations · Rift", template: "%s · Operations" },
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rift">
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {/* .opsx turns into the sidebar layout when a page renders the
          sidebar (OpsNav); sign-in and the signed-out notice stay plain. */}
      <div className="opsx">{children}</div>
    </div>
  );
}
