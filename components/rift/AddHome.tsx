"use client";

import { useState } from "react";
import { EMPTY_FACTS, PROPERTY_TYPES, type PropertyFacts, type PropertyType } from "@/lib/core/search";

export interface HomeInput {
  address: string;
  url: string;
  facts: PropertyFacts;
  factsSource: string;
  factsAsOf: string;
}

const num = (s: string): number | null => {
  const t = s.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
};

/**
 * Adding a home by hand: an address, a link, and whatever facts are known.
 *
 * Blank stays blank. An unknown HOA is stored as unknown, never as $0, so the
 * card can say "not recorded" and the fit can say "still to check" (AT15).
 * Shared by the agent's panel and the buyer's page.
 */
export function AddHome({ onAdd, busy, sourceDefault }: {
  onAdd: (h: HomeInput) => Promise<string | null>;
  busy: boolean;
  sourceDefault: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({
    address: "", url: "", price: "", bedrooms: "", bathrooms: "", type: "", city: "", lot: "", hoa: "",
    basement: "", garage: "", source: sourceDefault, asOf: today,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async () => {
    const facts: PropertyFacts = {
      ...EMPTY_FACTS,
      price: num(v.price), bedrooms: num(v.bedrooms), bathrooms: num(v.bathrooms),
      propertyType: (v.type || null) as PropertyType | null, city: v.city.trim() || null,
      lotAcres: num(v.lot), hoaMonthly: num(v.hoa),
      basement: v.basement === "yes" || v.basement === "no" ? v.basement : null,
      garageSpaces: num(v.garage),
    };
    if (Object.values(facts).some((x) => typeof x === "number" && Number.isNaN(x))) {
      setError("A number field has something that is not a number in it");
      return;
    }
    const err = await onAdd({ address: v.address, url: v.url, facts, factsSource: v.source, factsAsOf: v.asOf });
    setError(err);
    if (!err) setV({ ...v, address: "", url: "", price: "", bedrooms: "", bathrooms: "", type: "", city: "", lot: "", hoa: "", basement: "", garage: "" });
  };

  const f = (label: string, k: keyof typeof v, flex = "1 1 110px", mode: "decimal" | "text" = "decimal") => (
    <label className="field" style={{ flex }}>
      <span className="label">{label}</span>
      <input className="input" inputMode={mode} value={v[k]} onChange={set(k)} />
    </label>
  );

  return (
    <div className="card p-3" style={{ background: "var(--sunk)" }}>
      <div className="row gap-2 wrap">
        {f("Address", "address", "2 1 240px", "text")}
        {f("Listing link (optional)", "url", "2 1 220px", "text")}
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        {f("Price", "price")}
        {f("Beds", "bedrooms", "0 1 80px")}
        {f("Baths", "bathrooms", "0 1 80px")}
        <label className="field" style={{ flex: "1 1 150px" }}>
          <span className="label">Type</span>
          <select className="input" value={v.type} onChange={set("type")}>
            <option value="">Not recorded</option>
            {(Object.keys(PROPERTY_TYPES) as PropertyType[]).map((t) => <option key={t} value={t}>{PROPERTY_TYPES[t]}</option>)}
          </select>
        </label>
        {f("City", "city", "1 1 120px", "text")}
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        <label className="field" style={{ flex: "0 1 130px" }}>
          <span className="label">Basement</span>
          <select className="input" value={v.basement} onChange={set("basement")}>
            <option value="">Not recorded</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        {f("Garage spaces", "garage", "0 1 110px")}
        {f("Lot (acres)", "lot", "0 1 100px")}
        {f("HOA a month", "hoa", "0 1 110px")}
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        {f("Facts came from", "source", "2 1 200px", "text")}
        <label className="field" style={{ flex: "0 1 150px" }}>
          <span className="label">Checked on</span>
          <input className="input" type="date" value={v.asOf} onChange={set("asOf")} />
        </label>
      </div>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
      <button className="btn btn-p btn-sm" style={{ marginTop: 10 }} disabled={busy || !v.address.trim()} onClick={submit}>
        {busy ? "Adding…" : "Add to the list"}
      </button>
      <p className="t-2xs c-4" style={{ marginTop: 6 }}>Leave anything you do not know blank. Blank shows as not recorded, never as zero.</p>
    </div>
  );
}
