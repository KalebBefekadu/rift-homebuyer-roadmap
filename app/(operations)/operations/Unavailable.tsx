import Link from "next/link";
import { Ico } from "@/components/rift/icons";

/**
 * "We could not check whether you are signed in."
 *
 * The page an agent sees instead of a sign-in form when the session check did
 * not answer. The distinction is the whole point: a sign-in form tells him his
 * session expired, and it had not: the cookie is still in his browser and the
 * next request will almost certainly work.
 *
 * It matters most on the request most likely to be slow. A cold start plus a
 * round trip to Supabase's auth service is exactly when the two-second
 * deadline is missed, and that is the first thing he does in the morning.
 */
export function Unavailable({ reason }: { reason: string }) {
  return (
    <main className="shell-w sec" style={{ maxWidth: 560 }}>
      <div className="row gap-2">
        <Ico.alert size={18} className="c-warn" />
        <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          We could not check your sign-in.
        </h1>
      </div>
      <p className="t-sm c-3" style={{ marginTop: 12, lineHeight: 1.65 }}>
        This is not the same as being signed out; you almost certainly still are. Something on
        our side did not answer in time, which usually clears on the next try.
      </p>
      <p className="t-xs c-4" style={{ marginTop: 10 }}>{reason}.</p>
      <div className="row gap-2 wrap" style={{ marginTop: 18 }}>
        {/* A link to the same place, not a form. Reloading is the fix and
            saying so is better than a button that pretends to do more. */}
        <Link href="/operations" className="btn btn-p">Try again</Link>
        <Link href="/operations/sign-in" className="btn btn-g">Sign in anyway</Link>
      </div>
    </main>
  );
}
