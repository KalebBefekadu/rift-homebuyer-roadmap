import { describe, it, expect, vi, afterEach } from "vitest";
import { ownLink, visitorSession } from "./guard";

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

describe("a link a browser asks us to email", () => {
  const req = new Request("https://rift-preview.vercel.app/api/capture", { method: "POST" });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("accepts the origin the request arrived on, and the configured site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rift.example");
    expect(ownLink("https://rift-preview.vercel.app/r/abc", req)).toBe("https://rift-preview.vercel.app/r/abc");
    expect(ownLink("https://rift.example/abroad/results?p=1", req)).toBe("https://rift.example/abroad/results?p=1");
  });

  it("refuses every other origin, including ones that only look like ours", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rift.example");
    for (const v of [
      "https://evil.example/r/abc", "https://rift.example.evil.example/r/abc", "http://rift.example/r/abc",
      "https://rift.example@evil.example/r/abc", "javascript:alert(1)", "/r/abc", "", 42, null,
    ]) {
      expect(ownLink(v, req), String(v)).toBeUndefined();
    }
  });
});
