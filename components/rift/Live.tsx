/**
 * What a screen reader is told when a figure changes.
 *
 * All three landings answer in place: move a slider or change a select and the
 * dark panel recomputes. There was no `aria-live` anywhere in the codebase, so
 * for anyone not watching the panel, nothing happened at all: the product's
 * entire front-door promise, that you get a real number before you give up
 * anything, was being delivered visually and only visually.
 *
 * A live region on the panel itself would work and would be unbearable: it is
 * a heading, a figure, a list of programme chips and a link, re-read in full on
 * every step of a slider. So the panel stays as it is, reachable by ordinary
 * navigation, and this announces one sentence beside it.
 *
 * `aria-atomic` matters here. Without it a reader may announce only the nodes
 * that changed, which for "$28,000 – $40,000" can be the digits alone.
 */
export function Announce({ children }: { children: React.ReactNode }) {
  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </p>
  );
}
