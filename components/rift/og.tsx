import type { ReactElement } from "react";

/**
 * The card a Rift page becomes when somebody pastes its link.
 *
 * Every public page had one of these except `/abroad`, which had the only one
 *, so every other link in the product arrived in a message as a bare URL with
 * a favicon. For a product whose entire distribution is a stranger forwarding
 * a readout to somebody they know, that is not a polish item. The unfurl is
 * most of the decision to tap.
 *
 * One layout, filled differently per page, so the product looks like one
 * product across four cards. The constraint worth remembering when editing:
 * this renders through satori, which requires an explicit `display` on any
 * element with more than one child and silently fails the build otherwise.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#111";
const PAPER = "#fbfaf8";
const MUTED = "#5c5852";
const FAINT = "#7a756e";
const BRAND = "#b4402a";

export interface CardProps {
  /** The pill beside the wordmark. Which door this is. */
  chip?: ReactElement | string;
  /** The promise. Set in the product's own voice, not a page title. */
  headline: string;
  /** What they get. One sentence. */
  sub: string;
  /** Bottom left: what it costs and what it needs. */
  foot?: ReactElement | string;
  /** Extra fonts for scripts the renderer does not ship. */
}

export function Card({ chip, headline, sub, foot }: CardProps) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", background: PAPER, padding: 72,
      fontFamily: "sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: INK,
          color: "#fff", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 21, fontWeight: 700,
        }}>R</div>
        <div style={{ fontSize: 27, fontWeight: 600, color: INK }}>Rift</div>
        {chip ? (
          <div style={{
            marginLeft: 8, fontSize: 17, color: BRAND, display: "flex", gap: 6,
            border: "1px solid #e8d9d4", borderRadius: 999, padding: "4px 14px",
          }}>
            {chip}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 62, lineHeight: 1.08, color: INK, letterSpacing: -1.5, maxWidth: 940 }}>
          {headline}
        </div>
        <div style={{ fontSize: 30, color: MUTED, maxWidth: 880 }}>{sub}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 22, color: FAINT, display: "flex", gap: 6 }}>
          {foot ?? <span>Free · no account · yours to keep</span>}
        </div>
        {/* Named, because a card about somebody's money that names nobody is
            the kind of thing people have learned not to tap. */}
        <div style={{ fontSize: 22, color: FAINT }}>Kaleb Befekadu · Georgia</div>
      </div>
    </div>
  );
}
