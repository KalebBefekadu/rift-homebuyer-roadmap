import { money } from "@/lib/core/compute";
import { fitOf, PROPERTY_TYPES, REACTION_LABEL, type PropertyFacts, type Reaction, type SearchCriterion } from "@/lib/core/search";

export interface HomeCardData {
  id: string;
  address: string;
  url: string | null;
  facts: PropertyFacts;
  factsSource: string;
  factsAsOf: string;
  addedBy: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  current: { memberId: string | null; who: string; reaction: Reaction; reason: string | null; at: string }[];
  historyCount: number;
}

const DAY = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  .toLocaleDateString("en-US", { month: "short", day: "numeric" });

const FIT_MARK = { meets: "✓", misses: "✗", unknown: "?", manual: "check" } as const;

/**
 * One home on a shortlist, for the agent and for the buyer alike.
 *
 * Facts show their source and date, a missing fact says "not recorded" rather
 * than disappearing, and fit is a list of requirements met, missed or still to
 * check. There is no score: "meets 3 of 4, basement unconfirmed" can be
 * checked by the buyer; a percentage cannot (REQ-SEARCH-04/05, AT15).
 */
export function HomeCard({ home, criteria, children }: {
  home: HomeCardData;
  /** The requirements to compare against. Empty when nothing is approved yet. */
  criteria: SearchCriterion[];
  children?: React.ReactNode;
}) {
  const f = home.facts;
  const fit = fitOf(f, criteria);
  const fact = (label: string, v: string | null) => (
    <span className="t-xs"><span className="c-4">{label}</span> {v ?? <span className="c-4">not recorded</span>}</span>
  );
  return (
    <article className="card p-3" style={{ opacity: home.withdrawnAt ? 0.65 : 1 }}>
      <div className="between gap-2 wrap" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="t-sm w6">{home.address}</div>
          <div className="t-2xs c-4" style={{ marginTop: 2 }}>
            Facts from {home.factsSource}, {DAY(home.factsAsOf)} · added by {home.addedBy}
            {home.url ? <> · <a className="u" href={home.url} target="_blank" rel="noreferrer noopener">listing</a></> : null}
          </div>
        </div>
        {home.withdrawnAt ? <span className="chip t-2xs">Off the list: {home.withdrawnReason}</span> : null}
      </div>

      <div className="row gap-3 wrap" style={{ marginTop: 8 }}>
        {fact("Price", f.price !== null ? money(f.price) : null)}
        {fact("Beds", f.bedrooms !== null ? String(f.bedrooms) : null)}
        {fact("Baths", f.bathrooms !== null ? String(f.bathrooms) : null)}
        {fact("Type", f.propertyType ? PROPERTY_TYPES[f.propertyType] : null)}
        {fact("City", f.city)}
        {fact("Basement", f.basement)}
        {fact("Garage", f.garageSpaces !== null ? String(f.garageSpaces) : null)}
        {fact("Lot", f.lotAcres !== null ? `${f.lotAcres} ac` : null)}
        {fact("HOA", f.hoaMonthly !== null ? `${money(f.hoaMonthly)}/mo` : null)}
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="t-xs w6">{fit.summary}</div>
        {fit.lines.length ? (
          <ul className="t-xs c-3" style={{ marginTop: 3, display: "grid", gap: 2 }}>
            {fit.lines.map((l) => (
              <li key={l.criterionId}>
                <span aria-hidden="true" style={{ display: "inline-block", minWidth: 34 }}>{FIT_MARK[l.fit]}</span>
                <span className="sr-only">{l.fit === "meets" ? "Meets" : l.fit === "misses" ? "Misses" : l.fit === "unknown" ? "Unknown" : "Check by hand"}: </span>
                {l.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {home.current.length ? (
        <ul style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {home.current.map((r) => (
            <li key={`${r.memberId ?? r.who}`} className="t-xs">
              <span className="w6">{r.who}</span>: {REACTION_LABEL[r.reaction]}
              {r.reason ? <span className="c-3"> &ldquo;{r.reason}&rdquo;</span> : null}
              <span className="c-4"> · {DAY(r.at)}</span>
            </li>
          ))}
          {home.historyCount > home.current.length ? (
            <li className="t-2xs c-4">{home.historyCount - home.current.length} earlier reaction{home.historyCount - home.current.length === 1 ? "" : "s"} kept in the history.</li>
          ) : null}
        </ul>
      ) : (
        <p className="t-2xs c-4" style={{ marginTop: 8 }}>No reactions yet.</p>
      )}
      {children}
    </article>
  );
}
