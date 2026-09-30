import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

/**
 * The Operations menu's own marks.
 *
 * A collapsed menu used to show each place's first letter, which gave three
 * places the letter C, two O, two R and two S: a menu you had to expand to
 * read. Each place has a drawn mark instead, on a 20 px grid, one weight and
 * one corner radius, with a single filled accent so the set reads as a family
 * rather than a borrowed icon pack. They sit beside the words when the menu is
 * open and stand for them, with a tooltip, when it is closed.
 */
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 20 20", fill: "none",
  stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** The one filled detail each mark carries, at reduced strength. */
const dot = { fill: "currentColor", stroke: "none", opacity: 0.9 } as const;

export const OpsIco = {
  /** Today: the sun over the day's horizon. */
  today: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2.5 14.5h15" /><path d="M5.5 14.5a4.5 4.5 0 0 1 9 0" /><path d="M10 3.2v2M4.6 5.6l1.3 1.3M15.4 5.6l-1.3 1.3M2.8 10.4h1.6M15.6 10.4h1.6" /><path d="M6.5 17.2h7" opacity=".5" /></svg>),
  /** Relationships: two people, the nearer one held. */
  people: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="7.4" cy="6.6" r="2.7" /><path d="M2.6 16.4c.4-3 2.4-4.8 4.8-4.8s4.4 1.8 4.8 4.8" /><path d="M12.6 4.2a2.7 2.7 0 0 1 0 5.1" /><path d="M14.4 11.8c1.7.6 2.7 2.2 3 4.6" /></svg>),
  /** Search: a house under the glass. */
  homeSearch: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2.8 9.2 8.6 4.4l5.8 4.8" /><path d="M4.4 8v7.4h5" /><circle cx="13.6" cy="13.4" r="2.6" /><path d="m15.5 15.3 2 2" /></svg>),
  /** Transactions: the contract, signed. */
  contract: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 2.6H5.4a1.2 1.2 0 0 0-1.2 1.2v12.4a1.2 1.2 0 0 0 1.2 1.2h9.2a1.2 1.2 0 0 0 1.2-1.2V6.4L12 2.6Z" /><path d="M12 2.6v3.8h3.8" /><path d="M7 9.2h6M7 11.8h3.6" /><path d="M7 14.8c.8-.9 1.4-.9 1.8 0s1 .9 1.8 0 1-.9 1.4 0" /></svg>),
  /** Offers: the price tag. */
  tag: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 4.2v5.1c0 .4.2.8.5 1.1l6.3 6.3a1.3 1.3 0 0 0 1.8 0l5.1-5.1a1.3 1.3 0 0 0 0-1.8l-6.3-6.3a1.6 1.6 0 0 0-1.1-.5H4.2A1.2 1.2 0 0 0 3 4.2Z" /><circle cx="6.8" cy="7" r="1.3" {...dot} /></svg>),
  /** Calendar: the month, one day marked. */
  calendar: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2.8" y="4" width="14.4" height="13" rx="1.8" /><path d="M2.8 8h14.4M6.6 2.4v3M13.4 2.4v3" /><rect x="11.4" y="11" width="3" height="3" rx=".6" {...dot} /></svg>),
  /** Outbox: the tray, something leaving it. */
  outbox: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2.8 11.6h3.8l1.2 2h4.4l1.2-2h3.8" /><path d="M2.8 11.6 4.6 5.4a1.2 1.2 0 0 1 1.1-.8h1.1M17.2 11.6l-1.8-6.2a1.2 1.2 0 0 0-1.1-.8h-1.1" /><path d="M2.8 11.6v3.8a1.2 1.2 0 0 0 1.2 1.2h12a1.2 1.2 0 0 0 1.2-1.2v-3.8" /><path d="M10 9.4V2.8M7.6 5 10 2.6 12.4 5" /></svg>),
  /** Advocacy: a heart passed along. */
  advocacy: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M10 16.2S3 12.4 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.8-7 8.6-7 8.6Z" /><path d="M7.4 9.4h5.2M10.8 7.6l1.8 1.8-1.8 1.8" /></svg>),
  /** Reports: bars rising, framed. */
  reports: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2.8" y="2.8" width="14.4" height="14.4" rx="2" /><path d="M6.6 13.6v-3M10 13.6V6.4M13.4 13.6V9" /></svg>),
  /** Campaigns: the megaphone. */
  campaign: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 8.2v3.6a1 1 0 0 0 1 1h2.4L13 16.4V3.6L6.4 7.2H4a1 1 0 0 0-1 1Z" /><path d="m6.6 12.8 1 3.6h2.2l-.8-2.6" /><path d="M15.8 7.8a2.8 2.8 0 0 1 0 4.4" /></svg>),
  /** Programs: the award ribbon, money inside. */
  programs: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="10" cy="7.8" r="5" /><path d="m7 11.8-1.6 5.4 4.6-2 4.6 2-1.6-5.4" /><path d="M11.4 6.2c-.4-.6-1-.8-1.5-.8-.8 0-1.5.5-1.5 1.2 0 1.6 3.1.9 3.1 2.5 0 .7-.7 1.2-1.6 1.2-.6 0-1.2-.3-1.6-.8M10 4.6v.8M10 10.3v.8" /></svg>),
  /** Questions: a speech bubble asking. */
  questions: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4.2 3.4h11.6a1.4 1.4 0 0 1 1.4 1.4v8a1.4 1.4 0 0 1-1.4 1.4H9.4l-3.8 3v-3H4.2a1.4 1.4 0 0 1-1.4-1.4v-8a1.4 1.4 0 0 1 1.4-1.4Z" /><path d="M8.3 7.3a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3" /><circle cx="10" cy="12" r=".8" {...dot} /></svg>),
  /** Settings: three dials. */
  settings: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 5.4h14M3 10h14M3 14.6h14" opacity=".45" /><circle cx="7" cy="5.4" r="1.9" fill="var(--sunk, #f3f2ef)" /><circle cx="13" cy="10" r="1.9" fill="var(--sunk, #f3f2ef)" /><circle cx="8.6" cy="14.6" r="1.9" fill="var(--sunk, #f3f2ef)" /></svg>),
  /** Add someone. */
  addPerson: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8" cy="6.6" r="2.8" /><path d="M2.8 16.4c.4-3 2.5-4.8 5.2-4.8 1.3 0 2.4.4 3.3 1.1" /><path d="M15 11.4v5M12.5 13.9h5" /></svg>),
  /** The menu's own collapse control: a panel with its rail. */
  panel: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2.8" y="3.6" width="14.4" height="12.8" rx="2" /><path d="M7.6 3.6v12.8" /><path d="M4.8 7h.8M4.8 9.6h.8" /></svg>),
  /** Jump anywhere. */
  jump: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="8.8" cy="8.8" r="5.2" /><path d="m12.6 12.6 4.2 4.2" /><path d="M7.2 8.8h3.2M9.4 7.4l1.4 1.4-1.4 1.4" /></svg>),
  /** Sign out: through the door. */
  signOut: ({ size = 18, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8.4 3H5a1.4 1.4 0 0 0-1.4 1.4v11.2A1.4 1.4 0 0 0 5 17h3.4" /><path d="M8.6 10h8.2M13.8 7l3 3-3 3" /></svg>),
};

export type OpsIconName = keyof typeof OpsIco;
