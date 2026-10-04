import "server-only";

/**
 * The newest migration this code was written against.
 *
 * /api/health asks production whether this one has been recorded in
 * rift_schema_migrations, so a deploy that went out ahead of its migration says
 * so on the one page a monitor reads, rather than on whichever screen happens
 * to touch the missing column. schema-version.test.ts fails when a migration is
 * added without moving this line, so the two cannot drift apart unnoticed.
 */
export const LATEST_MIGRATION = "20261004100000_rift_offer_answers";
