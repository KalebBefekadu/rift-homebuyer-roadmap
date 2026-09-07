import type { Metadata } from "next";
import Link from "next/link";
import { readRegistry } from "@/lib/db/programs";
import { range } from "@/lib/core/compute";
import { FUNDING_LABEL, TYPE_LABEL, daysSinceVerified } from "@/lib/core/registry";
import { Ico, Mark } from "@/components/rift/icons";
import { Trust } from "@/components/rift/Trust";

export const metadata: Metadata = {
  title: "Georgia homebuyer assistance programs",
  description:
    "Every Georgia down-payment assistance program Rift tracks, with what each one asks of you, who administers it, and when it was last verified — including the ones that are closed.",
};

export const revalidate = 3600;

/**
 * The whole registry, including what is closed and what is stale.
 *
 * This is the "just show me the programs" door — the visitor who is not ready
 * to answer seven questions but is ready to read. Sending that person into an
 * assessment is how you lose them.
 *
 * Closed and waitlisted programmes are shown WITH their state rather than
 * hidden, because somebody planning around money that is not currently
 * available needs to know that it is not available. Stale ones are shown here
 * too, clearly marked, for a different reason: this page is a claim about our
 * own diligence, and hiding the gaps in it would make that claim false.
 */
export default async function ProgramsPage() {
  const read = await readRegistry(new Date());
  const data = read.ok && "data" in read ? read.data : null;

  if (!data) {
    return (
      <main className="shell-w sec buy">
        <h1 className="serif" style={{ fontSize: 28 }}>The program list is briefly unavailable.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          We would rather show you nothing than a list we cannot currently stand behind.
        </p>
        <Link href="/buy" className="btn btn-g" style={{ marginTop: 16 }}>Back</Link>
      </main>
    );
  }

  const all = [...data.programs, ...data.suppressed];
  const open = data.programs.filter((p) => p.funding === "open");

  return (
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/buy" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></Link>
          <Link href="/buy/start" className="btn btn-p btn-sm">Get my numbers</Link>
        </div>
      </header>

      <main className="shell-w sec">
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em", maxWidth: 700 }}>
          Every Georgia program we track
        </h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: 620 }}>
          {all.length} programs, {open.length} currently open. Amounts are estimated ranges with
          conditions attached — never approvals. A participating lender is the only party who
          can confirm what you actually qualify for.
        </p>

        <div className="col gap-2" style={{ marginTop: 24 }}>
          {all.map((p) => {
            const stale = data.suppressed.some((s) => s.id === p.id);
            const age = daysSinceVerified(p, new Date());
            return (
              <div key={p.id} className="card p-4" style={{ opacity: stale ? 0.72 : 1 }}>
                <div className="between wrap gap-2">
                  <div className="grow" style={{ minWidth: 220 }}>
                    <div className="row gap-2 wrap">
                      <span className="t-md w6">{p.name}</span>
                      <span className={`chip ${p.funding === "open" ? "chip-pos" : p.funding === "waitlist" ? "chip-warn" : "chip-neg"}`}>
                        {FUNDING_LABEL[p.funding]}
                      </span>
                      <span className="chip">{TYPE_LABEL[p.type]}</span>
                      {p.county ? <span className="chip">{p.county} County</span> : <span className="chip">Statewide</span>}
                      {p.firstTimeOnly ? <span className="chip">First-time buyers</span> : null}
                    </div>
                    <div className="t-xs c-4" style={{ marginTop: 4 }}>{p.administrator}</div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div className="num t-lg c-brand">{range(p.min, p.max)}</div>
                    <div className="t-2xs c-4">estimated range</div>
                  </div>
                </div>

                <div className="col gap-1" style={{ marginTop: 12 }}>
                  {[p.incomeLimitNote, p.priceCapNote, ...p.conditions].map((c) => (
                    <div key={c} className="row gap-2" style={{ alignItems: "flex-start" }}>
                      <Ico.check size={12} className="c-4" style={{ flex: "none", marginTop: 3 }} />
                      <span className="t-xs c-3" style={{ lineHeight: 1.5 }}>{c}</span>
                    </div>
                  ))}
                </div>

                {p.reopens ? (
                  <p className="t-xs c-3 row gap-2" style={{ marginTop: 10 }}>
                    <Ico.clock size={11} style={{ flex: "none", marginTop: 2 }} />{p.reopens}
                  </p>
                ) : null}

                <div className="row gap-2 wrap" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                  {stale ? (
                    <>
                      <span className="chip chip-warn"><Ico.alert size={10} />Not re-checked in {age} days</span>
                      <span className="t-2xs c-4">
                        Withheld from matching until we confirm it again. Shown here so you can see
                        the gap rather than be quietly given less.
                      </span>
                    </>
                  ) : (
                    <>
                      <Trust state="verified" short />
                      <span className="t-2xs c-4">
                        Terms confirmed with {p.verifiedBy} on {p.verifiedOn}, {age} days ago.
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card p-5" style={{ marginTop: 24, background: "var(--sunk)", maxWidth: 620 }}>
          <div className="t-sm w6">Which of these you can actually use depends on your numbers</div>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Income limits, purchase-price caps and first-time status decide most of it. Seven
            questions works that out and tells you what it does to your timeline.
          </p>
          <Link href="/buy/start" className="btn btn-p" style={{ marginTop: 14 }}>
            Work out mine<Ico.arrowR size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}
