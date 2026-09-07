import type { Metadata } from "next";
import "../prototype/rift.css";

export const metadata: Metadata = {
  title: { default: "Studio · Rift", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
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
