import { describe, it, expect } from "vitest";
import { buildOfferChosen } from "./email";

const base = {
  to: "k@example.com", seller: "Nadia Okafor", from: "The Whitfields", price: 400_000,
  net: 196_925, bestNet: true, of: 3, note: null, studioUrl: "https://example.com/operations/lead/1",
};

describe("the alert that a seller chose an offer", () => {
  it("says who, which offer, and what reached them", () => {
    const { subject, html } = buildOfferChosen(base);
    expect(subject).toBe("Nadia Okafor chose the offer from The Whitfields");
    expect(html).toMatch(/\$196,925/);
    expect(html).toMatch(/best net of the 3/);
  });

  it("says plainly that it is not an acceptance", () => {
    /* The words in his inbox should match the words on the seller's page. */
    expect(buildOfferChosen(base).html).toMatch(/not an acceptance/);
  });

  it("does not invent a net that was never shown", () => {
    const { html } = buildOfferChosen({ ...base, net: null, bestNet: null });
    expect(html).toMatch(/No net was shown/);
    expect(html).not.toMatch(/best net/);
  });

  it("escapes the seller's own words", () => {
    const { html } = buildOfferChosen({ ...base, note: '<img src=x onerror="alert(1)">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
