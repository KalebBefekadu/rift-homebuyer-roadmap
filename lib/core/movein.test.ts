import { describe, it, expect } from "vitest";
import { MOVE_IN, MOVE_IN_CHECKED } from "./movein";

describe("moving in (Blueprint v5 §7.2, B19)", () => {
  it("every item says who does it, and any source is an official https page", () => {
    for (const m of MOVE_IN) {
      expect(["you", "your agent", "your lender"]).toContain(m.who);
      if (m.source) expect(m.source.url, m.id).toMatch(/^https:\/\/([a-z]+\.)*(georgia\.gov|usps\.com)(\/|$)/);
    }
    expect(MOVE_IN_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("the homestead item carries the January 1 rule, not just a deadline", () => {
    const h = MOVE_IN.find((m) => m.id === "homestead")!;
    expect(h.body).toMatch(/January 1/);
    expect(h.body).toMatch(/April 1/);
  });
});
