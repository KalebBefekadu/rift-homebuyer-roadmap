import type { Metadata } from "next";
import { Mark } from "@/components/rift/icons";
import { clientSession, invitationByToken } from "@/lib/db/client";
import { acceptError, buyerSearchOn } from "@/lib/core/journey";
import { InviteActions } from "./InviteActions";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Opening an invitation.
 *
 * The link alone grants nothing. It says whose invitation it is (with the
 * address masked, because the link may have been forwarded), then asks the
 * holder to sign in with that address. Only a signed-in session whose
 * verified address matches can accept, and accepting spends the link.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const frame = (body: React.ReactNode) => (
    <main className="shell-w sec" style={{ maxWidth: 520 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>
      <div className="card p-5">{body}</div>
    </main>
  );

  if (!buyerSearchOn(process.env)) {
    return frame(<p className="t-sm c-3">Invitations are switched off at the moment. Your agent can still help directly.</p>);
  }

  const [inv, session] = await Promise.all([invitationByToken(token), clientSession()]);
  if (!inv.ok || "skipped" in inv) {
    return frame(<>
      <h1 className="serif" style={{ fontSize: 24 }}>We could not check this invitation.</h1>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
        Something on our side is not answering. The link may well be fine; try again in a few minutes.
      </p>
    </>);
  }
  if (!inv.data) {
    return frame(<>
      <h1 className="serif" style={{ fontSize: 24 }}>This invitation link is not valid.</h1>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
        It may have been replaced by a newer one, or already used. If you have signed in before, <a className="u" href="/app">go to your move</a>.
        Otherwise ask your agent for a new link.
      </p>
    </>);
  }
  const i = inv.data;
  const signedIn = session.state === "signed-in";
  const why = signedIn ? acceptError({ email: i.email, acceptedAt: null, revokedAt: null, inviteExpiresAt: null }, session.email) : null;

  return frame(<>
    <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{i.agentName} invited you to &ldquo;{i.journeyLabel}&rdquo;</h1>
    {i.state === "invited" ? (
      <>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
          You will see your search priorities and the homes {i.agentName.split(/\s+/)[0]} shares, and you can confirm
          them, ask for changes and react to homes. This invitation is for {i.maskedEmail}.
        </p>
        <InviteActions token={token} signedIn={signedIn} mismatch={why} masked={i.maskedEmail} />
      </>
    ) : (
      <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
        {i.state === "expired" ? "This invitation has expired." : i.state === "revoked" ? "This invitation was withdrawn." : "This invitation has already been used."}
        {" "}Ask {i.agentName.split(/\s+/)[0]} for a new one{i.state === "active" ? <>, or <a className="u" href="/app">go to your move</a> if it was you</> : null}.
      </p>
    )}
  </>);
}
