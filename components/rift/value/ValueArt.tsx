/**
 * One small drawing per value (manual review WS9.2): the picture on every card
 * that links to a value, on the home, buy, sell and abroad pages alike, so a
 * value looks the same wherever it appears.
 *
 * Unlike the artifacts beside the figures (artifacts.tsx), these carry no
 * numbers. They say what the question is about, not what the answer is, so
 * they are decorative to a screen reader (`aria-hidden`): the card's own
 * heading already says it in words. Line art in the theme's tokens, so it
 * works in light and dark without a second set.
 */

import type { CSSProperties, ReactNode } from "react";

const S = { stroke: "var(--ink-3)", strokeWidth: 1.6, fill: "none", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const B = { ...S, stroke: "var(--brand)" } as const;
const FILL = "var(--brand-wash)";

const house = (x: number, y: number, w: number, h: number, accent = false) => (
  <g {...(accent ? B : S)}>
    <path d={`M${x - 6} ${y} L${x + w / 2} ${y - h * 0.55} L${x + w + 6} ${y}`} />
    <path d={`M${x} ${y - 4} V${y + h} H${x + w} V${y - 4}`} />
    <rect x={x + w / 2 - 6} y={y + h - 18} width="12" height="18" />
  </g>
);

const ART: Record<string, ReactNode> = {
  /* Assistance: a hand under a house. */
  assistance: (
    <>
      {house(58, 34, 44, 30, true)}
      <path {...S} d="M30 78 C48 72 62 74 76 78 L112 78 C120 78 122 86 114 87 L84 88" />
      <path {...S} d="M30 86 L52 92 L104 92 L136 74" />
    </>
  ),
  /* Cash to close: stacked notes rising into a roof. */
  cash: (
    <>
      <path {...B} d="M52 34 L80 14 L108 34" />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x="56" y={38 + k * 12} width="48" height="9" rx="2" {...(k === 3 ? B : S)} fill={k === 3 ? FILL : "none"} />
      ))}
      <circle cx="80" cy="42.5" r="2" fill="var(--ink-4)" />
    </>
  ),
  /* Monthly cost: a calendar page with one day marked. */
  monthly: (
    <>
      <rect {...S} x="48" y="20" width="64" height="58" rx="4" />
      <path {...S} d="M48 34 H112 M62 14 V26 M98 14 V26" />
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={54 + c * 11.5} y={39 + r * 9.5} width="6" height="5" rx="1"
          fill={r === 1 && c === 0 ? "var(--brand)" : "var(--line-2)"} />
      )))}
    </>
  ),
  /* Timeline: a path of steps to a house. */
  timeline: (
    <>
      <path {...S} d="M20 80 H44 V66 H68 V52 H92" strokeDasharray="3 4" />
      {[20, 44, 68].map((x, k) => <circle key={x} cx={x} cy={80 - k * 14} r="3.5" fill="var(--ink-4)" />)}
      {house(100, 44, 36, 30, true)}
    </>
  ),
  /* What fits: three houses, the middle one chosen. */
  afford: (
    <>
      {house(18, 52, 28, 22)}
      {house(64, 40, 34, 34, true)}
      {house(116, 56, 24, 18)}
      <path {...S} d="M12 86 H148" />
    </>
  ),
  /* Lender questions: a page and a question mark. */
  lender: (
    <>
      <path {...S} d="M50 14 H96 L110 28 V84 H50 Z M96 14 V28 H110" />
      <path {...S} d="M60 40 H96 M60 50 H88 M60 60 H92" />
      <circle {...B} cx="112" cy="70" r="15" fill={FILL} />
      <path {...B} d="M107 66 C107 60 117 60 117 66 C117 70 112 70 112 74 M112 79 V79.5" />
    </>
  ),
  /* What you'd keep: a sale price bar with what you keep left over. */
  proceeds: (
    <>
      <rect {...S} x="18" y="32" width="124" height="18" rx="3" />
      <rect x="18" y="32" width="58" height="18" rx="3" fill="var(--line-2)" />
      <rect x="76" y="32" width="66" height="18" rx="3" fill="var(--brand)" />
      <path {...S} d="M18 60 V66 H76 V60" />
      <path {...B} d="M76 60 V66 H142 V60" />
      <path {...B} d="M109 66 V78" />
      <circle {...B} cx="109" cy="82" r="4" fill={FILL} />
    </>
  ),
  /* Money you may be losing: a house with coins slipping out. */
  unclaimed: (
    <>
      {house(40, 36, 46, 34)}
      <path {...S} d="M86 60 C98 60 104 66 108 72" />
      {[[112, 76], [126, 84], [138, 72]].map(([x, y]) => (
        <g key={x}><circle {...B} cx={x} cy={y} r="6" fill={FILL} /><path {...B} d={`M${x} ${y - 3} V${y + 3}`} /></g>
      ))}
    </>
  ),
  /* Selling costs: a price tag split into blocks. */
  costs: (
    <>
      <path {...S} d="M34 30 H112 L130 50 L112 70 H34 Z" />
      <circle {...S} cx="114" cy="50" r="3.5" />
      <rect x="42" y="40" width="22" height="20" rx="2" fill="var(--brand)" />
      <rect x="66" y="40" width="14" height="20" rx="2" fill={FILL} stroke="var(--brand-line)" />
      <rect x="82" y="40" width="10" height="20" rx="2" fill={FILL} stroke="var(--brand-line)" />
    </>
  ),
  /* Should I fix it first: a house with a wrench. */
  prepare: (
    <>
      {house(30, 38, 50, 36)}
      <path {...B} d="M104 30 a12 12 0 1 0 14 14 L136 62 a5 5 0 0 1 -7 7 L111 51 a12 12 0 0 0 -7 -21 Z" fill={FILL} />
    </>
  ),
  /* Can I buy in the US: a globe and a house across an arc. */
  eligibility: (
    <>
      <circle {...S} cx="38" cy="58" r="20" />
      <path {...S} d="M18 58 H58 M38 38 C28 50 28 66 38 78 M38 38 C48 50 48 66 38 78" />
      <path {...S} d="M58 44 Q86 10 112 40" strokeDasharray="3 4" />
      {house(108, 50, 34, 28, true)}
    </>
  ),
  /* Cost to buy and own: a house over a ledger. */
  "abroad-cost": (
    <>
      {house(36, 30, 40, 30, true)}
      <rect {...S} x="90" y="22" width="48" height="58" rx="3" />
      <path {...S} d="M98 36 H130 M98 48 H130 M98 60 H122" />
      <path {...B} d="M98 72 H130" />
    </>
  ),
  /* The return: a house with a rising line beside it. */
  "abroad-return": (
    <>
      {house(24, 44, 40, 30)}
      <path {...S} d="M84 82 H146 M84 82 V24" />
      <path {...B} d="M88 72 L104 60 L118 64 L140 34" />
      <path {...B} d="M130 34 H140 V44" />
    </>
  ),
  /* Equb: a circle of members around a house. */
  equb: (
    <>
      <circle {...S} cx="80" cy="52" r="32" strokeDasharray="2 5" />
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return <circle key={k} cx={80 + 32 * Math.cos(a)} cy={52 + 32 * Math.sin(a)} r="5" fill={k === 0 ? "var(--brand)" : "var(--paper)"} stroke={k === 0 ? "var(--brand)" : "var(--ink-4)"} strokeWidth="1.4" />;
      })}
      {house(68, 50, 24, 16, true)}
    </>
  ),
};

/** The drawing for a value, by its id in lib/core/values.ts (plus "equb"). Nothing for an id without one. */
export function ValueArt({ id, style, className }: { id: string; style?: CSSProperties; className?: string }) {
  const art = ART[id];
  if (!art) return null;
  return (
    <svg aria-hidden viewBox="0 0 160 96" className={className}
      style={{ width: "100%", maxWidth: 220, height: "auto", display: "block", ...style }}>
      {art}
    </svg>
  );
}

export const hasValueArt = (id: string) => id in ART;
