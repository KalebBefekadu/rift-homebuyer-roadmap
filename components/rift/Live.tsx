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

/**
 * Where a form's outcome appears: in the page before the outcome is.
 *
 * The public forms wrote `{error ? <p role="alert">…</p> : null}`, which puts
 * the live region into the page at the same moment as its text. Screen readers
 * listen to regions that already exist and announce what changes in them; one
 * that arrives already full is often not read at all, so "that did not go
 * through" appeared on screen and was silent to anybody not looking.
 *
 * So the container is always rendered and only what is inside it changes. It
 * carries no styling of its own, because it is always there: the visible
 * message goes inside it as a child, styled as it was, and an empty region
 * takes no space.
 *
 * `status` for outcomes that can wait their turn, `alert` for failures that
 * should interrupt. A caller that swaps between the two keeps one of each
 * mounted, since changing a region's role is itself not reliably announced.
 */
export function LiveRegion({ kind = "status", id, children }: {
  kind?: "status" | "alert";
  /** For `aria-describedby` from the field the message is about. */
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} role={kind} aria-live={kind === "alert" ? "assertive" : "polite"} aria-atomic="true">
      {children}
    </div>
  );
}
