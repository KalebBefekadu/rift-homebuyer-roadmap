/**
 * A database error as the start of a sentence. The read helpers say "the
 * offers that came in did not complete in time" (lower case, no full stop) so
 * they can sit inside a sentence; a notice that begins with one needs the
 * capital and the stop.
 */
export const say = (error: string) => {
  const t = error.trim();
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? "" : "."}`;
};
