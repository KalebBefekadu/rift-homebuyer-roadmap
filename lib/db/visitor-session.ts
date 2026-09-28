import "server-only";

/**
 * Whether a session id names one visitor, and so may key a write or an
 * erasure.
 *
 * The browser's sessionId() (lib/rift/session.ts) answered "anon" to every
 * visitor whose storage was blocked, and answers "ssr" when called during a
 * server render. Either one, trusted as a handle, joins strangers together:
 * leads captured under "anon" all carried the same session, so "delete all
 * of it" from any one of those visitors found and deleted every one of them.
 * The browser no longer sends "anon", but an open tab running the old script
 * can, and rows already stored with it are still in the table, so the server
 * refuses these values rather than trusting every client to have updated.
 */
const SHARED = new Set(["anon", "ssr"]);

export const oneVisitor = (id: string | null | undefined): id is string =>
  typeof id === "string" && id.trim() !== "" && !SHARED.has(id.trim());
