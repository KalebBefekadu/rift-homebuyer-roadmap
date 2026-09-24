import type { Metadata } from "next";
import { Mark } from "@/components/rift/icons";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const WHY: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Ask for a new one below.",
  missing_code: "That sign-in link was incomplete. Ask for a new one below.",
  unconfigured: "Sign-in is not set up on this site right now. Your agent can still help by phone or email.",
};

/**
 * The buyer's sign-in. A link by email, never a password, and never an
 * account for an address nobody invited: see app/api/app/route.ts.
 */
export default async function ClientSignIn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const reason = q.error ? WHY[q.error] ?? WHY.expired : q.out ? "You are signed out." : null;
  return (
    <main className="shell-w sec" style={{ maxWidth: 460 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>
      <div className="card p-5">
        <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>Sign in to your move</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          For buyers your agent has invited. We email you a link; there is no password to remember.
        </p>
        {reason ? <p className="t-xs c-3" style={{ marginTop: 10 }}>{reason}</p> : null}
        <SignInForm />
      </div>
      {/* Blueprint v5 §7.3. The form sends nothing to an address nobody
          invited, and cannot say so without revealing who is a client, so the
          way in is explained here instead, for everyone. */}
      <div className="t-sm c-3" style={{ marginTop: 18, lineHeight: 1.6, paddingInline: 4 }}>
        <div className="w6 c-2">First time here?</div>
        <p style={{ marginTop: 4 }}>
          Access starts with an invitation link from your agent. Open that link once and you are in; after
          that, sign in here with the same email. If you have not had an invitation, ask your agent for one.
        </p>
      </div>
    </main>
  );
}
