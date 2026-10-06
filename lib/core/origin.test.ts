import { describe, expect, it } from "vitest";
import { originOf } from "./origin";

describe("redirects go back to the address the browser used", () => {
  it("prefers the forwarded host, then the Host header, over the bind address", () => {
    const at = (headers: Record<string, string>) => new Request("http://localhost:3000/app/sign-out", { method: "POST", headers });
    expect(originOf(at({ host: "127.0.0.1:3178" }))).toBe("http://127.0.0.1:3178");
    expect(originOf(at({ host: "localhost:3000", "x-forwarded-host": "riftrealestate.com", "x-forwarded-proto": "https" }))).toBe("https://riftrealestate.com");
    expect(originOf(new Request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});
