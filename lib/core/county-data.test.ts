import { describe, expect, it } from "vitest";
import { COUNTY_TAX, RENTS, countyTax, effectiveTaxPct, rentsFor, taxFor, usable, type CountyTaxRecord } from "./county-data";
import { BUYER_DEFAULTS, cashToClose, monthlyCost } from "./compute";

/* V1 (Kaleb, 13 Oct 2026): drafted records, used only once a named person
   has verified them against their source (handoff §4.13). */
const gwinnett = COUNTY_TAX.find((r) => r.county === "Gwinnett")!;
const verify = (r: CountyTaxRecord): CountyTaxRecord => ({ ...r, verified: { by: "Kaleb Befekadu", on: "2026-10-20" } });

describe("county records", () => {
  it("are all drafts today: none is used until someone verifies it", () => {
    for (const r of COUNTY_TAX) expect(countyTax(r.county)).toBeNull();
    for (const r of RENTS) for (const c of r.counties) expect(rentsFor(c)).toBeNull();
  });

  it("each names its source and either a total or the gap that stops one", () => {
    for (const r of COUNTY_TAX) {
      expect(r.source.url).toMatch(/^https:\/\//);
      expect(r.totalMills !== null || r.gap !== null).toBe(true);
      if (r.totalMills !== null) {
        const sum = r.parts.reduce((s, p) => s + p.mills, 0);
        expect(sum).toBeCloseTo(r.totalMills, 3);
      }
    }
  });

  it("a verified, complete record is used; one without a named person, a date, or with a gap is not", () => {
    expect(countyTax("Gwinnett", [verify(gwinnett)])).not.toBeNull();
    expect(countyTax("Gwinnett", [{ ...gwinnett, verified: { by: " ", on: "2026-10-20" } }])).toBeNull();
    expect(countyTax("Gwinnett", [{ ...gwinnett, verified: { by: "Kaleb Befekadu", on: "soon" } }])).toBeNull();
    expect(countyTax("Gwinnett", [{ ...verify(gwinnett), gap: "a levy is missing" }])).toBeNull();
    const dekalb = COUNTY_TAX.find((r) => r.county === "DeKalb")!;
    expect(countyTax("DeKalb", [{ ...verify(dekalb), gap: null }])).toBeNull();
  });

  it("turns mills into a share of market value on Georgia's 40% assessment", () => {
    expect(effectiveTaxPct(gwinnett)).toBeCloseTo(34.86 * 0.04, 9);
  });

  it("falls back to the planning rate, and says the county's own is not verified yet", () => {
    const t = taxFor("Gwinnett", 1);
    expect(t.pct).toBe(1);
    expect(t.record).toBeNull();
    expect(t.note).toMatch(/not verified yet/);
    const v = taxFor("Gwinnett", 1, [verify(gwinnett)]);
    expect(v.pct).toBeCloseTo(1.3944, 4);
    expect(v.note).toMatch(/Checked by Kaleb Befekadu/);
  });

  it("a rent area with no rents recorded cannot be verified into use", () => {
    const atl = RENTS[0];
    expect(usable({ ...atl, verified: { by: "Kaleb Befekadu", on: "2026-10-20" }, gap: null })).toBe(true);
    expect(rentsFor("Fulton", [{ ...atl, verified: { by: "Kaleb Befekadu", on: "2026-10-20" }, gap: null }])).toBeNull();
  });

  it("once verified, the county moves the cash to close and the monthly payment, which is the whole point", () => {
    const records = [verify(gwinnett)];
    const at = (county: string) => ({ ...BUYER_DEFAULTS, assistance: 0, county, taxPct: taxFor(county, BUYER_DEFAULTS.taxPct, records).pct });
    expect(cashToClose(at("Gwinnett")).total).not.toBeCloseTo(cashToClose(at("Fulton")).total, 2);
    expect(monthlyCost(at("Gwinnett")).tax).toBeCloseTo((325_000 * 1.3944) / 100 / 12, 1);
  });
});
