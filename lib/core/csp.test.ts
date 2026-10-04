import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, cspViolation } from "./csp";

describe("the policy", () => {
  const prod = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co/rest/v1" });

  it("names the database for the browser's sign-in calls, as an origin", () => {
    expect(prod).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co;");
  });

  it("allows eval only in development, where the dev server needs it", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
  });

  it("keeps the three directives the enforced policy already has, so enforcing it later loses nothing", () => {
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) expect(prod).toContain(d);
  });

  it("reports to this site, never straight to a third party", () => {
    expect(prod).toMatch(/report-uri \/api\/csp-report$/);
  });
});

describe("what a violation report may keep", () => {
  it("keeps the directive and the blocked origin, and drops the page's address", () => {
    const v = cspViolation({ "csp-report": {
      "document-uri": "https://rift.test/plan/0123456789abcdef0123456789abcdef",
      "effective-directive": "connect-src",
      "blocked-uri": "https://evil.example/collect?token=0123456789abcdef",
    } });
    expect(v).toEqual({ directive: "connect-src", blocked: "https://evil.example" });
    expect(JSON.stringify(v)).not.toMatch(/plan|token|0123/);
  });

  it("reads the Reporting API's shape too, and keeps a keyword as a keyword", () => {
    expect(cspViolation([{ type: "csp-violation", body: { effectiveDirective: "script-src-elem", blockedURL: "inline" } }]))
      .toEqual({ directive: "script-src-elem", blocked: "inline" });
  });

  it("refuses anything that is not a report", () => {
    expect(cspViolation(null)).toBeNull();
    expect(cspViolation({ hello: "world" })).toBeNull();
    expect(cspViolation({ "csp-report": { "effective-directive": "<script>" } })).toBeNull();
  });
});
