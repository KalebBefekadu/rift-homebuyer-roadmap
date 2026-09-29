import Link from "next/link";
import { Mark } from "@/components/rift/icons";

/**
 * A journey page that is not this person's, or an address cut short.
 *
 * The journey, compare and records pages call `notFound()` for both, on
 * purpose: whether a journey exists is not theirs to know. Before this they
 * landed on the public 404, which offers "Work out my numbers" to somebody
 * who only needed the way back to their own move, and never mentions the
 * one likely cause: signed in with a different address from the one the
 * agent invited.
 */
export default function ClientNotFound() {
  return (
    <main className="shell-w sec" style={{ maxWidth: 520 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>
      <div className="card p-5">
        <h1 className="serif" style={{ fontSize: 24 }}>Nothing to show at this address.</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          This page is not shared with the email you are signed in with, or the link was copied incompletely. If
          your agent invited a different address, sign out and sign in with that one. Otherwise ask your agent.
        </p>
        <div className="row gap-2 wrap" style={{ marginTop: 16 }}>
          <Link href="/app" className="btn btn-p">Go to your move</Link>
          <form action="/app/sign-out" method="post">
            <button className="btn btn-g" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
