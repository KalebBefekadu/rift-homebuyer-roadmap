import { describe, expect, it } from "vitest";
import { cleanFileName, readSender } from "./offer-upload";

describe("who is uploading an offer (WS8.2)", () => {
  it("needs a name and a phone number before the file", () => {
    const r = readSender({ name: "", phone: "404" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["name", "phone"]);
  });

  it("takes email as optional, but refuses one that cannot be an address", () => {
    expect(readSender({ name: "Dana Agent", phone: "(404) 555-0100" })).toEqual({ ok: true, value: { name: "Dana Agent", phone: "(404) 555-0100", email: null } });
    const bad = readSender({ name: "Dana Agent", phone: "404 555 0100", email: "dana@" });
    expect(bad.ok).toBe(false);
  });

  it("keeps a file name a person can read, and nothing that walks a folder", () => {
    expect(cleanFileName("../../etc/Offer – 12 Elm St.pdf")).toBe("Offer 12 Elm St.pdf");
    expect(cleanFileName("C:\\Users\\x\\addendum (1).pdf")).toBe("addendum (1).pdf");
    expect(cleanFileName("<>")).toBe("offer.pdf");
  });
});
