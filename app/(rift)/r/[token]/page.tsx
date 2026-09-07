import type { Metadata } from "next";
import Link from "next/link";
import { readByToken } from "@/lib/db/assessments";
import { money } from "@/lib/core/compute";
import { Trust } from "@/components/rift/Trust";
import { Ico, Mark } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "A shared readout",
  /* Never indexed. It is somebody's finances behind an unguessable link, and a
     link that is unguessable to a person is trivially findable by a crawler
     that has been given it. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A readout, opened by its share token.
 *
 * The snapshot is rendered exactly as it was saved — no recomputation. Six
 * weeks later the arithmetic would give a different answer, and this page
 * exists to show what the person was actually told on the day. A shared
 * document that silently updates itself is not the thing they shared.
 *
 * What it does do is say how old it is, because a figure without a date is a
 * figure pretending not to have expired.
 */
export default async function SharedReadout({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const read = await readByToken(token);
  const snap = read.ok && "data" in read ? read.data : null;

  if (!snap) {
    return (
      <main className="shell-w sec buy">
        <h1 className="serif" style={{ fontSize: 28 }}>That link has expired or never existed.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Readouts are kept for a limited time, and can be deleted by the person who made them
          at any point. You can work out your own in about four minutes.
        </p>
        <Link href="/buy/start" className="btn btn-p" style={{ marginTop: 16 }}>Work out mine<Ico.arrowR size={14} /></Link>
      </main>
    );
  }

  const figures = snap.figures as Record<string, number | string>;
  const created = new Date(snap.createdAt);
  const days = Math.floor((Date.now() - created.getTime()) / 86_400_000);

  return (
    <div className={snap.side}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/buy" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></Link>
          <Link href="/buy/start" className="btn btn-g btn-sm">Work out mine</Link>
        </div>
      </header>

      <main className="shell-w sec">
        <div className="row gap-2 wrap">
          <span className="chip">Shared with you</span>
          <Trust state="preliminary" />
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 1.14, letterSpacing: "-0.02em", marginTop: 14, maxWidth: 700 }}>
          {String(figures.verdict ?? "A readout")}
        </h1>

        <div className="card p-4" style={{ marginTop: 18, maxWidth: 620, background: "var(--sunk)" }}>
          <div className="row gap-2">
            <Ico.clock size={14} className="c-3" />
            <span className="t-sm w6">
              Worked out {days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}, and
              not updated since.
            </span>
          </div>
          <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            This is the document as it was on {created.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            Rates and program terms move; it is shown unchanged on purpose, because it is what
            they were actually told rather than what we would say today.
          </p>
        </div>

        {/* Each figure with how sure anybody is about it.
            
            The numbers are frozen — that is what a snapshot is. What can change
            is whether somebody has since been through them, and that is the one
            update a shared readout should carry: it is the difference between
            "we worked this out" and "a person checked it". */}
        <div className="card glance" style={{ marginTop: 20, overflow: "hidden" }}>
          {snap.stored.length
            ? snap.stored.map((f) => (
                <div key={f.label} style={{ padding: "16px 18px" }}>
                  <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{f.label}</div>
                  <div className="num" style={{ fontSize: "clamp(17px,2vw,24px)", marginTop: 5 }}>
                    {money(f.valueCents / 100)}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Trust state={f.trustState} short />
                  </div>
                  {f.confirmedBy ? (
                    <div className="t-2xs c-4" style={{ marginTop: 4 }}>Confirmed by {f.confirmedBy}</div>
                  ) : null}
                </div>
              ))
            : [
                ["Cash to close", figures.cashToClose],
                ["All-in monthly", figures.monthly],
                ["Still to find", figures.gap],
                ["Assistance, if approved", figures.assistance],
              ].filter(([, v]) => v !== undefined).map(([label, v]) => (
                <div key={String(label)} style={{ padding: "16px 18px" }}>
                  <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{String(label)}</div>
                  <div className="num" style={{ fontSize: "clamp(17px,2vw,24px)", marginTop: 5 }}>
                    {typeof v === "number" ? money(v) : String(v)}
                  </div>
                </div>
              ))}
        </div>

        <div className="card p-5" style={{ marginTop: 24, maxWidth: 620 }}>
          <div className="t-sm w6">Your situation is not theirs</div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
            These figures were worked out from one person&apos;s answers. Yours takes about four
            minutes and costs nothing.
          </p>
          <Link href="/buy/start" className="btn btn-p" style={{ marginTop: 14 }}>
            Work out mine<Ico.arrowR size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}
