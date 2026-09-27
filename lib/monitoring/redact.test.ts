import { describe, it, expect } from "vitest";
import { redactUrl, scrubEvent } from "./redact";

describe("tokens stay out of error reports (ACCESS-02)", () => {
  it("replaces every link token and every query string", () => {
    expect(redactUrl("https://x.test/summary/AbC_123-token/extra")).toBe("https://x.test/summary/[token]/extra");
    expect(redactUrl("/r/abc123")).toBe("/r/[token]");
    expect(redactUrl("/saved/xyz")).toBe("/saved/[token]");
    expect(redactUrl("/app/invite/secret")).toBe("/app/invite/[token]");
    expect(redactUrl("/buy/afford?cp=2400&i=90000")).toBe("/buy/afford?[redacted]");
    expect(redactUrl("/buy/programs")).toBe("/buy/programs");
  });

  it("scrubs the request, the transaction and the breadcrumbs", () => {
    const e = scrubEvent({
      request: { url: "https://x.test/plan/tok123?a=1", query_string: "a=1", headers: { referer: "https://x.test/r/tok456" } },
      transaction: "/summary/tok789",
      breadcrumbs: [{ data: { url: "/saved/tokabc", from: "/r/one", to: "/buy" } }],
    });
    expect(JSON.stringify(e)).not.toMatch(/tok\d|tokabc|\/r\/one|a=1/);
  });
});
