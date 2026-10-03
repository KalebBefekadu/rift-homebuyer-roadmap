/**
 * Drawn assets for the Equb page.
 *
 * Inline SVG on `currentColor`, no photographs, for the reason in art.tsx: a
 * stock family outside a house says who belongs in the room. These draw the
 * mechanism instead: a circle of households, one of them receiving, the pot
 * moving round. The tibeb band is borrowed from art.tsx and used the same way.
 *
 * Anything with a number in it is drawn from the number passed in. The payout
 * ladder takes its length from the group size; it does not draw 24 of anything
 * because the example happens to be 24.
 */

type P = { className?: string; style?: React.CSSProperties };
const base = (style?: React.CSSProperties): React.CSSProperties => ({ width: "100%", height: "auto", display: "block", ...style });

/* A house, drawn as one path, at (x, y) for its roof apex. */
const House = ({ x, y, s = 1, filled = false }: { x: number; y: number; s?: number; filled?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} strokeLinejoin="round">
    <path d="M-11 4 L0 -6 L11 4 M-8 2 V13 H8 V2" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.16 : 0}
      stroke="currentColor" strokeWidth="1.5" />
    <path d="M-2.5 13 V7 H2.5 V13" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </g>
);

/**
 * The hero: a ring of households around a shared pot, one of them lit.
 *
 * `members` houses sit on the ring and the one at `turn` is the household
 * receiving this month. The ring is the whole idea of an Equb in a single
 * picture: everybody pays in, one household is paid, and next month it moves.
 */
export function Circle({ members = 8, turn = 0, className, style }: P & { members?: number; turn?: number }) {
  const n = Math.min(Math.max(Math.round(members), 3), 16);
  const cx = 160, cy = 130, r = 96;
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const lit = ((turn % n) + n) % n;
  return (
    <svg aria-hidden viewBox="0 0 320 260" className={className} style={base(style)}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 6" opacity=".35" />
      {/* the pot */}
      <circle cx={cx} cy={cy} r="30" fill="currentColor" opacity=".07" />
      <circle cx={cx} cy={cy} r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="19" fontWeight="600" fill="currentColor" fontFamily="inherit">$</text>
      {/* every household feeds the pot; the lit one is fed by it */}
      {Array.from({ length: n }, (_, i) => {
        const p = at(i);
        const isLit = i === lit;
        const ux = (cx - p.x) / r, uy = (cy - p.y) / r;
        const from = isLit ? { x: cx - ux * 34, y: cy - uy * 34 } : { x: p.x + ux * 20, y: p.y + uy * 20 };
        const to = isLit ? { x: p.x + ux * 20, y: p.y + uy * 20 } : { x: cx - ux * 34, y: cy - uy * 34 };
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor"
              strokeWidth={isLit ? 2 : 1} opacity={isLit ? 0.9 : 0.28} strokeDasharray={isLit ? undefined : "2 4"} />
            <circle cx={to.x} cy={to.y} r={isLit ? 3.2 : 1.8} fill="currentColor" opacity={isLit ? 0.9 : 0.35} />
            <House x={p.x} y={p.y - 4} s={isLit ? 1.25 : 0.95} filled={isLit} />
          </g>
        );
      })}
      {/* the keys, on the household whose turn it is */}
      <g transform={`translate(${at(lit).x + 17} ${at(lit).y - 16})`} stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <circle cx="0" cy="0" r="4" />
        <path d="M4 0 H14 M10 0 V4 M13.5 0 V3" />
      </g>
    </svg>
  );
}

/** Five small drawings, one per step of "How it works", in order. */
export function StepIcon({ n, className, style }: P & { n: 1 | 2 | 3 | 4 | 5 }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className} style={{ width: 44, height: 44, flex: "none", ...style }}>
      {n === 1 && (<g {...common}>{/* three people, one seat held open */}
        <circle cx="14" cy="18" r="4" /><path d="M7 33 q0 -9 7 -9 q7 0 7 9" />
        <circle cx="34" cy="18" r="4" /><path d="M27 33 q0 -9 7 -9 q7 0 7 9" />
        <circle cx="24" cy="12" r="4" strokeDasharray="2.5 3" opacity=".6" /><path d="M17 27 q2 -4 7 -4" strokeDasharray="2.5 3" opacity=".6" />
      </g>)}
      {n === 2 && (<g {...common}>{/* a held pot with a lock, coins in */}
        <rect x="10" y="22" width="28" height="18" rx="3" /><path d="M17 22 v-4 a7 7 0 0 1 14 0 v4" />
        <circle cx="24" cy="31" r="2.2" /><path d="M24 33 v3" />
        <circle cx="8" cy="10" r="2" opacity=".6" /><circle cx="40" cy="12" r="2" opacity=".6" />
      </g>)}
      {n === 3 && (<g {...common}>{/* a document with a rising check */}
        <path d="M13 6 h16 l8 8 v28 h-24 z" /><path d="M29 6 v8 h8" />
        <path d="M18 30 l4 4 l9 -10" />
      </g>)}
      {n === 4 && (<g {...common}>{/* the pot, an arrow, a house */}
        <rect x="5" y="26" width="12" height="12" rx="2" />
        <path d="M19 32 H29 M26 28 l4 4 l-4 4" />
        <path d="M30 22 l9 -9 l8 9 M33 21 v17 h12 v-17" transform="translate(-6 0)" />
      </g>)}
      {n === 5 && (<g {...common}>{/* a door, ajar, and a key */}
        <path d="M12 40 V12 l12 -6 l12 6 v28 z" /><path d="M20 40 V26 h8 v14" />
        <circle cx="30" cy="33" r="0.9" fill="currentColor" />
      </g>)}
    </svg>
  );
}

/**
 * The payout ladder for the example: one tick per month, every member's month
 * marked, and the same height each time. That equal height is the claim:
 * nobody gets more money for being early, only the money sooner. `focus` is the
 * month drawn lit, 1-indexed.
 */
export function Ladder({ months, focus = 1, className, style, label }: P & { months: number; focus?: number; label?: string }) {
  const n = Math.min(Math.max(Math.round(months), 2), 60);
  const W = 320, H = 96, pad = 10, bw = (W - pad * 2) / n;
  return (
    <svg role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      viewBox={`0 0 ${W} ${H}`} className={className} style={base(style)}>
      <line x1={pad} y1={H - 14} x2={W - pad} y2={H - 14} stroke="currentColor" strokeWidth="1.2" opacity=".4" />
      {Array.from({ length: n }, (_, i) => {
        const on = i + 1 === focus;
        return (
          <rect key={i} x={pad + i * bw + bw * 0.18} y={on ? 14 : 28} width={bw * 0.64} height={H - 14 - (on ? 14 : 28)} rx="1.5"
            fill="currentColor" opacity={on ? 0.9 : 0.2} />
        );
      })}
      <text x={pad} y={H - 2} fontSize="9" fill="currentColor" opacity=".6" fontFamily="inherit">month 1</text>
      <text x={W - pad} y={H - 2} fontSize="9" fill="currentColor" opacity=".6" textAnchor="end" fontFamily="inherit">month {n}</text>
    </svg>
  );
}

/** The shared dashboard: a ledger every member can see, one row per payment. */
export function Ledger({ className, style }: P) {
  const rows = [0.9, 0.7, 0.82, 0.6, 0.74];
  return (
    <svg aria-hidden viewBox="0 0 320 170" className={className} style={base(style)}>
      <rect x="14" y="10" width="292" height="150" rx="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 38 H306" stroke="currentColor" strokeWidth="1.2" opacity=".4" />
      <circle cx="30" cy="24" r="3" fill="currentColor" opacity=".5" /><circle cx="42" cy="24" r="3" fill="currentColor" opacity=".3" />
      {rows.map((w, i) => (
        <g key={i} transform={`translate(0 ${50 + i * 21})`}>
          <circle cx="32" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".6" />
          <rect x="46" y="2" width={120 * w} height="8" rx="2" fill="currentColor" opacity=".18" />
          <path d="M268 6 l4 4 l8 -9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="226" y="2" width="30" height="8" rx="2" fill="currentColor" opacity=".3" />
        </g>
      ))}
    </svg>
  );
}

/** Funds going to the closing table, not to a person: pot, then attorney, then the house. */
export function ToClosing({ className, style }: P) {
  return (
    <svg aria-hidden viewBox="0 0 320 110" className={className} style={base(style)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="12" y="38" width="44" height="40" rx="6" /><path d="M23 38 v-6 a11 11 0 0 1 22 0 v6" />
        <path d="M66 58 H112 M104 51 l8 7 l-8 7" strokeDasharray="1 0" />
        <path d="M138 30 h44 v56 h-44 z M148 44 h24 M148 54 h24 M148 64 h14" />
        <path d="M192 58 H238 M230 51 l8 7 l-8 7" />
        <path d="M246 58 l32 -28 l32 28 M254 52 v34 h48 v-34" /><path d="M272 86 v-16 h12 v16" />
      </g>
      <text x="34" y="100" textAnchor="middle" fontSize="9" fill="currentColor" opacity=".65" fontFamily="inherit">held</text>
      <text x="160" y="100" textAnchor="middle" fontSize="9" fill="currentColor" opacity=".65" fontFamily="inherit">your closing attorney</text>
      <text x="278" y="100" textAnchor="middle" fontSize="9" fill="currentColor" opacity=".65" fontFamily="inherit">your home</text>
    </svg>
  );
}
