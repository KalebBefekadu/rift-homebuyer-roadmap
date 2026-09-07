import type { Metadata } from "next";
import { DemoBar } from "@/components/rift/Shell";
import "./rift.css";

export const metadata: Metadata = {
  title: "Rift",
  description: "A clearer way to buy and sell a home in Georgia.",
};

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rift">
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {children}
      <DemoBar />
    </div>
  );
}
