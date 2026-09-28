import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * A browser that will not store anything still gets a session of its own.
 *
 * sessionId() used to answer "anon" to every such visitor. Leads, consents
 * and first touches all carried it, so one of them pressing "delete all of
 * it" reached every other visitor who had ever sent it.
 */

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const blocked = () => vi.stubGlobal("window", {
  sessionStorage: {
    getItem: () => { throw new Error("SecurityError: storage is disabled"); },
    setItem: () => { throw new Error("SecurityError: storage is disabled"); },
  },
});

describe("sessionId with storage blocked", () => {
  it("is this page's own, and stays the same while the page is open", async () => {
    blocked();
    const { sessionId } = await import("./session");
    const first = sessionId();
    expect(first).not.toBe("anon");
    expect(first).toMatch(/^s-[a-z0-9]+-[a-z0-9]+$/);
    expect(sessionId()).toBe(first);
  });

  it("differs from one visitor to the next", async () => {
    blocked();
    const a = (await import("./session")).sessionId();
    vi.resetModules();
    const b = (await import("./session")).sessionId();
    expect(a).not.toBe(b);
  });
});
