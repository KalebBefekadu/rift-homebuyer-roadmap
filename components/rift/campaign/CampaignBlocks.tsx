import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { VALUES } from "@/lib/core/values";
import { CAUTION, programsIn, upTo, type ProgramRecord } from "@/lib/core/assistance";
import { PROGRAMS_DISCLAIMER, type Recipe } from "@/lib/core/campaign";

/**
 * A campaign recipe, rendered (CAMP-01). Every block is a fixed component
 * given validated properties; nothing in a recipe is ever rendered as
 * markup. The programs come from the same records as /buy/programs, and a
 * value links to the site's own value, so a campaign can change the words
 * around the figures and never the figures (CAMP-04).
 *
 * `hrefSuffix` carries the campaign and its version onto the values it
 * links to, so a lead's first touch says which page, and which version of
 * it, they started from.
 */
export function CampaignBlocks({ recipe, programs, hrefSuffix }: { recipe: Recipe; programs: ProgramRecord[]; hrefSuffix: string }) {
  return (
    <div className="col gap-6">
      {recipe.blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <header key={i}>
                {i === 0 ? <h1 className="serif d2">{b.title}</h1> : <h2 className="serif" style={{ fontSize: 30 }}>{b.title}</h2>}
                <p className="lede mt-3 measure">{b.lede}</p>
              </header>
            );
          case "text":
            return <p key={i} className="t-md c-2 measure" style={{ lineHeight: 1.65 }}>{b.body}</p>;
          case "value": {
            const v = VALUES.find((x) => x.id === b.valueId);
            if (!v) return null;
            return (
              <Link key={i} href={`${v.href}${hrefSuffix}`} className="card p-6 lift value-card" style={{ borderColor: "var(--brand-line)", background: "var(--brand-wash)", maxWidth: 560 }}>
                <span className="kicker c-brand">{v.name}</span>
                <h2 className="serif" style={{ fontSize: 25, lineHeight: 1.15, letterSpacing: "-0.018em" }}>{v.question}</h2>
                <p className="t-md c-3 grow" style={{ lineHeight: 1.55 }}>{v.gives}</p>
                <span className="btn btn-brand" style={{ alignSelf: "flex-start" }}>{v.cta}<Ico.arrowR size={15} /></span>
              </Link>
            );
          }
          case "cta": {
            const v = VALUES.find((x) => x.id === b.valueId);
            if (!v) return null;
            return <Link key={i} href={`${v.href}${hrefSuffix}`} className="btn btn-brand btn-lg" style={{ alignSelf: "flex-start" }}>{b.label}<Ico.arrowR size={15} /></Link>;
          }
          case "programs": {
            const list = programsIn(programs, b.county).sort((x, y) => upTo(y).n - upTo(x).n);
            return (
              <section key={i} aria-label={`Georgia programs in ${b.county} County`}>
                <h2 className="serif" style={{ fontSize: 26 }}>Programs for homes in {b.county} County</h2>
                {list.length ? (
                  <ul className="col gap-2 mt-3">
                    {list.map((p) => (
                      <li key={p.slug} className="card p-4 between wrap gap-3">
                        <div style={{ minWidth: 0 }}>
                          <div className="t-md w6">{p.name}</div>
                          <div className="t-sm c-3">{p.administrator} · {upTo(p).label}</div>
                        </div>
                        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-g btn-sm" aria-label={`Official source for ${p.name}`}>Official page<Ico.arrowUpR size={12} /></a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="t-md c-3 mt-3">No program records are current for this county right now; some are being checked again.</p>}
                {/* Always carried, never editable. */}
                <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>{PROGRAMS_DISCLAIMER} {CAUTION}</p>
              </section>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
