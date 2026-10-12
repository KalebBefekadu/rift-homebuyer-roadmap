import type { Metadata } from "next";
import "../styles/rift.css";
import { Fonts } from "@/components/rift/Fonts";

export const metadata: Metadata = {
  title: { default: "Operations · Rift", template: "%s · Operations" },
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rift">
      <Fonts />
      {children}
    </div>
  );
}
