import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAgent } from "@/lib/db/session";
import { readWording } from "@/lib/db/funnel";
import { BUY_FUNNEL, SELL_FUNNEL, type Wording } from "@/lib/core/funnel";
import { Ico, Mark } from "@/components/rift/icons";
import { Editor } from "./Editor";

export const metadata: Metadata = { title: "Your questions", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The questions, in the agent's own words.
 *
 * The funnel definition has always lived in code, and `readFunnel` read a row
 * from the database and then deliberately ignored it — with a note saying that
 * reading a stored copy "would only add a way for the stored copy to drift
 * from the engine".
 *
 * That was the right worry and the wrong conclusion. The fix is not to refuse
 * to read; it is to make drift impossible. Only the words are stored: the
 * title, the note beneath it, the field label, and the LABEL on each option.
 * The key, the field type, what it is bound to, the machine value behind an
 * option, whether it is required — all of those come from
 * `lib/core/funnel.ts`, and nothing on this page can reach them.
 *
 * So the worst an edit here can do is produce a badly worded question. It
 * cannot produce a wrong number, which is the only kind of mistake this
 * product cannot survive.
 */
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const agent = await currentAgent();
  if (!agent) redirect("/studio/sign-in");

  const sp = await searchParams;
  const raw = Array.isArray(sp.side) ? sp.side[0] : sp.side;
  const side: "buy" | "sell" = raw === "sell" ? "sell" : "buy";
  const definition = side === "buy" ? BUY_FUNNEL : SELL_FUNNEL;

  const read = await readWording(side);
  const stored: Record<string, Wording> = read.ok && "data" in read ? read.data : {};
  const unsaved = !read.ok || "skipped" in read;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/studio" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
            <span className="chip chip-out t-2xs">Studio</span>
          </Link>
          <Link href="/studio" className="t-sm c-3">← Today</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 760 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,32px)", letterSpacing: "-0.02em" }}>
          Your questions
        </h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 580 }}>
          The wording a stranger reads, in your voice rather than ours. What each question
          <em> does</em> is fixed — these feed the arithmetic, and a question that stopped
          collecting what it collects would produce a readout about nobody.
        </p>

        <div className="row gap-2" style={{ marginTop: 18 }}>
          <Link href="/studio/questions?side=buy" className={`btn btn-sm ${side === "buy" ? "btn-p" : "btn-g"}`}>
            Buyers
          </Link>
          <Link href="/studio/questions?side=sell" className={`btn btn-sm ${side === "sell" ? "btn-p" : "btn-g"}`}>
            Sellers
          </Link>
          <span className="t-xs c-4" style={{ marginLeft: 6 }}>Version {definition.version}</span>
        </div>

        {unsaved ? (
          <div className="card p-4" style={{ marginTop: 16, background: "var(--sunk)" }}>
            <div className="row-t gap-2">
              <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
              <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                Nothing has been published yet, so these are the words the product shipped with.
                Editing one and publishing makes it yours.
              </p>
            </div>
          </div>
        ) : null}

        <Editor side={side} funnel={definition} stored={stored} />

        <div className="card p-4" style={{ marginTop: 24 }}>
          <div className="row-t gap-2">
            <Ico.shield size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
            <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
              Publishing creates a new version. Anybody who already answered stays pinned to the
              words they actually read — their readout does not quietly start describing questions
              they were never asked.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
