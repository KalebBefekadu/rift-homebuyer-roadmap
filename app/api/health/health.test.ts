import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The health check, under the conditions a failure drill found it lying in.
 *
 * With the data API stopped underneath a running server it returned
 * `"ok": true`: database "configured" (the env var existed), agent "ready"
 * (an id cached in memory), retention "clear" (cached from before). And once
 * it learned to ask Brevo about email, it asked from every cold serverless
 * instance, each of which made Brevo email the account owner a security alert.
 */

let probe: "ok" | "error" | "hang" = "ok";
let ledger: "current" | "behind" | "absent" = "current";

const ledgerRead = () => Promise.resolve(
  ledger === "current" ? { data: [{ name: "x" }], error: null }
  : ledger === "behind" ? { data: [], error: null }
  : { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.rift_schema_migrations'" } });

vi.mock("@/lib/db/service", () => ({
  serviceClient: () => ({
    from: (table: string) => ({
      select: () => table === "rift_schema_migrations"
        ? { eq: () => ({ limit: ledgerRead }) }
        : {
            limit: () => probe === "hang"
              ? new Promise(() => {})
              : Promise.resolve(probe === "ok" ? { data: [{ id: "a" }], error: null } : { data: null, error: { message: "fetch failed" } }),
          },
    }),
  }),
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/db/rates", () => ({ currentRate: async () => ({ freshness: "fresh", asOf: "2026-09-18" }) }));
vi.mock("@/lib/db/retention", () => ({ overdue: async () => ({ ok: true, data: { overdue: false } }) }));
vi.mock("@/lib/core/timeout", async (orig) => ({
  ...(await orig<typeof import("@/lib/core/timeout")>()),
  READ_DEADLINE_MS: 50,
}));

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

const { GET } = await import("./route");
const call = (auth?: string) =>
  GET(new Request("http://x/api/health", auth ? { headers: { authorization: auth } } : undefined));

beforeEach(() => {
  probe = "ok";
  ledger = "current";
  fetchSpy.mockReset();
  process.env.BREVO_API_KEY = "k";
  process.env.BREVO_FROM_EMAIL = "kaleb@example.com";
  process.env.CRON_SECRET = "s3cret";
});

describe("the database line is an outcome, not a setting", () => {
  it("says reachable and returns 200 when the database answers", async () => {
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.checks.database).toBe("reachable");
    expect(body.ok).toBe(true);
  });

  it("returns 503 when the database errors, whatever is cached", async () => {
    probe = "error";
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.database).toBe("unreachable");
    /* The cached agent id must not be reported as readiness. */
    expect(body.checks.agent).not.toBe("ready");
    /* Nor may the stale retention verdict be shown during an outage. */
    expect(body.checks.retention).toBeUndefined();
  });

  it("returns 503 when the database hangs, rather than hanging with it", async () => {
    probe = "hang";
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.database).toBe("unreachable");
  });
});

describe("the Brevo probe", () => {
  it("never calls Brevo on a public request", async () => {
    /* Each call from a new serverless address makes Brevo email the account
       owner a security alert. A public ping must not be able to cause that. */
    const body = await (await call()).json();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(body.checks.email).toMatch(/not verified/);
  });

  it("does not treat a wrong secret as the right one", async () => {
    await call("Bearer nope");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports the IP block truthfully when asked with the secret", async () => {
    fetchSpy.mockResolvedValue(new Response(
      '{"message":"We have detected you are using an unrecognised IP address"}', { status: 401 }));
    const body = await (await call("Bearer s3cret")).json();
    expect(body.checks.email).toMatch(/blocked/);
  });

  it("never reports a secret-less deployment as deep-checked", async () => {
    delete process.env.CRON_SECRET;
    await call("Bearer undefined");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the schema line", () => {
  /* "current" is cached for five minutes, and earlier tests in this file
     have already cached it, so each test here starts well past that. */
  let later = 0;
  beforeEach(() => { later += 1; vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2030, 0, 1) + later * 3_600_000); });
  it("says production has no ledger when the table is missing", async () => {
    ledger = "absent";
    const body = await (await call()).json();
    expect(body.checks.schema).toBe("behind: no migration ledger yet");
    expect(body.ok).toBe(true);
  });

  it("says behind, without naming the migration, when the newest is not recorded", async () => {
    ledger = "behind";
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.checks.schema).toBe("behind: the newest migration is not applied");
    expect(JSON.stringify(body)).not.toMatch(/[0-9]{14}_/);
  });

  it("says current when it is", async () => {
    const body = await (await call()).json();
    expect(body.checks.schema).toBe("current");
  });
});
