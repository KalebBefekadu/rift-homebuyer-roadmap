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
