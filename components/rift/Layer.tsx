import type { ReactNode } from "react";
import { Ico } from "@/components/rift/icons";

/**
 * A layer: more on the same screen, one press away (Blueprint v5 §3,
 * principle 6, and §4.8; Kaleb, R3).
 *
 * The rule it carries: a screen shows the simple answer and its one next
 * step; whatever complexity cannot be avoided sits behind a layer whose label
 * says what is inside and how much ("How this was worked out · 6 figures").
 * Opening one never changes a figure, never navigates away, and closing it
 * loses nothing.
 *
 * Built on <details>, so it works before any script loads, from the
 * keyboard, and in a screen reader's own terms. Server components can use it.
 *
 * What never goes behind a layer: a failure, a deadline, a blocker, or
 * anything a rule says must be on screen. Those are the simple answer.
 */
export function Layer({ title, meta, children, open, plain, className = "", id }: {
  /** What is inside, in words: "Why this number", "Everyone you are working". */
  title: ReactNode;
  /** How much, or the one fact worth seeing while it is closed: "6", "next chase Mon". */
  meta?: ReactNode;
  children: ReactNode;
  /** Open to begin with, when the page is opened for this very thing. */
  open?: boolean;
  /** A quiet text-style layer for inside a card, instead of a card of its own. */
  plain?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <details id={id} className={`layer ${plain ? "layer-plain" : ""} ${className}`} open={open}>
      <summary className="layer-sum">
        <Ico.chevR size={13} aria-hidden className="layer-chev" />
        <span className="layer-title">{title}</span>
        {meta !== undefined && meta !== null ? <span className="layer-meta">{meta}</span> : null}
      </summary>
      <div className="layer-body">{children}</div>
    </details>
  );
}
