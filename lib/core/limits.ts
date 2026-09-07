/**
 * The largest body a public endpoint will read.
 *
 * Policy, so it lives in the domain layer and can be reasoned about without a
 * server. `readJson` in lib/db enforces it.
 *
 * Rate limiting caps requests per minute and says nothing about the size of
 * each. The readout endpoint stores whatever `inputs` and `figures` it is
 * given as jsonb, so ten megabytes ten times a minute sits inside the rate
 * limit and fills a database quietly.
 *
 * 64KB is far more than any real payload here — the largest is a readout with
 * three tracked figures and a matched programme list, comfortably under 8KB —
 * and far less than anything worth storing by accident.
 *
 * Raising it is an invisible change: nothing breaks, the database just fills.
 * That is why it is pinned by a test rather than left as a number in a file.
 */
export const MAX_BODY_BYTES = 64 * 1024;
