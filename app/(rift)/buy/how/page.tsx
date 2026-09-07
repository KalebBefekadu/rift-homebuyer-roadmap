import type { Metadata } from "next";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { RETENTION } from "@/lib/core/privacy";

export const metadata: Metadata = {
  title: "How this works",
  description: "What Rift does, what it will not do, how the numbers are worked out, and how it makes money.",
};

/**
 * The third door: "just tell me how this works".
 *
 * Written for the sceptical reader, because the sceptical reader is the one
 * worth converting — somebody who wants to know how a free tool makes money
 * before they use it is somebody who will still be a client in five years.
 *
 * It says how Rift is paid in plain terms. A page about trust that avoids the
 * commercial question is the least trustworthy page on a site.
 */
export default function HowPage() {
  return (
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/buy" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></Link>
          <Link href="/buy/start" className="btn btn-p btn-sm">Get my numbers</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          How this works
        </h1>

        <Block title="Where the numbers come from">
          <p>
            Every figure you see is <strong>calculated</strong>, from the answers you give and
            published Georgia program terms. Nothing is written by a language model, and nothing
            is an estimate somebody typed. The same arithmetic runs for everybody, which is why
            it can be free.
          </p>
          <p>
            Each figure carries what it assumes and where it could be wrong. If you cannot see
            those two things next to a number, we have made a mistake.
          </p>
        </Block>

        <Block title="What it will not do">
          <ul>
            <li>It will not tell you that you qualify for anything. A lender decides that.</li>
            <li>It will not count assistance money in your headline figure, because that money is not yours until somebody approves it.</li>
            <li>It will not show you a program we have not re-checked recently, even if that makes the list shorter.</li>
            <li>It will not ask for your credit score, your social security number, or your bank login. Ever.</li>
          </ul>
        </Block>

        <Block title="How Kaleb gets paid">
          <p>
            Nothing here costs you anything, and none of it is a trial. Kaleb is a licensed
            Georgia agent and is paid a commission when somebody he represents buys or sells a
            home — the ordinary way agents are paid, disclosed in a written agreement before it
            applies to you.
          </p>
          <p>
            He is <strong>not</strong> paid by any lender, program administrator, or vendor named
            on this site, and no program pays to appear in your results. If that ever changes it
            will be written on this page before it is true anywhere else.
          </p>
        </Block>

        <Block title="What we keep">
          <p>
            Your answers, so your readout still works when you come back, and which questions
            people stop on, so the questions can be improved. Never what you typed against those
            questions — those are two different records with two different lifetimes.
          </p>
          <ul>
            {RETENTION.map((r) => (
              <li key={r.id}><strong>{r.what}</strong> — {r.keptFor.toLowerCase()}. {r.why}</li>
            ))}
          </ul>
          <p>
            You can delete all of it from the bottom of your readout, in one click, without an
            account and without asking anyone.
          </p>
        </Block>

        <Block title="Why there is no account">
          <p>
            Because an account is a thing you have to be persuaded to make, and it would be the
            first thing standing between you and a number you should already have. You can share
            your readout as a link, keep it, and come back to it on the same device without
            signing up for anything.
          </p>
        </Block>

        <div className="card p-5" style={{ marginTop: 28, background: "var(--sunk)" }}>
          <div className="t-sm w6">Seven questions, about four minutes</div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
            You keep the result whether or not you ever speak to us.
          </p>
          <Link href="/buy/start" className="btn btn-p" style={{ marginTop: 14 }}>
            Start<Ico.arrowR size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="serif" style={{ fontSize: "clamp(19px,2.4vw,26px)", letterSpacing: "-0.02em" }}>{title}</h2>
      <div className="t-sm c-2 how-body" style={{ marginTop: 10, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}
