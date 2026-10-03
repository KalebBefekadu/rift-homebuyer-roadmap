"use client";

import { money } from "@/lib/core/compute";
import { PROPERTY_TYPES, propertyTypeLabel, type PropertyFacts, type PropertyType } from "@/lib/core/search";
import { Facts } from "../../ui";
import { useWrite } from "./useWrite";
import { georgiaDay } from "@/lib/core/day";
import { typedNumber, unreadableField } from "@/lib/core/typed";

const DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const today = () => georgiaDay();

/**
 * The home being sold (S02): its address and the facts, each set from a
 * named source on a stated day. Stored as the journey's one home, so the
 * contract, its dates and its workstreams work exactly as they do on a
 * purchase. Nothing is averaged or guessed: an unknown fact stays unknown,
 * and a correction is a new record with its own source.
 */
export function SellerProperty({ journeyId, property }: {
  journeyId: string;
  property: { id: string; address: string; facts: PropertyFacts; factsSource: string; factsAsOf: string } | null;
}) {
  const { busy, error, setError, write } = useWrite(property ? `${property.id}:${property.factsAsOf}` : "none");

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const bad = unreadableField(f, { bedrooms: "Bedrooms", bathrooms: "Bathrooms", lotAcres: "The lot size", hoaMonthly: "The HOA fee", garageSpaces: "Garage spaces" });
    if (bad) { setError(`${bad} is not a number`); return; }
    const n = (k: string) => typedNumber(f.get(k));
    const address = String(f.get("address") ?? "").trim();
    if (address.length < 5) { setError("Give the full address"); return; }
    await write("add-home", {
      journeyId,
      home: {
        address, url: "",
        facts: {
          price: null, bedrooms: n("bedrooms"), bathrooms: n("bathrooms"), propertyType: String(f.get("propertyType") || "") || null,
          city: String(f.get("city") ?? "").trim() || null, lotAcres: n("lotAcres"), hoaMonthly: n("hoaMonthly"),
          basement: String(f.get("basement") || "") || null, garageSpaces: n("garageSpaces"),
        },
        factsSource: String(f.get("factsSource") ?? ""), factsAsOf: String(f.get("factsAsOf") ?? ""),
      },
    });
  };

  if (property) {
    const x = property.facts;
    /* In words, never the stored value ("detached", "yes"), and "Not known" for a fact nobody has recorded. */
    const known = (v: string | null): React.ReactNode => v ?? <span className="c-4">Not known</span>;
    const facts: [string, React.ReactNode][] = [
      ["Bedrooms", known(x.bedrooms?.toString() ?? null)], ["Bathrooms", known(x.bathrooms?.toString() ?? null)],
      ["Type of home", known(x.propertyType ? propertyTypeLabel(x.propertyType) : null)],
      ["City", known(x.city)], ["Lot", known(x.lotAcres !== null ? `${x.lotAcres} acres` : null)],
      ["HOA", known(x.hoaMonthly !== null ? (x.hoaMonthly === 0 ? "None" : `${money(x.hoaMonthly)} a month`) : null)],
      ["Basement", known(x.basement === "yes" ? "Yes" : x.basement === "no" ? "No" : null)],
      ["Garage", known(x.garageSpaces !== null ? `${x.garageSpaces} space${x.garageSpaces === 1 ? "" : "s"}` : null)],
    ];
    return (
      <div>
        <div className="t-md w6">{property.address}</div>
        <div style={{ marginTop: 14 }}><Facts items={facts} cols={4} /></div>
        <p className="t-xs c-4" style={{ marginTop: 14 }}>From {property.factsSource}, as of {DAY(property.factsAsOf)}. A different claim from another source is kept beside this one, never averaged.</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="col gap-2">
      <p className="t-sm c-3">Record the home being sold. The contract, its dates and its workstreams hang off it.</p>
      <label className="col gap-1 t-xs">Address<input className="input" name="address" required maxLength={200} placeholder="12 Oak St, Decatur, GA 30030" /></label>
      <div className="g2 gap-2">
        <label className="col gap-1 t-xs">Bedrooms<input className="input" name="bedrooms" inputMode="numeric" /></label>
        <label className="col gap-1 t-xs">Bathrooms<input className="input" name="bathrooms" inputMode="decimal" /></label>
        <label className="col gap-1 t-xs">Type
          <select className="select" name="propertyType" defaultValue="">
            {/* The same types the brief and the shortlist use. This list once offered "single-family", which the facts check refuses. */}
            <option value="">Not known</option>
            {(Object.keys(PROPERTY_TYPES) as PropertyType[]).map((t) => <option key={t} value={t}>{PROPERTY_TYPES[t]}</option>)}
          </select></label>
        <label className="col gap-1 t-xs">City<input className="input" name="city" maxLength={80} /></label>
        <label className="col gap-1 t-xs">Lot, acres<input className="input" name="lotAcres" inputMode="decimal" /></label>
        <label className="col gap-1 t-xs">HOA a month<input className="input" name="hoaMonthly" inputMode="decimal" /></label>
        <label className="col gap-1 t-xs">Basement
          <select className="select" name="basement" defaultValue=""><option value="">Not known</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label className="col gap-1 t-xs">Garage spaces<input className="input" name="garageSpaces" inputMode="numeric" /></label>
        <label className="col gap-1 t-xs">Where the facts come from<input className="input" name="factsSource" required maxLength={200} placeholder="County tax record" /></label>
        <label className="col gap-1 t-xs">As of<input className="input" name="factsAsOf" type="date" required defaultValue={today()} max={today()} /></label>
      </div>
      <div className="row gap-2">
        <button className="btn btn-p btn-sm" disabled={busy}>{busy ? "Saving…" : "Record the property"}</button>
        {error ? <span role="alert" className="t-xs c-neg">{error}</span> : null}
      </div>
    </form>
  );
}
