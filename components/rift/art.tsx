/**
 * Drawn assets for the pages aimed at buyers abroad.
 *
 * All SVG, all inline, all built from `currentColor` and the product's own
 * tokens. Nothing here is a photograph, which is deliberate: a stock photo of a
 * family outside a house makes a claim about who this product is for, and the
 * one thing a housing page must never do is signal who belongs in it.
 * Geometry says "considered" without saying "you" or "not you".
 *
 * The border motif is a tibeb: the woven band along the edge of Ethiopian
 * dress. It is used the way it is used on cloth: a narrow band at an edge,
 * never a background, never a flag. Read as ornament by anyone, recognised by
 * the people who grew up with it.
 */

/** The woven band. Repeats horizontally at any width. */
export function Tibeb({ height = 10, className, style }: {
  height?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <svg aria-hidden height={height} className={className} preserveAspectRatio="none"
      viewBox="0 0 48 12" style={{ display: "block", width: "100%", ...style }}>
      <defs>
        <pattern id="tibeb" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 L3 2 L6 6 L9 2 L12 6" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M0 10 L6 10 M6 10 L12 10" stroke="currentColor" strokeWidth="0.7" opacity=".45" />
          <rect x="5" y="4.4" width="2" height="2" transform="rotate(45 6 5.4)" fill="currentColor" opacity=".8" />
        </pattern>
      </defs>
      <rect width="48" height="12" fill="url(#tibeb)" />
    </svg>
  );
}

/**
 * The hero mark: a house, and the distance to it.
 *
 * The argument of the page in one drawing: the owner is on one side of an
 * ocean and the asset is on the other, and the line between them is not a
 * problem to be solved but the ordinary shape of the thing.
 */
export function Distance({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 320 200" className={className}
      style={{ width: "100%", height: "auto", display: "block", ...style }}>
      {/* the arc between two places */}
      <path d="M38 150 Q160 42 282 122" fill="none" stroke="currentColor" strokeWidth="1.4"
        strokeDasharray="4 5" opacity=".45" />
      <circle cx="38" cy="150" r="5.5" fill="currentColor" opacity=".55" />
      <circle cx="38" cy="150" r="13" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25" />

      {/* the house, drawn plainly */}
      <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round">
        <path d="M244 122 L282 92 L320 122" />
        <path d="M254 115 L254 168 L310 168 L310 115" />
        <rect x="270" y="140" width="18" height="28" />
        <path d="M262 126 h12 v12 h-12 z" opacity=".7" />
        <path d="M294 126 h12 v12 h-12 z" opacity=".7" />
      </g>
      <path d="M254 168 L310 168" stroke="currentColor" strokeWidth="2.4" />

      {/* rent returning along the same line */}
      <g opacity=".6">
        <circle cx="120" cy="86" r="3" fill="currentColor" />
        <circle cx="170" cy="72" r="3" fill="currentColor" />
        <circle cx="220" cy="84" r="3" fill="currentColor" />
      </g>
      <path d="M96 168 L38 168" stroke="currentColor" strokeWidth="2.4" opacity=".3" />
    </svg>
  );
}

/**
 * Three stacked bars, sized from the figures themselves.
 *
 * The page argues that cash flow is the smallest of the three returns and the
 * only one people look at. A drawing whose proportions came from anywhere but
 * the numbers would be making that argument dishonestly, so these are passed
 * in, and a negative cash flow draws below the line rather than disappearing.
 */
export function ReturnBars({ cashFlow, principal, appreciation, labels, lang }: {
  cashFlow: number; principal: number; appreciation: number;
  labels: [string, string, string];
  lang?: string;
}) {
  const parts = [
    { label: labels[0], v: cashFlow },
    { label: labels[1], v: principal },
    { label: labels[2], v: appreciation },
  ];
  const span = Math.max(...parts.map((p) => Math.abs(p.v)), 1);
  const W = 300, H = 92, mid = H / 2, unit = (H / 2 - 10) / span;

  return (
    <svg aria-hidden lang={lang} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1="0" y1={mid} x2={W} y2={mid} stroke="currentColor" strokeWidth="1" opacity=".25" />
      {parts.map((p, i) => {
        const h = Math.abs(p.v) * unit;
        const x = 18 + i * 98;
        const up = p.v >= 0;
        return (
          <g key={p.label}>
            <rect x={x} y={up ? mid - h : mid} width={62} height={Math.max(h, 1.5)} rx="2"
              fill="currentColor" opacity={up ? 0.85 : 0.35} />
            <text x={x + 31} y={up ? mid - h - 6 : mid + h + 14} textAnchor="middle"
              fontSize="9" fill="currentColor" opacity=".7">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
