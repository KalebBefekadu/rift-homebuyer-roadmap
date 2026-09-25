/**
 * The custom artifacts: one drawing made for each value (Blueprint v5 §4.5,
 * decision D13).
 *
 * Rules every drawing here keeps:
 *   * Its proportions come from the same computed output as the table beside
 *     it. A drawing sized by hand would be making the argument dishonestly.
 *   * It has a text equivalent: `aria-label` states the figures, and the table
 *     on the page carries every number (CAMP-04).
 *   * It has a fixed aspect ratio, so it never shifts the layout as it loads
 *     (QUALITY-03), and its motion is slow and stops under reduced motion (the
 *     global rule in rift.css).
 *   * Architectural geometry and the side's own colour, no photographs.
 */

import type { CSSProperties } from "react";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const short = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 10_000 ? `$${Math.round(n / 1_000)}k` : money(n));

const frame: CSSProperties = { width: "100%", height: "auto", display: "block", overflow: "visible" };

/** Spread label positions so none sit closer than `gap`, keeping order. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const out = [...ys];
  for (let k = 1; k < out.length; k++) if (out[k] - out[k - 1] < gap) out[k] = out[k - 1] + gap;
  const over = out.length ? out[out.length - 1] - hi : 0;
  if (over > 0) for (let k = 0; k < out.length; k++) out[k] -= over;
  for (let k = out.length - 2; k >= 0; k--) if (out[k + 1] - out[k] < gap) out[k] = out[k + 1] - gap;
  return out.map((y) => Math.max(lo, y));
}

/* ------------------------------------------------------------------ *
 * Cash to close: the pieces of cash, built up into the home
 * ------------------------------------------------------------------ */

export function CashStack({ lines, total, down }: {
  lines: { label: string; amount: number; credited?: boolean }[];
  total: number;
  down: number;
}) {
  const paid = lines.filter((l) => !l.credited && l.amount > 0);
  const earnest = lines.find((l) => l.credited);
  const W = 360, H = 300, x = 36, w = 128, base = 272, top = 70, span = base - top;
  let y = base;
  const blocks = paid.map((l) => {
    const h = Math.max((l.amount / total) * span, 3);
    y -= h;
    return { ...l, y, h };
  });
  const roofY = blocks.length ? blocks[blocks.length - 1].y : top;
  const labelYs = spread(blocks.map((b) => b.y + b.h / 2).reverse(), 30, 34, base - 8).reverse();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={`Cash to close ${money(total)}, of which the down payment is ${money(down)}.`}>
      <line x1={x - 18} y1={base} x2={x + w + 18} y2={base} stroke="var(--ink)" strokeWidth="2" />
      {blocks.map((b, k) => (
        <rect key={b.label} x={x} y={b.y} width={w} height={b.h - 1.5} rx="2"
          fill={k === 0 ? "var(--brand)" : "var(--sunk)"} stroke={k === 0 ? "none" : "var(--ink-5)"} strokeWidth="1"
          className="art-rise" style={{ animationDelay: `${k * 90}ms` }} />
      ))}
      <path d={`M${x - 10} ${roofY - 2} L${x + w / 2} ${roofY - 46} L${x + w + 10} ${roofY - 2}`}
        fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" className="art-rise"
        style={{ animationDelay: `${blocks.length * 90}ms` }} />
      <text x={x + w / 2} y={roofY - 14} textAnchor="middle" className="art-num" fontSize="17" fill="var(--ink)">{short(total)}</text>
      {blocks.map((b, k) => (
        <g key={b.label}>
          <path d={`M${x + w + 4} ${b.y + b.h / 2} L${x + w + 22} ${labelYs[k]}`} stroke="var(--ink-5)" fill="none" />
          <text x={x + w + 28} y={labelYs[k] - 2} fontSize="12" fill={k === 0 ? "var(--brand-2)" : "var(--ink-3)"} fontWeight={k === 0 ? 600 : 450}>{b.label}</text>
          <text x={x + w + 28} y={labelYs[k] + 13} fontSize="12.5" className="art-num" fill="var(--ink)">{money(b.amount)}</text>
        </g>
      ))}
      {earnest ? (
        <g>
          <rect x={x + 18} y={base + 8} width={w - 36} height="0" />
          <text x={x + w / 2} y={base + 22} textAnchor="middle" fontSize="11" fill="var(--ink-4)">
            + {money(earnest.amount)} earnest money, back at closing
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Monthly cost: three homes, three prices, each as tall as its payment
 * ------------------------------------------------------------------ */

export function MonthlyHomes({ band, parts, focus }: {
  band: { price: number; monthly: number }[];
  parts: { label: string; amount: number }[];
  /** Index in `band` of the person's own price. */
  focus: number;
}) {
  const W = 360, H = 290, base = 250, maxH = 170;
  const peak = Math.max(...band.map((b) => b.monthly), 1);
  const colW = 84, gap = 26, x0 = (W - (colW * 3 + gap * 2)) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={band.map((b) => `${money(b.monthly)} a month at ${money(b.price)}`).join("; ")}>
      <line x1="12" y1={base} x2={W - 12} y2={base} stroke="var(--ink)" strokeWidth="2" />
      {band.map((b, k) => {
        const h = (b.monthly / peak) * maxH;
        const x = x0 + k * (colW + gap);
        const on = k === focus;
        const wallTop = base - h;
        let yy = base;
        return (
          <g key={b.price} className="art-rise" style={{ animationDelay: `${k * 120}ms` }}>
            {on
              ? parts.filter((p) => p.amount > 0).map((p, j) => {
                  const ph = (p.amount / b.monthly) * h;
                  yy -= ph;
                  return <rect key={p.label} x={x} y={yy} width={colW} height={Math.max(ph - 1.5, 1)}
                    fill={j === 0 ? "var(--brand)" : "var(--brand-wash)"} stroke={j === 0 ? "none" : "var(--brand-line)"} />;
                })
              : <rect x={x} y={wallTop} width={colW} height={h} fill="var(--sunk)" stroke="var(--ink-5)" />}
            <path d={`M${x - 7} ${wallTop} L${x + colW / 2} ${wallTop - 30} L${x + colW + 7} ${wallTop}`}
              fill="none" stroke={on ? "var(--ink)" : "var(--ink-5)"} strokeWidth={on ? 2 : 1.5} strokeLinejoin="round" />
            <text x={x + colW / 2} y={wallTop - 38} textAnchor="middle" fontSize={on ? 15 : 12.5} className="art-num"
              fill={on ? "var(--ink)" : "var(--ink-3)"}>{money(Math.round(b.monthly))}</text>
            <text x={x + colW / 2} y={base + 18} textAnchor="middle" fontSize="11.5" fill={on ? "var(--ink)" : "var(--ink-4)"} fontWeight={on ? 600 : 450}>
              {short(b.price)}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={base + 36} textAnchor="middle" fontSize="11" fill="var(--ink-4)">home price, and what it costs each month</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Timeline: today, the months between, and the home at the end
 * ------------------------------------------------------------------ */

export function TimelinePath({ months, faster }: {
  /** null: no saving rate, so no date. 0: ready now. */
  months: number | null;
  /** The best lever, as months it would take instead. */
  faster: { label: string; months: number } | null;
}) {
  const W = 360, H = 200, x0 = 26, x1 = 300, y = 120;
  const n = months ?? 0;
  const ticks = months && months > 0 ? Math.min(months, 36) : 0;
  const fx = faster && months ? x0 + ((x1 - x0) * faster.months) / months : null;
  const label = months === null ? "Add a monthly saving to see a date" : months === 0 ? "Ready now" : `${n} month${n === 1 ? "" : "s"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={`${label}${faster ? `; ${faster.label} makes it ${faster.months} months` : ""}.`}>
      <circle cx={x0} cy={y} r="6" fill="var(--ink)" />
      <text x={x0} y={y + 26} textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">Today</text>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={months === null ? "var(--ink-5)" : "var(--brand)"} strokeWidth="3"
        strokeDasharray={months === null ? "4 6" : undefined} className="art-draw" />
      {Array.from({ length: ticks }, (_, k) => {
        const tx = x0 + ((x1 - x0) * (k + 1)) / ticks;
        return <line key={k} x1={tx} y1={y - 5} x2={tx} y2={y + 5} stroke="var(--brand)" strokeWidth="1" opacity=".55" />;
      })}
      {fx !== null ? (
        <g>
          <path d={`M${x0} ${y} Q${(x0 + fx) / 2} ${y - 70} ${fx} ${y}`} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 4" />
          <circle cx={fx} cy={y} r="4.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x={(x0 + fx) / 2} y={y - 44} textAnchor="middle" fontSize="11.5" fill="var(--ink-2)">{faster!.months} months with one change</text>
        </g>
      ) : null}
      <g stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" strokeLinejoin="round">
        <path d={`M${x1 + 4} ${y + 12} L${x1 + 4} ${y - 14} L${x1 + 22} ${y - 30} L${x1 + 40} ${y - 14} L${x1 + 40} ${y + 12} Z`} />
      </g>
      <text x={x1 + 22} y={y + 34} textAnchor="middle" fontSize="15" className="art-num" fill="var(--ink)">{months === null ? "?" : label}</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Assistance: programs as steps up to the door
 * ------------------------------------------------------------------ */

export function AssistanceSteps({ steps, need }: {
  steps: { name: string; max: number; open: boolean }[];
  /** Cash to close, for scale. */
  need: number;
}) {
  const W = 360, H = 250, base = 222, x0 = 16, doorX = 262;
  const shown = steps.slice(0, 5);
  const stepW = shown.length ? (doorX - x0 - 8) / shown.length : 0;
  const unit = 120 / Math.max(need, shown.reduce((s, p) => s + p.max, 0), 1);
  let h = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={shown.length ? `${shown.length} potential programs: ${shown.map((s) => `${s.name}, up to ${money(s.max)}`).join("; ")}.` : "No potential programs for these answers."}>
      <line x1="8" y1={base} x2={W - 8} y2={base} stroke="var(--ink)" strokeWidth="2" />
      {shown.map((s, k) => {
        h += Math.max(s.max * unit, 10);
        const x = x0 + k * stepW;
        return (
          <g key={s.name} className="art-rise" style={{ animationDelay: `${k * 110}ms` }}>
            <rect x={x} y={base - h} width={stepW - 3} height={h} rx="2"
              fill={s.open ? "var(--brand)" : "var(--sunk)"} opacity={s.open ? 0.18 + 0.16 * (k + 1) : 1}
              stroke={s.open ? "none" : "var(--ink-5)"} strokeDasharray={s.open ? undefined : "3 3"} />
            <text x={x + (stepW - 3) / 2} y={base - h - 8} textAnchor="middle" fontSize="11.5" className="art-num" fill="var(--ink)">{short(s.max)}</text>
          </g>
        );
      })}
      <g stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d={`M${doorX} ${base} L${doorX} ${base - 150} L${doorX + 34} ${base - 182} L${doorX + 68} ${base - 150} L${doorX + 68} ${base}`} />
        <rect x={doorX + 22} y={base - 58} width="24" height="58" fill="var(--paper)" />
      </g>
      <circle cx={doorX + 41} cy={base - 30} r="2" fill="var(--ink)" />
      {!shown.length ? <text x={(doorX + x0) / 2} y={base - 20} textAnchor="middle" fontSize="12" fill="var(--ink-4)">Nothing verified fits yet</text> : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Seller: from the price to what you keep
 * ------------------------------------------------------------------ */

export function ProceedsFlow({ price, parts, net }: {
  price: number;
  parts: { label: string; amount: number }[];
  net: number;
}) {
  const W = 360, rowH = 30, top = 18;
  const rows = [{ label: "Sale price", amount: price, kind: "price" as const },
    ...parts.filter((p) => p.amount > 0).map((p) => ({ ...p, kind: "cost" as const })),
    /* A sale below the payoff is a real outcome: said as what it is, never
       as money reaching them (lib/core/announce.test.ts). */
    { label: net < 0 ? "Short at closing" : "Reaches you", amount: net, kind: "net" as const }];
  const H = top + rows.length * rowH + 14;
  const x0 = 120, span = W - x0 - 14;
  /* The scale runs from the lowest point the money reaches to the price. Below
     the payoff that lowest point is under zero, and a scale starting at zero
     drew the payoff bar straight through its own label. */
  const lo = Math.min(0, net);
  const unit = span / Math.max(price - lo, 1);
  const at = (v: number) => x0 + (v - lo) * unit;
  let run = price;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={net < 0
        ? `A ${money(price)} sale leaves ${money(-net)} to bring to closing after ${parts.map((p) => `${p.label} ${money(p.amount)}`).join(", ")}.`
        : `From a ${money(price)} sale, ${money(net)} reaches you after ${parts.map((p) => `${p.label} ${money(p.amount)}`).join(", ")}.`}>
      {lo < 0 ? <line x1={at(0)} y1={top - 4} x2={at(0)} y2={H - 6} stroke="var(--ink-4)" strokeWidth="1" /> : null}
      {rows.map((r, k) => {
        const y = top + k * rowH;
        let x = at(0), w = r.amount * unit, fill = "var(--sunk)";
        if (r.kind === "price") { fill = "var(--ink)"; }
        else if (r.kind === "cost") { run -= r.amount; x = at(run); fill = "var(--ink-5)"; }
        else if (net < 0) { x = at(net); w = -net * unit; fill = "var(--neg)"; }
        else { fill = "var(--brand)"; }
        const labelFill = r.kind === "net" ? (net < 0 ? "var(--neg)" : "var(--brand-2)") : "var(--ink-3)";
        return (
          <g key={r.label} className="art-rise" style={{ animationDelay: `${k * 80}ms` }}>
            <text x={x0 - 10} y={y + 15} textAnchor="end" fontSize="11.5" fill={labelFill} fontWeight={r.kind === "cost" ? 450 : 600}>{r.label}</text>
            <rect x={x} y={y + 3} width={Math.max(w, 2)} height={rowH - 10} rx="2" fill={fill} />
            {r.kind === "cost" ? <line x1={x} y1={y - 5} x2={x} y2={y + 3} stroke="var(--ink-5)" strokeDasharray="2 2" /> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Selling costs as a row of blocks, each sized by its share. */
export function CostBlocks({ parts, total }: { parts: { label: string; amount: number }[]; total: number }) {
  const W = 360, H = 120, y = 30, h = 46;
  let x = 10;
  const span = W - 20;
  const shown = parts.filter((p) => p.amount > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={`Selling costs ${money(total)}: ${shown.map((p) => `${p.label} ${money(p.amount)}`).join(", ")}.`}>
      {shown.map((p, k) => {
        const w = (p.amount / Math.max(total, 1)) * span;
        const bx = x;
        x += w;
        return (
          <g key={p.label} className="art-rise" style={{ animationDelay: `${k * 90}ms` }}>
            <rect x={bx} y={y} width={Math.max(w - 2, 1)} height={h} rx="2" fill={k === 0 ? "var(--brand)" : "var(--brand-wash)"} stroke={k === 0 ? "none" : "var(--brand-line)"} />
            {w > 46 ? <text x={bx + 6} y={y + h + 16} fontSize="11" fill="var(--ink-3)">{p.label.split(" ")[0]}</text> : null}
          </g>
        );
      })}
      <text x="10" y="20" fontSize="12.5" className="art-num" fill="var(--ink)">{money(total)}</text>
    </svg>
  );
}

/** Preparation: three rooms of one house, worth it, maybe, not yet. */
export function PrepRooms({ counts }: { counts: { now: number; maybe: number; skip: number } }) {
  const W = 360, H = 200, x = 30, w = 300, base = 176, wall = 96;
  const rooms = [
    { label: "Worth doing", n: counts.now, fill: "var(--brand)" },
    { label: "Maybe", n: counts.maybe, fill: "var(--brand-wash)" },
    { label: "Not yet", n: counts.skip, fill: "var(--sunk)" },
  ];
  const rw = w / 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={rooms.map((r) => `${r.label}: ${r.n}`).join(", ")}>
      <path d={`M${x - 10} ${base - wall} L${x + w / 2} ${base - wall - 56} L${x + w + 10} ${base - wall}`} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      {rooms.map((r, k) => (
        <g key={r.label} className="art-rise" style={{ animationDelay: `${k * 110}ms` }}>
          <rect x={x + k * rw} y={base - wall} width={rw} height={wall} fill={r.fill} stroke="var(--ink)" strokeWidth="1.5" />
          <text x={x + k * rw + rw / 2} y={base - wall / 2 + 4} textAnchor="middle" fontSize="26" className="art-num" fill={k === 0 ? "#fff" : "var(--ink)"}>{r.n}</text>
          <text x={x + k * rw + rw / 2} y={base + 18} textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">{r.label}</text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Unclaimed money: one tag per thing worth a call, hung from the house.
 * The count is the headline; each tag carries its own word (rule 10).
 */
export function ClaimTags({ items }: { items: { title: string; urgent: boolean }[] }) {
  const W = 360, rowH = 34, top = 64;
  const H = top + Math.max(items.length, 1) * rowH + 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ ...frame, overflow: "hidden" }} role="img"
      aria-label={items.length ? `${items.length} worth a call: ${items.map((i) => i.title).join("; ")}.` : "Nothing obvious to chase."}>
      <path d="M40 52 L80 18 L120 52 Z" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="52" y="52" width="56" height="34" fill="var(--brand-wash)" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1="120" y1="40" x2={W - 20} y2="40" stroke="var(--line)" />
      <text x="136" y="32" fontSize="26" className="art-num" fill="var(--ink)">{items.length}</text>
      <text x="164" y="32" fontSize="12" fill="var(--ink-3)">worth a call</text>
      {items.length ? items.map((it, k) => {
        const y = top + k * rowH;
        /* Short enough to stay inside its tag at 11px: the full title is in
           the list beside the drawing, and in the aria-label. */
        const room = it.urgent ? 20 : 30;
        const label = it.title.length > room ? it.title.slice(0, room - 1) + "…" : it.title;
        return (
          <g key={it.title} className="art-rise" style={{ animationDelay: `${k * 90}ms` }}>
            <line x1="130" y1="40" x2="150" y2={y + 13} stroke="var(--line)" />
            <rect x="150" y={y} width={W - 170} height={rowH - 8} rx="4" fill={k === 0 ? "var(--brand)" : "var(--paper)"} stroke={k === 0 ? "none" : "var(--brand-line)"} />
            <text x="160" y={y + 17} fontSize="11" fill={k === 0 ? "#fff" : "var(--ink-2)"}>{it.urgent ? "Deadline · " : ""}{label}</text>
          </g>
        );
      }) : (
        <text x="150" y={top + 17} fontSize="12" fill="var(--ink-3)">Nothing obvious to chase</text>
      )}
    </svg>
  );
}

/**
 * Can I buy: the smallest down payment for each residency situation, as four
 * columns, with the reader's own filled. The heights are the lenders' floors
 * from lib/core/abroad.ts, so the drawing and the table cannot disagree.
 */
export function DownFloors({ floors, mine }: { floors: { id: string; label: string; pct: number }[]; mine: string }) {
  const W = 360, H = 200, base = 160, maxH = 120;
  const max = Math.max(...floors.map((f) => f.pct), 1);
  const colW = (W - 40) / floors.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={floors.map((f) => `${f.label}: ${f.pct}% down${f.id === mine ? " (you)" : ""}`).join(", ")}>
      <line x1="16" y1={base} x2={W - 16} y2={base} stroke="var(--ink)" strokeWidth="1.5" />
      {floors.map((f, k) => {
        const h = (f.pct / max) * maxH;
        const x = 20 + k * colW + colW * 0.2;
        const w = colW * 0.6;
        const on = f.id === mine;
        return (
          <g key={f.id} className="art-rise" style={{ animationDelay: `${k * 90}ms` }}>
            <rect x={x} y={base - h} width={w} height={h} rx="2" fill={on ? "var(--brand)" : "var(--brand-wash)"} stroke={on ? "none" : "var(--brand-line)"} />
            <text x={x + w / 2} y={base - h - 8} textAnchor="middle" fontSize="13" className="art-num" fill="var(--ink)">{f.pct}%</text>
            <text x={x + w / 2} y={base + 18} textAnchor="middle" fontSize="10.5" fill={on ? "var(--brand-2)" : "var(--ink-3)"} fontWeight={on ? 600 : 400}>{f.label}</text>
            {on ? <text x={x + w / 2} y={base + 32} textAnchor="middle" fontSize="10" fill="var(--brand-2)">You</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Lender questions: a clipboard, one line per question, sized by the count. */
export function QuestionSheet({ count }: { count: number }) {
  const W = 360, H = 220, x = 110, w = 140, top = 30;
  const rows = Math.min(count, 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img" aria-label={`${count} questions to ask a lender.`}>
      <rect x={x} y={top} width={w} height={H - top - 12} rx="6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x={x + w / 2 - 22} y={top - 8} width="44" height="16" rx="4" fill="var(--ink)" />
      {Array.from({ length: rows }, (_, k) => {
        const y = top + 26 + k * 16;
        return (
          <g key={k} className="art-rise" style={{ animationDelay: `${k * 60}ms` }}>
            <circle cx={x + 16} cy={y} r="3" fill={k < 3 ? "var(--brand)" : "var(--brand-line)"} />
            <rect x={x + 26} y={y - 3} width={w - 44 - (k % 3) * 14} height="6" rx="3" fill="var(--sunk)" />
          </g>
        );
      })}
      <text x={x + w + 16} y={top + 30} fontSize="28" className="art-num" fill="var(--ink)">{count}</text>
      <text x={x + w + 16} y={top + 48} fontSize="11.5" fill="var(--ink-3)">to ask</text>
    </svg>
  );
}

/** How much home fits: one line of prices, the comfortable and stretch marks on it. */
export function AffordBand({ comfortable, stretch }: { comfortable: number | null; stretch: number | null }) {
  const W = 360, H = 170, x0 = 24, x1 = W - 24, y = 96;
  const top = Math.max(stretch ?? 0, comfortable ?? 0, 1) * 1.15;
  const at = (p: number) => x0 + (p / top) * (x1 - x0);
  const house = (px: number, fill: string, label: string, value: number, k: number) => (
    <g className="art-rise" style={{ animationDelay: `${k * 120}ms` }}>
      <path d={`M${px - 16} ${y - 22} L${px} ${y - 38} L${px + 16} ${y - 22} Z`} fill={fill} />
      <rect x={px - 12} y={y - 22} width="24" height="22" fill={fill} />
      <line x1={px} y1={y} x2={px} y2={y + 10} stroke="var(--ink)" />
      <text x={px} y={y + 26} textAnchor="middle" fontSize="12.5" className="art-num" fill="var(--ink)">{short(value)}</text>
      <text x={px} y={y + 42} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{label}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={frame} role="img"
      aria-label={comfortable === null && stretch === null ? "No price fits these ratios."
        : `Comfortable ${comfortable === null ? "none" : money(comfortable)}, stretch ${stretch === null ? "none" : money(stretch)}.`}>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke="var(--line)" strokeWidth="2" />
      {comfortable !== null && stretch !== null ? <rect x={at(comfortable)} y={y - 3} width={Math.max(at(stretch) - at(comfortable), 2)} height="6" rx="3" fill="var(--brand-wash)" stroke="var(--brand-line)" /> : null}
      {comfortable !== null ? house(at(comfortable), "var(--brand)", "Comfortable", comfortable, 0) : null}
      {stretch !== null ? house(at(stretch), "var(--brand-line)", "Stretch", stretch, 1) : null}
    </svg>
  );
}
