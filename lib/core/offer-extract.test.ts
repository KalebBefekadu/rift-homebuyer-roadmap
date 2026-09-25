import { describe, expect, it } from "vitest";
import { acceptCandidates, isPdf, readableFrom, EXTRACT_SCHEMA, EXTRACT_FIELDS } from "./offer-extract";

const c = (field: string, value: string, page = 1, quote = `the ${field} is ${value}`) => ({ field, value, page, quote });

/* DOC-02: candidates with exact sources; a person confirms; failure is manual. */
describe("reading an offer", () => {
  it("keeps a candidate only with a page and the words it was read from", () => {
    const x = acceptCandidates({ readable: true, found: [
      c("price", "410000"),
      { field: "earnest", value: "5000", page: 0, quote: "earnest 5000" },
      { field: "address", value: "119 Peachtree Way, Atlanta, GA 30309", page: 1, quote: "" },
    ] });
    expect(x.price).toBe(410_000);
    expect(x.sources.price).toEqual({ page: 1, quote: "the price is 410000" });
    expect(x.earnest).toBeUndefined();
    expect(x.address).toBeUndefined();
    expect(x.dropped).toBe(2);
  });

  it("checks each value as if a stranger typed it", () => {
    const x = acceptCandidates({ readable: true, found: [
      c("price", "12"), c("closeOn", "2026-02-30"), c("dueDiligenceDays", "90"),
      c("financing", "seller carry"), c("concessions", "3%"),
    ] });
    expect(x.price).toBeUndefined();
    expect(x.closeOn).toBeUndefined();
    expect(x.dueDiligenceDays).toBeUndefined();
    expect(x.financing).toBeUndefined();
    expect(x.concessions).toBeUndefined();
    expect(x.dropped).toBe(5);
  });

  it("reads money with symbols and commas, and dates and days as the form wants them", () => {
    const x = acceptCandidates({ readable: true, found: [
      c("price", "$410,000.00"), c("closeOn", "2026-11-14"), c("dueDiligenceDays", "10"), c("financing", "FHA"),
    ] });
    expect(x).toMatchObject({ price: 410_000, closeOn: "2026-11-14", dueDiligenceDays: 10, financing: "fha" });
  });

  it("takes the first reading of a term, and ticks only the form's own contingencies", () => {
    const x = acceptCandidates({ readable: true, found: [
      c("price", "410000"), c("price", "999000"),
      c("contingency", "inspection"), c("contingency", "Appraisal"), c("contingency", "Kick-out clause"),
    ] });
    expect(x.price).toBe(410_000);
    expect(x.contingencies).toEqual(["Inspection", "Appraisal"]);
  });

  it("drops a financing detail unless the financing is 'other'", () => {
    expect(acceptCandidates({ readable: true, found: [c("financing", "cash"), c("financingDetail", "wire")] }).financingDetail).toBeUndefined();
    expect(acceptCandidates({ readable: true, found: [c("financing", "other"), c("financingDetail", "Seller financing")] }).financingDetail).toBe("Seller financing");
  });

  it("treats anything but an explicit readable: true as unreadable", () => {
    expect(readableFrom({ readable: true, found: [] })).toBe(true);
    expect(readableFrom({ found: [] })).toBe(false);
    expect(readableFrom(null)).toBe(false);
  });

  it("recognises a PDF by its bytes, not its name", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("<html>"))).toBe(false);
  });

  it("asks the model for exactly the fields it knows how to check", () => {
    const f = EXTRACT_SCHEMA.properties.found.items.properties.field.enum;
    expect([...f]).toEqual([...EXTRACT_FIELDS]);
  });
});
