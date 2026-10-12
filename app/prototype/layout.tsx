import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { internalHidden } from "@/lib/core/internal";
import { DemoBar } from "@/components/rift/Shell";
import "../styles/rift.css";
import { Fonts } from "@/components/rift/Fonts";

export const metadata: Metadata = {
  title: "Rift",
  description: "A clearer way to buy and sell a home in Georgia.",
};

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  /* Every prototype route is nested under this layout, so one refusal here
     closes all forty of them. See lib/core/internal.ts for why. */
  if (internalHidden(process.env)) notFound();

  return (
    <div className="rift">
      <Fonts />
      {children}
      <DemoBar />
    </div>
  );
}
