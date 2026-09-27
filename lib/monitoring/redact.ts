/**
 * Link tokens out of error reports and traces (ACCESS-02: "tokens ... never
 * reach previews, analytics, logs or error reports").
 *
 * A shared readout, a plan, a saved plan, a summary link and an invitation
 * are each opened by a token in the address. Sentry records the address of
 * the page that failed, so without this every error on one of those pages
 * would put a working credential into a third party's database. Query
 * strings go too: a value page's address carries the person's answers.
 *
 * Pure, and used by all three Sentry configurations.
 */

const TOKEN_PATHS = /\/(r|plan|saved|summary|app\/invite)\/[^/?#\s]+/g;

export function redactUrl(url: string): string {
  return url
    .replace(TOKEN_PATHS, (_m, p: string) => `/${p}/[token]`)
    .replace(/\?[^#\s]*/g, "?[redacted]");
}

type Scrubbable = {
  request?: { url?: string; query_string?: unknown; headers?: Record<string, string> };
  transaction?: string;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

/** For beforeSend and beforeSendTransaction: the event, with every address scrubbed. */
export function scrubEvent<T>(event: T): T {
  const e = event as unknown as Scrubbable;
  if (e.request?.url) e.request.url = redactUrl(e.request.url);
  if (e.request) delete e.request.query_string;
  if (e.request?.headers?.referer) e.request.headers.referer = redactUrl(e.request.headers.referer);
  if (e.transaction) e.transaction = redactUrl(e.transaction);
  for (const b of e.breadcrumbs ?? []) {
    for (const k of ["url", "from", "to"]) {
      const v = b.data?.[k];
      if (typeof v === "string") b.data![k] = redactUrl(v);
    }
  }
  return event;
}
