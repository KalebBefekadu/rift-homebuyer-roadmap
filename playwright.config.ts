import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end suite.
 *
 * 649 unit tests did not catch a single one of this product's real defects.
 * Every one of them rendered perfectly and returned 200: the crons answering
 * the wrong verb, the sitemap with no URLs, "Delete all of it" not deleting
 * the person, five dead links on the live seller readout, a notice that
 * shattered into three columns on a phone. That class is only catchable by
 * walking the path and reading what came out.
 *
 * DELIBERATELY RUN WITH NO DATABASE.
 *
 * Two reasons, and the second is the better one. First, a suite that needs
 * credentials is a suite that does not run in CI on a fork. Second, and more
 * useful: the product's degradation contract says every public page must
 * render without a database — the funnel falls back to the built-in
 * definition, the rate falls back to a labelled starting assumption, the
 * registry withholds rather than invents. That contract has only ever been
 * asserted in unit tests against mocked modules. Running the real funnel
 * against a real server with nothing configured tests it for real.
 *
 * The empty values below are not placeholders. Next does not overwrite a
 * variable that is already set, so an empty string here is what stops a local
 * run from picking up .env.local — which points at PRODUCTION.
 */
const BLANK = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  BREVO_API_KEY: "",
  BREVO_FROM_EMAIL: "",
  CAL_API_KEY: "",
  SENTRY_AUTH_TOKEN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3177",
};

export default defineConfig({
  testDir: "./e2e",
  /* A failing smoke test is a stop sign, not a flake to be retried away. One
     retry absorbs port races in CI; more would start hiding real intermittency
     on the one suite whose whole job is to notice things. */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://127.0.0.1:3177",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    /* The mobile project is not decoration. Two disclosure notices on the
       buyer readout shattered into three side-by-side columns on a phone and
       fitted one line on a desktop, so the desktop run would have passed. */
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    /* A production build, not `next dev`. The bugs worth catching here are
       about what the built application serves — a dev server papers over
       static/dynamic differences, and it was a static/dynamic question that
       put a 1.7s first byte on the funnel's front door.

       CI has already built, with the same blank environment (see ci.yml), so
       it only starts. Building twice would double the slowest step in the
       pipeline to prove nothing — and worse, the second build could differ
       from the one whose bundle size CI measured. */
    command: process.env.CI
      ? "npx next start --port 3177 --hostname 127.0.0.1"
      : "npx next build && npx next start --port 3177 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3177/",
    reuseExistingServer: false,
    timeout: 240_000,
    env: BLANK,
  },
});
