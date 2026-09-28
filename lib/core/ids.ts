/**
 * Whether a value from a browser is shaped like a row id.
 *
 * Checked before a query, not left to the database: Postgres answers a
 * malformed uuid with an error, which would be reported as a failed read
 * (and sent to monitoring) when the truth is only that the page is stale or
 * somebody edited a URL.
 *
 * Pure: no I/O.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/**
 * A fresh id for a write the server should apply once, however many times it
 * arrives (a double click, a retry after a timeout).
 *
 * `crypto.randomUUID` exists only in a secure context, so a page opened over
 * plain http on a phone on the office network would throw on every button.
 * The fallback is not cryptographic and does not need to be: it names a
 * request, it does not guard one.
 */
export const newRequestId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
