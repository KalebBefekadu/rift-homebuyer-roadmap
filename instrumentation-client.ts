import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // 100% in dev, 10% in production (Sentry Next.js skill default)
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
  /**
   * No Session Replay. Two reasons, and the second is the one that decides it.
   *
   * It is the heaviest thing this product ships to a browser — the replay
   * recorder is most of the Sentry client bundle, on a public funnel whose
   * audience includes people opening it on a phone from another continent.
   *
   * And it recorded one in ten sessions of pages where somebody types their
   * savings, their payoff and their income, on a product that asks for no
   * account and says so. `lib/core/privacy.ts` lists every category of data
   * this product keeps — its own comment says a retention list that omits a
   * category "is not a retention list, it is a selection" — and says of the
   * funnel telemetry: "We know someone stopped on the savings question; we do
   * not know what they typed." Session recordings sent to a third party were
   * not on that list, and the only thing making that sentence true was a
   * library default nothing here had written down.
   *
   * Errors and traces are unaffected; nothing about diagnosing a crash needed
   * the recording. If it is ever wanted back it is one integration — but it
   * belongs in RETENTION first, with maskAllText and maskAllInputs set here
   * explicitly rather than inherited.
   */
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
