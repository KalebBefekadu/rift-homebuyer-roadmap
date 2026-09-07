import Link from "next/link";
import "./prototype/rift.css";

/**
 * Not found, for the whole app.
 *
 * This lives at the root rather than inside the `(rift)` group because Next
 * only uses a group's `not-found` for an explicit `notFound()` call inside that
 * segment. An unmatched URL — which is every real 404 — falls through to here,
 * and a group-scoped version silently never renders. It was written in the
 * group first, and Next's default grey "This page could not be found" was
 * served instead, which is exactly the sort of thing that ships unnoticed.
 *
 * Every route out is a real one. A 404 offering only "go home" wastes the one
 * moment somebody is still willing to look for what they wanted.
 */
export default function NotFound() {
  return (
    <div className="rift">
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      <main className="shell-w sec buy">
        <h1 className="serif" style={{ fontSize: "clamp(24px,3.2vw,36px)", letterSpacing: "-0.02em", maxWidth: 620 }}>
          That page does not exist.
        </h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: 560 }}>
          It may have been a shared readout that has since been deleted — they can be removed by
          the person who made them at any time.
        </p>
        <div className="row gap-2 wrap" style={{ marginTop: 20 }}>
          <Link href="/buy/start" className="btn btn-p">Work out my numbers</Link>
          <Link href="/buy/programs" className="btn btn-g">Georgia programs</Link>
          <Link href="/buy/how" className="btn btn-g">How this works</Link>
        </div>
      </main>
    </div>
  );
}
