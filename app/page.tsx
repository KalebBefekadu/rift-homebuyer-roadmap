import Link from "next/link";

/**
 * The development index.
 *
 * `/` used to be the retired portal MVP's marketing page. Rift's real public
 * landing is specified — see `/prototype/buy` and `/prototype/sell` — and is
 * built in phase 2. Until then this route exists so the root is never a 404
 * and so anybody opening the repo lands somewhere that tells them the truth
 * about what is built and what is specification.
 *
 * Replace this whole file when the real landing ships.
 */

const BUILT = [
  { href: "/buy", name: "Rift for buyers", note: "Answer-first landing, assessment, and the full computed readout. Live." },
  { href: "/buy/programs", name: "Georgia programs", note: "Every assistance program tracked, including closed and stale ones." },
  { href: "/buy/how", name: "How this works", note: "Where the numbers come from, and how Kaleb is paid." },
  { href: "/studio", name: "Studio", note: "The agent surface. Ranked leads, review queue, follow-up, drop-off." },
];

const SPEC = [
  { href: "/prototype/sell", name: "Rift for sellers", note: "Phase 4 — behind the traffic gate in handoff.md §2." },
  { href: "/prototype/app", name: "Client portal", note: "Phase 6. Specified, not built." },
  { href: "/prototype/studio", name: "Studio, in full", note: "Board, offers, calendar, client records — phase 5." },
];

const DOCS = [
  ["docs/handoff.md", "What ships first, build order, the contracts that must not drift"],
  ["docs/integrations.md", "Every external service, what it is for, and what is not wired yet"],
  ["docs/schema.md", "The data model the build targets"],
  ["docs/vision.md", "Why Rift exists and what it refuses to do"],
  ["docs/product.md", "The full product and operating model"],
  ["docs/prototypes.md", "Route map of the specification prototype"],
  ["docs/calculations.md", "The compute contract and its reference case"],
  ["docs/benchmark.md", "The instrument that grades all of it"],
];

export default function Home() {
  return (
    <main style={{
      maxWidth: 760, margin: "0 auto", padding: "64px 24px 96px",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      color: "#1a1a1a", lineHeight: 1.6,
    }}>
      <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Rift</h1>
      <p style={{ fontSize: 17, color: "#555", marginTop: 10 }}>
        A client-experience and agent-operating platform for the residential real-estate
        lifecycle. This is the development root, not the product.
      </p>

      <div style={{
        marginTop: 28, padding: "14px 16px", borderRadius: 10,
        background: "#fff8e6", border: "1px solid #f0dfae", fontSize: 14.5,
      }}>
        <strong>The MVP is buyers only</strong> — phases 1&ndash;3 of{" "}
        <code style={{ background: "#00000010", padding: "1px 5px", borderRadius: 4 }}>docs/handoff.md</code>.
        Seller, portal and referral are specified and deliberately deferred behind a traffic
        gate: 200 completed assessments or 60 days, whichever comes first.
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", marginTop: 40 }}>
        Built
      </h2>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {BUILT.map((p) => (
          <Link key={p.href} href={p.href} style={{
            display: "block", padding: "14px 16px", borderRadius: 10,
            border: "1px solid #e3e3e0", textDecoration: "none", color: "inherit",
          }}>
            <div style={{ fontWeight: 600, fontSize: 15.5 }}>{p.name}</div>
            <div style={{ fontSize: 14, color: "#666", marginTop: 2 }}>{p.note}</div>
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", marginTop: 36 }}>
        Specified, not built
      </h2>
      <p style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
        Still running as the specification under <code>/prototype</code>. A screen leaves there
        when its production replacement is live and has been checked against it.
      </p>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {SPEC.map((p) => (
          <Link key={p.href} href={p.href} style={{
            display: "block", padding: "14px 16px", borderRadius: 10,
            border: "1px dashed #d8d8d4", textDecoration: "none", color: "inherit",
          }}>
            <div style={{ fontWeight: 600, fontSize: 15.5 }}>{p.name}</div>
            <div style={{ fontSize: 14, color: "#666", marginTop: 2 }}>{p.note}</div>
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", marginTop: 36 }}>
        Read in this order
      </h2>
      <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 14.5 }}>
        {DOCS.map(([f, note]) => (
          <li key={f} style={{ marginBottom: 6 }}>
            <code style={{ background: "#00000008", padding: "1px 5px", borderRadius: 4 }}>{f}</code>
            <span style={{ color: "#666" }}> — {note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
