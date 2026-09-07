import Link from "next/link";
import { Mark } from "@/components/rift/icons";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 62 }}>
          <Link href="/prototype/kaleb" className="row gap-2">
            <Mark size={21} /><span className="mark-name" style={{ fontSize: 20 }}>Rift</span>
            <span className="chip hide-sm">Offer</span>
          </Link>
          <span className="t-xs c-4">No account needed</span>
        </div>
      </header>
      <main style={{ paddingBottom: 110 }}>{children}</main>
    </div>
  );
}
