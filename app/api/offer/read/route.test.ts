import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The offer upload's pass (lib/core/offer-pass.ts, D41): the only public
 * route that spends money refuses a post that did not come from the page,
 * before the body is opened and long before anything is read by AI.
 */

const reads = vi.fn();
vi.mock("@/lib/db/offer-read", () => ({ readOfferPdf: async () => { reads(); return { status: "not-configured", say: "", candidates: {} }; } }));
vi.mock("@/lib/db/offer-upload", () => ({
  signingSecret: () => process.env.RIFT_SIGNING_SECRET ?? "",
  keepOfferFile: async () => ({ ok: true, skipped: "no database configured" }),
  saveUploadRead: async () => undefined,
}));

const { POST } = await import("./route");
const { reset } = await import("@/lib/core/ratelimit");
const { issuePass } = await import("@/lib/core/offer-pass");

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\ntrailer\n%%EOF");
const post = (pass?: string) => {
  const body = new FormData();
  body.append("file", new File([PDF], "offer.pdf", { type: "application/pdf" }));
  body.append("name", "Sam Agent");
  body.append("phone", "404 555 0100");
  const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7" };
  if (pass) headers["x-offer-pass"] = pass;
  return POST(new Request("https://rift.test/api/offer/read", { method: "POST", body, headers }));
};

beforeEach(() => { reset(); reads.mockReset(); });
afterEach(() => { delete process.env.RIFT_SIGNING_SECRET; vi.useRealTimers(); });

describe("POST /api/offer/read, the pass", () => {
  it("refuses an upload with no pass, and says to reload rather than why", async () => {
    process.env.RIFT_SIGNING_SECRET = "s";
    const r = await post();
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/Reload it/);
    expect(reads).not.toHaveBeenCalled();
  });

  it("refuses a pass used the moment it was issued", async () => {
    process.env.RIFT_SIGNING_SECRET = "s";
    const r = await post(issuePass("s"));
    expect(r.status).toBe(403);
    expect(reads).not.toHaveBeenCalled();
  });

  it("takes the file with a pass a few seconds old", async () => {
    process.env.RIFT_SIGNING_SECRET = "s";
    const r = await post(issuePass("s", Date.now() - 10_000));
    expect(r.status).toBe(200);
    expect(reads).toHaveBeenCalledOnce();
  });

  it("asks for none where nothing could have signed one", async () => {
    const r = await post();
    expect(r.status).toBe(200);
    expect(reads).toHaveBeenCalledOnce();
  });
});
