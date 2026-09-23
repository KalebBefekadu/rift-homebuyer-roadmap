import Link from "next/link";
import { Mark } from "@/components/rift/icons";

/** The bar across the buyer's pages: where they are, whose, and a way out. */
export function ClientShell({ agentName, children }: { agentName: string | null; children: React.ReactNode }) {
  return (
    <>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/app" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <div className="row gap-2">
            {agentName ? <span className="t-xs c-4 hide-sm">With {agentName}</span> : null}
            <form action="/app/sign-out" method="post">
              <button className="btn btn-g btn-sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="shell-w" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 760 }}>{children}</main>
    </>
  );
}
