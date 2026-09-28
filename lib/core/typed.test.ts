import { describe, it, expect } from "vitest";
import { typedNumber, typedSignedNumber, unreadableField } from "./typed";

describe("a number a person typed", () => {
  it("reads dollars written the usual ways", () => {
    expect(typedNumber("$350,000")).toBe(350000);
    expect(typedNumber(" 2.5 ")).toBe(2.5);
  });

  it("is null when nothing was typed", () => {
    expect(typedNumber("")).toBeNull();
    expect(typedNumber(null)).toBeNull();
  });

  it("refuses what it cannot read rather than keeping the digits", () => {
    /* Stripping non-digits read "about 350k" as 350 and "3 or 4" as 34. */
    expect(typedNumber("about 350k")).toBeNaN();
    expect(typedNumber("3 or 4")).toBeNaN();
    expect(typedNumber("1.2.3")).toBeNaN();
    expect(typedNumber("-5")).toBeNaN();
  });

  it("names the first field that did not read", () => {
    const f = new FormData();
    f.set("price", "350000");
    f.set("owed", "about 200k");
    expect(unreadableField(f, { price: "The price", owed: "What is owed" })).toBe("What is owed");
    f.set("owed", "");
    expect(unreadableField(f, { price: "The price", owed: "What is owed" })).toBeNull();
  });
});

describe("a number that may be below zero", () => {
  it("reads a leading minus however it was typed", () => {
    expect(typedSignedNumber("-$5,000")).toBe(-5000);
    expect(typedSignedNumber("$-5,000")).toBe(-5000);
    expect(typedSignedNumber("−5,000")).toBe(-5000);
    expect(typedSignedNumber(" 1,250.50 ")).toBe(1250.5);
  });

  it("is null when nothing was typed, and zero is never negative", () => {
    expect(typedSignedNumber("")).toBeNull();
    expect(typedSignedNumber(undefined)).toBeNull();
    expect(Object.is(typedSignedNumber("-0"), 0)).toBe(true);
  });

  it("refuses everything typedNumber refuses", () => {
    expect(typedSignedNumber("about -5k")).toBeNaN();
    expect(typedSignedNumber("5-")).toBeNaN();
    expect(typedSignedNumber("--5")).toBeNaN();
    expect(typedSignedNumber("-")).toBeNaN();
  });

  it("can be the reader a form's fields are checked with", () => {
    const f = new FormData();
    f.set("amount", "-2,500");
    expect(unreadableField(f, { amount: "The amount" })).toBe("The amount");
    expect(unreadableField(f, { amount: "The amount" }, typedSignedNumber)).toBeNull();
  });
});
