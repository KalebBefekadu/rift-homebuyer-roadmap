import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  /**
   * Local variables are OFF in production, and this is a performance decision
   * rather than a privacy one.
   *
   * `includeLocalVariables` attaches a V8 inspector session to the process so
   * that a crash can report the value of every variable in scope. Attaching
   * the inspector puts V8 into a debugging mode, and the cost of that mode is
   * paid by every line of JavaScript the process runs, not only by the ones
   * that throw.
   *
   * On this product that bill landed almost entirely on the thing it could
   * least afford. A route handler mostly waits on the network and barely
   * noticed. A server-rendered page runs the whole React pipeline, and
   * measured against production it cost a flat ~1.6s on EVERY dynamic page:
   * the buyer readout took 1.9s to first byte, and so did a plan page whose
   * entire output is one paragraph saying the link is closed. Page size,
   * county, and database work made no difference, which is what gave it away —
   * a fixed tax on executing JavaScript, not on doing work.
   *
   * The readout is the page the product's whole argument rests on: a stranger
   * types five answers and gets their real numbers. Nearly two seconds of dead
   * air before the first byte, to make a hypothetical stack trace richer, is
   * the wrong trade. Stack traces, breadcrumbs, traces and logs are all
   * unaffected — only the local-variable snapshot goes.
   *
   * Kept in development, where the inspector costs nothing that matters and a
   * crash with values in it is genuinely faster to read.
   */
  includeLocalVariables: process.env.NODE_ENV === "development",
  enableLogs: true,
});
