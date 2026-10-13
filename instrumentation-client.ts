import { loadSentry, sentryIfLoaded } from "./lib/monitoring/browser";

/*
 * Sentry starts when the browser is idle, not before the page can be used
 * (lib/monitoring/browser.ts). Until then an uncaught error is held here and
 * sent once it has started, so the first seconds are not a blind spot.
 */
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const held: unknown[] = [];
  const onError = (e: ErrorEvent) => { held.push(e.error ?? e.message); };
  const onRejection = (e: PromiseRejectionEvent) => { held.push(e.reason); };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = () => {
    void loadSentry().then((s) => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      for (const e of held.splice(0)) s?.captureException(e);
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4_000 });
  else setTimeout(start, 2_000);
}

/* Navigation timing, once the SDK is there; a navigation before it is not measured. */
export function onRouterTransitionStart(href: string, navigationType: string) {
  sentryIfLoaded()?.captureRouterTransitionStart(href, navigationType);
}
