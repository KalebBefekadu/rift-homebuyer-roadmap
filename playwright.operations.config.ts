import { defineConfig, devices } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * Operations, walked in a browser against a real database.
 *
 * The public suite (playwright.config.ts) runs with no database on purpose.
 * Operations cannot: every page is behind the agent's session and is made of
 * reads. Until this existed the pages rebuilt on 2 Oct were covered by unit
 * tests and one-off manual checks only, and the defects that matter here
 * ("could not be read" on a page that works, a control that does nothing)
 * render as a 200.
 *
 * It runs against the LOCAL stand-in (scripts/local/up.sh, or CI's Postgres
 * and PostgREST with the demo book loaded): PostgREST behind
 * scripts/local/proxy.mjs, whose /auth/v1/user answers as the local agent.
 * Every variable that could reach production is set here, because Next does
 * not overwrite one that is already set and .env.local points at production.
 */
const SECRET = "rift-local-test-secret-at-least-32-chars-long";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b64({ alg: "HS256", typ: "JWT" });
const p = b64({ role: "anon", iat: 1700000000, exp: 2000000000 });
const ANON = `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;

const PORT = 3188;
const LOCAL = {
  SUPABASE_URL: "http://localhost:3002",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:3002",
  SUPABASE_ANON_KEY: ANON,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: ANON,
  BREVO_API_KEY: "",
  BREVO_FROM_EMAIL: "",
  CAL_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  SENTRY_AUTH_TOKEN: "",
  SENTRY_DSN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
  CRON_SECRET: "local-test-secret",
};

export default defineConfig({
  testDir: "./e2e-operations",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  /* PW_CHANNEL=chrome runs locally on an installed Chrome (a fresh profile)
     instead of Playwright's own download; CI installs its browser. */
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) } },
    { name: "phone", use: { ...devices["Pixel 7"], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) } },
  ],
  webServer: [
    {
      command: "node scripts/local/proxy.mjs",
      url: "http://localhost:3002/rest/v1/",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      /* CI starts the blank build the public suite already walked: the server
         reads SUPABASE_URL at run time, so the same bundle reaches the stand-in. */
      command: process.env.CI
        ? `npx next start --port ${PORT} --hostname 127.0.0.1`
        : `npx next build && npx next start --port ${PORT} --hostname 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: LOCAL,
    },
  ],
});
