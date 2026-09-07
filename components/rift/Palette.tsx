"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "./icons";

type Cmd = { id: string; label: string; hint?: string; group: string; href: string; icon: React.ComponentType<{ size?: number }> };

const CMDS: Cmd[] = [
  { id: "today", label: "Today", group: "Studio", href: "/prototype/studio", icon: Ico.bolt },
  { id: "offers", label: "Offers", hint: "2 awaiting decision", group: "Studio", href: "/prototype/studio/offers", icon: Ico.scale },
  { id: "leads", label: "Leads, ranked", hint: "6 waiting · 2 to call today", group: "Studio", href: "/prototype/studio/clients", icon: Ico.spark },
  { id: "clients", label: "Clients", group: "Studio", href: "/prototype/studio/clients", icon: Ico.users },
  { id: "funnels", label: "Edit the funnel questions", group: "Studio", href: "/prototype/studio/settings", icon: Ico.filter },
  { id: "pipeline", label: "Pipeline & sources", group: "Studio", href: "/prototype/studio/clients?view=sources", icon: Ico.chart },
  { id: "cal", label: "Calendar", group: "Studio", href: "/prototype/studio/calendar", icon: Ico.cal },
  { id: "set", label: "Settings", group: "Studio", href: "/prototype/studio/settings", icon: Ico.set },

  { id: "maya", label: "Maya Ellison", hint: "Building readiness · DeKalb", group: "Clients", href: "/prototype/studio/clients/maya", icon: Ico.users },
  { id: "vance", label: "Harold & Ruth Vance", hint: "Preparing the property · Cobb", group: "Clients", href: "/prototype/studio/clients/vance", icon: Ico.users },
  { id: "okafor", label: "Nadia & Chris Okafor", hint: "Reviewing offers · Fulton", group: "Clients", href: "/prototype/studio/clients/okafor", icon: Ico.users },
  { id: "pike", label: "Jordan Pike", hint: "New referral", group: "Clients", href: "/prototype/studio/clients/pike", icon: Ico.users },

  { id: "kaleb", label: "Kaleb's site", group: "Surfaces", href: "/prototype/kaleb", icon: Ico.home },
  { id: "buy", label: "Rift for buyers", group: "Surfaces", href: "/prototype/buy", icon: Ico.spark },
  { id: "sell", label: "Rift for sellers", group: "Surfaces", href: "/prototype/sell", icon: Ico.wallet },
  { id: "start", label: "Buyer assessment", group: "Surfaces", href: "/prototype/buy/start", icon: Ico.arrowR },
  { id: "bres", label: "Buyer readout", hint: "What they get at the end", group: "Surfaces", href: "/prototype/buy/results", icon: Ico.doc },
  { id: "sres", label: "Seller readout", group: "Surfaces", href: "/prototype/sell/results", icon: Ico.doc },
  { id: "client", label: "Client view", hint: "As Maya sees it", group: "Surfaces", href: "/prototype/app", icon: Ico.layers },
  { id: "offer", label: "Submit an offer", group: "Surfaces", href: "/prototype/offer", icon: Ico.doc },
  { id: "book", label: "Booking", hint: "Fifteen minutes", group: "Surfaces", href: "/prototype/book", icon: Ico.cal },
];

export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CMDS;
    return CMDS.filter((c) => (c.label + " " + (c.hint ?? "") + " " + c.group).toLowerCase().includes(s));
  }, [q]);

  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const c = results[i];
        if (c) { onClose(); router.push(c.href); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, results, i, onClose, router]);

  if (!open) return null;

  let last = "";
  return (
    <div className="cmdk-veil fade-in" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command menu">
        <input ref={inputRef} className="cmdk-in" placeholder="Search clients, screens, actions…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cmdk-list">
          {results.length === 0 ? (
            <div className="t-sm c-4" style={{ padding: "20px 10px", textAlign: "center" }}>No results</div>
          ) : results.map((c, n) => {
            const head = c.group !== last; last = c.group;
            return (
              <div key={c.id}>
                {head ? <div className="cmdk-sec">{c.group}</div> : null}
                <button className="cmdk-row" data-on={n === i} onMouseEnter={() => setI(n)}
                  onClick={() => { onClose(); router.push(c.href); }}>
                  <c.icon size={15} />
                  <span className="grow w5">{c.label}</span>
                  {c.hint ? <span className="t-xs c-4 trunc" style={{ maxWidth: 190 }}>{c.hint}</span> : null}
                  {n === i ? <Ico.arrowR size={13} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function usePalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return { open, setOpen };
}
