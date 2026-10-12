import { defineConfig, devices } from "@playwright/test";

/**
 * Client sign-in, end to end, against a REAL Supabase Auth (manual review
 * WS1.8).
 *
 * The public suite runs with no database, and the Operations suite against a
 * stand-in whose auth is a proxy that answers as the agent. Neither can walk
 * the client's way in: an invitation becoming a password, an email link
 * clicked in the same browser and in another one, a forgotten password. That
 * path broke in production with every test green, because no test had ever
 * signed a client in.
 *
 * So this suite needs a real stack: `scripts/e2e-auth.sh` starts one in
 * Docker (Supabase's own images, the Rift migrations, Mailpit catching the
 * email) and runs it. Every variable that could reach production is set here
 * from E2E_*; with any of them missing, the specs skip and say why.
 */
const PORT = 3178;
const E = process.env;
const STACK = {
  SUPABASE_URL: E.E2E_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_URL: E.E2E_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: E.E2E_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: E.E2E_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: E.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
  /* No Brevo: links go through Supabase's own mailer, which the local stack
     points at Mailpit, so the test can read the email it was sent. */
  BREVO_API_KEY: "",
  BREVO_FROM_EMAIL: "",
  CAL_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  SENTRY_AUTH_TOKEN: "",
  SENTRY_DSN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
};

export default defineConfig({
  testDir: "./e2e-auth",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(E.PW_EXECUTABLE ? { launchOptions: { executablePath: E.PW_EXECUTABLE } } : {}),
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], ...(E.PW_EXECUTABLE ? { launchOptions: { executablePath: E.PW_EXECUTABLE } } : {}) } }],
  webServer: {
    command: `npx next build && npx next start --port ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: STACK,
  },
});
