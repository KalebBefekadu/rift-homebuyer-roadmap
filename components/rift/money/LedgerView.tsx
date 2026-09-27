import { money } from "@/lib/core/compute";
import { PROVENANCE_LABEL, type Bucket, type Ledger, type LedgerLine } from "@/lib/core/ledger";

const DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/* A word and a mark for where each figure came from, never colour alone. */
const MARK: Record<LedgerLine["provenance"], string> = { estimate: "≈", answer: "•", recorded: "✓" };

function Line({ l }: { l: LedgerLine }) {
  return (
    <li className="between gap-3" style={{ padding: "6px 0", borderTop: "1px solid var(--line-3)", alignItems: "baseline" }}>
      <span style={{ minWidth: 0 }}>
        <span className="t-sm">{l.credit ? "Less: " : ""}{l.label}</span>
        <span className="t-xs c-4" style={{ display: "block" }}>
          <span aria-hidden>{MARK[l.provenance]} </span>{PROVENANCE_LABEL[l.provenance]}{l.source ? `: ${l.source}` : ""}{l.note ? `. ${l.note}` : ""}
        </span>
      </span>
      <span className="num t-sm" style={{ flex: "none" }}>{l.credit ? `−${money(l.amount)}` : money(l.amount)}</span>
    </li>
  );
}

function Box({ b, strong }: { b: Omit<Bucket, "amount"> & { amount: number | null }; strong?: boolean }) {
  return (
    <section className="card p-4" aria-labelledby={`b-${b.key}`}>
      <div className="between gap-2" style={{ alignItems: "baseline" }}>
        <h3 id={`b-${b.key}`} className={strong ? "t-md w6" : "t-sm w6"}>{b.label}</h3>
        <span className={`num ${strong ? "t-lg w6" : "t-md"} ${b.amount !== null && b.amount < 0 ? "c-warn" : ""}`}>
          {b.amount === null ? "Not known" : b.amount < 0 ? `−${money(-b.amount)}` : money(b.amount)}
        </span>
      </div>
      <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.5 }}>{b.says}</p>
      {b.lines.length ? <ul style={{ marginTop: 6 }}>{b.lines.map((l) => <Line key={l.label} l={l} />)}</ul> : null}
    </section>
  );
}

/**
 * The buyer's ledger (money v2, Blueprint v5 §10.1): what is paid before
 * closing, what is brought to the table, the total, what savings leave and a
 * suggested reserve, each line saying where it came from. The official cash
 * to close, when recorded, stands on its own and is never mixed with the
 * estimate. Used on the journey in Operations and on the client's journey.
 */
export function LedgerView({ l, audience }: { l: Ledger; audience: "agent" | "client" }) {
  return (
    <div className="col gap-3">
      {l.official ? (
        <section className="card p-4" style={{ borderColor: "var(--line)" }} aria-labelledby="b-official">
          <div className="between gap-2" style={{ alignItems: "baseline" }}>
            <h3 id="b-official" className="t-md w6">✓ Cash to close, from the closing disclosure</h3>
            <span className="num t-lg w6">{money(l.official.amount)}</span>
          </div>
          <p className="t-xs c-3" style={{ marginTop: 4 }}>
            Official: {l.official.source}, {DAY(l.official.asOf)}. It is the figure to bring to closing; the estimate below
            {Math.abs(l.official.difference) < 1 ? " matches it." : ` was ${money(Math.abs(l.official.difference))} ${l.official.difference > 0 ? "lower" : "higher"}.`}
          </p>
        </section>
      ) : null}
      <div className="g2 gap-3">
        <Box b={l.before} />
        <Box b={l.table} />
      </div>
      <div className="g2 gap-3">
        <Box b={l.total} strong />
        <Box b={l.left} strong />
      </div>
      <Box b={l.reserve} />
      {l.moving ? (
        <p className="t-sm c-3">Moving, {money(l.moving.amount)} ({l.moving.source}): not paid at closing, so outside every figure above.</p>
      ) : null}
      <p className="t-xs c-4" style={{ lineHeight: 1.6 }}>
        {l.estimated ? `${l.estimated} of these figures ${l.estimated === 1 ? "is" : "are"} still Rift's estimate (≈). ` : ""}
        {l.couldBeWrong} {audience === "client" ? "Assistance appears here only once it is approved." : "Assistance enters only when you record it as approved, with who approved it."} Money v{l.version}.
      </p>
    </div>
  );
}
