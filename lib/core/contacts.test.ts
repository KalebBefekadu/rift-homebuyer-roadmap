import { describe, it, expect } from "vitest";
import { cleanContact, contactKey } from "./contacts";

describe("a contract contact (audit portals-2026-10, decision 3)", () => {
  it("keeps a real address, lower-cased, and refuses anything else", () => {
    expect(cleanContact(" Dana at Peach ", " Dana@PeachMortgage.com ")).toEqual({ name: "Dana at Peach", email: "dana@peachmortgage.com" });
    expect(cleanContact(null, "not an address")).toBeNull();
    expect(cleanContact("", "a@b")).toBeNull();
  });
  it("is keyed by contract and workstream", () => {
    expect(contactKey("t1", "title")).toBe("t1:title");
  });
});
