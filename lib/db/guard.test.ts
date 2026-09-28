import { describe, it, expect } from "vitest";
import { visitorSession } from "./guard";

/**
 * The handles the public endpoints accept from a browser.
 *
 * A session id is the only thing "Delete all of it" needs, so what counts as
 * one decides whose records a stranger with curl can erase.
 */
describe("a visitor's session id", () => {
  it("accepts the shape lib/rift/session.ts mints", () => {
    expect(visitorSession("s-mfx1k2ab-4fzyo82m")).toBe("s-mfx1k2ab-4fzyo82m");
    /* Math.random can yield a short tail; it is still one browser's id. */
    expect(visitorSession("s-mfx1k2ab-i")).toBe("s-mfx1k2ab-i");
    expect(visitorSession(" s-mfx1k2ab-4fzyo8 ")).toBe("s-mfx1k2ab-4fzyo8");
  });

  it("refuses the placeholders every storage-less browser shares", () => {
    /* "anon" is what every browser with storage blocked sends. Accepting it
       made one visitor's delete button erase all of them. */
    expect(visitorSession("anon")).toBeUndefined();
    expect(visitorSession("ssr")).toBeUndefined();
  });

  it("refuses anything that is not a string of that shape", () => {
    for (const v of [undefined, null, 42, {}, "", "s-", "s--", "S-ABC-DEF", "s-abc-def-ghi", "s-abc-d%ef", `s-${"a".repeat(40)}-b`]) {
      expect(visitorSession(v), String(v)).toBeUndefined();
    }
  });
});
