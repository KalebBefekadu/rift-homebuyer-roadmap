import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 16 16", fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const Ico = {
  home: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2 6.5 8 2l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" /><path d="M6.5 14V9h3v5" /></svg>),
  spark: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 1.8 9.6 6l4.4 1.6L9.6 9.2 8 13.4 6.4 9.2 2 7.6 6.4 6 8 1.8Z" /></svg>),
  chart: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2 13.5h12" /><path d="M4 11V7" /><path d="M7.3 11V4" /><path d="M10.6 11V8.5" /><path d="M13.5 11V5.8" /></svg>),
  doc: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 1.8H4.5a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.3L9 1.8Z" /><path d="M9 1.8v3.5h3.5" /><path d="M6 8.5h4M6 11h3" /></svg>),
  users: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13.4c0-2.2 1.9-3.7 4.2-3.7s4.2 1.5 4.2 3.7" /><path d="M11 3.6a2.3 2.3 0 0 1 0 4.4" /><path d="M12.2 9.9c1.3.5 2.1 1.6 2.1 3.5" /></svg>),
  bolt: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8.8 1.5 3.3 8.9h3.6l-.7 5.6 5.5-7.4H8.1l.7-5.6Z" /></svg>),
  clock: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.3 1.6" /></svg>),
  check: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 8.4 6.3 11.6 13 4.8" /></svg>),
  checkCircle: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8" cy="8" r="6.2" /><path d="M5.3 8.2 7.2 10l3.5-4" /></svg>),
  alert: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 2.4 14.3 13H1.7L8 2.4Z" /><path d="M8 6.6v2.8" /><circle cx="8" cy="11.3" r=".55" fill="currentColor" stroke="none" /></svg>),
  info: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8" cy="8" r="6.2" /><path d="M8 7.4v3.4" /><circle cx="8" cy="5.4" r=".55" fill="currentColor" stroke="none" /></svg>),
  arrowR: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 8h10" /><path d="M9 4l4 4-4 4" /></svg>),
  arrowUpR: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 11 11 5" /><path d="M6 5h5v5" /></svg>),
  chevR: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 3.5 10.5 8 6 12.5" /></svg>),
  chevD: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3.5 6 8 10.5 12.5 6" /></svg>),
  chevL: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M10 3.5 5.5 8 10 12.5" /></svg>),
  minus: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3.5 8h9" /></svg>),
  plus: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 3.2v9.6M3.2 8h9.6" /></svg>),
  x: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>),
  search: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="7.2" cy="7.2" r="4.6" /><path d="M10.6 10.6 14 14" /></svg>),
  bell: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 6.6a4 4 0 0 1 8 0c0 3 1.2 4.2 1.2 4.2H2.8S4 9.6 4 6.6Z" /><path d="M6.6 13.2a1.6 1.6 0 0 0 2.8 0" /></svg>),
  cal: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.2" /><path d="M2.2 6.6h11.6M5.4 1.9v2.6M10.6 1.9v2.6" /></svg>),
  gift: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2" y="6.6" width="12" height="7.2" rx="1" /><path d="M1.4 6.6h13.2M8 6.6v7.2" /><path d="M8 6.6S7 3 5.4 3a1.6 1.6 0 0 0 0 3.6M8 6.6S9 3 10.6 3a1.6 1.6 0 0 1 0 3.6" /></svg>),
  key: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="5.4" cy="5.4" r="3.2" /><path d="M7.7 7.7 13.4 13.4M11.2 11.2l1.4-1.4M12.8 12.8l1.2-1.2" /></svg>),
  shield: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 1.8 13.2 4v4c0 3.3-2.4 5.4-5.2 6.2C5.2 13.4 2.8 11.3 2.8 8V4L8 1.8Z" /></svg>),
  lock: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3.2" y="7" width="9.6" height="7" rx="1.2" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" /></svg>),
  send: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M14 2 7.2 8.8M14 2l-4.4 12-2.4-5.2L2 6.4 14 2Z" /></svg>),
  set: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2.5 4.6h11M2.5 11.4h11" /><circle cx="6" cy="4.6" r="1.7" fill="var(--paper)" /><circle cx="10.4" cy="11.4" r="1.7" fill="var(--paper)" /></svg>),
  layers: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z" /><path d="M1.8 8.2 8 11.4l6.2-3.2M1.8 11.2 8 14.4l6.2-3.2" /></svg>),
  pin: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 14.2s4.8-4 4.8-7.6a4.8 4.8 0 1 0-9.6 0C3.2 10.2 8 14.2 8 14.2Z" /><circle cx="8" cy="6.4" r="1.8" /></svg>),
  mail: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.2" /><path d="m2.4 4.6 5.6 4 5.6-4" /></svg>),
  share: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M11.5 5.4 8 1.9 4.5 5.4M8 2.2v8.4" /><path d="M3 9.6v3.2a1.2 1.2 0 0 0 1.2 1.2h7.6a1.2 1.2 0 0 0 1.2-1.2V9.6" /></svg>),
  wallet: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><rect x="1.8" y="3.6" width="12.4" height="9" rx="1.4" /><path d="M1.8 6.6h12.4" /><circle cx="11.2" cy="9.8" r=".7" fill="currentColor" stroke="none" /></svg>),
  scale: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 2v12M4 4.6h8" /><path d="M4.6 4.8 2.4 9.4h4.4L4.6 4.8ZM11.4 4.8 9.2 9.4h4.4l-2.2-4.6Z" /></svg>),
  filter: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2 4h12M4.4 8h7.2M6.6 12h2.8" /></svg>),
  more: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="3.4" cy="8" r=".85" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".85" fill="currentColor" stroke="none" /><circle cx="12.6" cy="8" r=".85" fill="currentColor" stroke="none" /></svg>),
  pause: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 3.5v9M10 3.5v9" /></svg>),
  refresh: ({ size = 16, ...p }: P) => (<svg {...base(size)} {...p}><path d="M13.4 7a5.5 5.5 0 0 0-9.6-2.4L2 6.4" /><path d="M2 2.6v3.8h3.8" /><path d="M2.6 9a5.5 5.5 0 0 0 9.6 2.4L14 9.6" /><path d="M14 13.4V9.6h-3.8" /></svg>),
};

export function Mark({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 21V3h7.4c3.5 0 5.9 2 5.9 5.2 0 2.5-1.5 4.3-3.9 4.9L21 21h-4.3l-4.9-7.3h-3.4V21H4Z" fill={color} />
      <path d="M8.4 6.5v4.1h2.8c1.4 0 2.3-.8 2.3-2.05S12.6 6.5 11.2 6.5H8.4Z" fill="var(--paper, #fff)" />
    </svg>
  );
}

export function Wordmark({ size = 22, muted }: { size?: number; muted?: string }) {
  return (
    <span className="mark">
      <Mark size={size} />
      <span className="mark-name" style={{ fontSize: size * 0.98 }}>Rift</span>
      {muted ? <span className="t-xs c-4" style={{ marginLeft: 2 }}>{muted}</span> : null}
    </span>
  );
}
