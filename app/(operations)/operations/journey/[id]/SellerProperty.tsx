"use client";

import { Fragment } from "react";
import { money } from "@/lib/core/compute";
import type { PropertyFacts } from "@/lib/core/search";
import { useWrite } from "./useWrite";
import { georgiaDay } from "@/lib/core/day";

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
    const n = (k: string) => { const v = String(f.get(k) ?? "").replace(/[^0-9.]/g, ""); return v ? Number(v) : null; };
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
    const facts: [string, string | null][] = [
      ["Bedrooms", x.bedrooms?.toString() ?? null], ["Bathrooms", x.bathrooms?.toString() ?? null], ["Type", x.propertyType],
      ["City", x.city], ["Lot", x.lotAcres !== null ? `${x.lotAcres} acres` : null],
      ["HOA", x.hoaMonthly !== null ? (x.hoaMonthly === 0 ? "None" : `${money(x.hoaMonthly)} a month`) : null],
      ["Basement", x.basement], ["Garage", x.garageSpaces !== null ? `${x.garageSpaces} spaces` : null],
    ];
    return (
      <div>
        <div className="t-md w6">{property.address}</div>
        <dl className="t-sm" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px" }}>
          {facts.map(([k, v]) => <Fragment key={k}><dt className="c-4">{k}</dt><dd className={v ? "" : "c-4"}>{v ?? "Not known"}</dd></Fragment>)}
        </dl>
        <p className="t-xs c-4" style={{ marginTop: 8 }}>From {property.factsSource}, as of {DAY(property.factsAsOf)}. A different claim from another source is kept beside this one, never averaged.</p>
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
            <option value="">Not known</option><option value="single-family">Single-family</option><option value="townhouse">Townhouse</option><option value="condo">Condo</option>
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
