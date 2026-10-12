import type { Metadata } from "next";
import { Mark } from "@/components/rift/icons";

export const metadata: Metadata = { title: "Signing in", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where every sign-in link lands. It signs nobody in by itself.
 *
 * It used to be a route that verified the token on a plain GET. Email security
 * scanners (Outlook Safe Links, most corporate filters) open every link in a
 * message before the person does, so the scanner's visit spent the one-time
 * token and the person's own click then said "expired"
 * (docs/audit/manual-review-2026-10-05.md, F4). A scanner fetches; it does not
 * press buttons. So this page only shows a Continue button, and the token is
 * spent by the POST it makes (app/auth/confirm/route.ts).
 *
 * The fields are passed through as they arrived. The confirm route decides
 * what is valid; this page holds no authority.
 */
export default async function Callback({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const next = q.next ?? "";
  const forClient = next.startsWith("/app");
  const fields = { code: q.code, token_hash: q.token_hash, type: q.type, next: q.next };
  const empty = !q.code && !q.token_hash;

  return (
    <main className="shell-w sec" style={{ maxWidth: 460 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>
      <div className="card p-5">
        {empty ? (
          <>
            <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>This link is incomplete.</h1>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Part of it may have been cut off by your email app.{" "}
              <a className="btn-link" href={forClient ? "/app/sign-in" : "/operations/sign-in"}>Ask for a new one</a>.
            </p>
          </>
        ) : (
          <form action="/auth/confirm" method="post">
            <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>One more step</h1>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Press Continue to sign in. This step stops email security filters from using up your link before you can.
            </p>
            {Object.entries(fields).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <button type="submit" className="btn btn-p" style={{ marginTop: 16, width: "100%" }} autoFocus>Continue</button>
          </form>
        )}
      </div>
    </main>
  );
}
