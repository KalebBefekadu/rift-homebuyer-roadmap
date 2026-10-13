import type * as SentrySdk from "@sentry/nextjs";

/**
 * Error reporting in the browser, loaded when the page is idle.
 *
 * The Sentry client was 85 kB of the 189 kB every page shared, /privacy and
 * the funnel's front doors included, on an audience that opens this on a phone
 * from another continent (audit 12 Oct §4 Performance). Nothing about
 * reporting a crash needs it before the page is usable, so it is fetched once
 * the browser is idle, or the moment there is an error to report.
 *
 * What it costs: an error in the first second or two is held by
 * instrumentation-client.ts and sent once this has loaded, and a page closed
 * before then reports nothing. Server errors are unaffected; they are most of
 * what gets reported.
 */
type Sdk = typeof SentrySdk;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let loading: Promise<Sdk | null> | null = null;
let ready: Sdk | null = null;

/** With no DSN nothing is fetched: there is nowhere to send a report. */
export function loadSentry(): Promise<Sdk | null> {
  if (!dsn) return Promise.resolve(null);
  loading ??= import("./browser-init")
    .then((m) => (ready = m.start(dsn)))
    .catch(() => null);
  return loading;
}

/** The SDK if it has loaded, for calls that are only worth making if it has. */
export const sentryIfLoaded = (): Sdk | null => ready;

/** For error boundaries: reports now, loading the SDK first if it has to. */
export function reportError(error: unknown): void {
  void loadSentry().then((s) => s?.captureException(error));
}
