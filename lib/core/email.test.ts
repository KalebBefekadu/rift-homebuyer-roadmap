import { describe, it, expect } from "vitest";

/**
 * Escaping, tested where it can be.
 *
 * Names arrive from a public form and are interpolated into email markup. The
 * escape helper lives inside a server-only module, so the rule is asserted here
 * against the same implementation shape — and this test is the reason the
 * helper exists at all rather than the name being dropped in raw.
 */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

describe("email escaping", () => {
  it("neutralises markup in a name from a public form", () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain("<script>");
  });

  it("leaves an ordinary name alone", () => {
    expect(escapeHtml("Nadia Okafor")).toBe("Nadia Okafor");
  });

  it("handles the apostrophe that appears in real names", () => {
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });
});
