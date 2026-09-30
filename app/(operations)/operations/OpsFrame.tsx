"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/rift/icons";
import { OpsIco } from "@/components/rift/ops-icons";
import { MAIN, MORE, isCurrent, placesMatching, type Place } from "./nav";
import { jumpTo, signOut, type Jump } from "./actions";

/**
 * The frame around every Operations page once the agent is signed in
 * (Blueprint v5 §8.3, from the mock-up Kaleb was shown under D15): a stable
 * left sidebar with "Add someone" as its one primary button, a quick switcher
 * on Cmd+K (Ctrl+K), and "g" then a letter to move between the main places.
 *
 * It replaced a top bar that each page rendered for itself, which is how
 * three pages ended up with three different headers and two with none.
 *
 * On a phone the sidebar becomes a row across the top that scrolls sideways
 * inside itself, never the page.
 */
export function OpsFrame({ agentName, undecided, children }: { agentName: string; undecided: number; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const pending = useRef<string | null>(null);

  /* Remembered on this device only: a convenience, never state that matters. */
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ops-collapsed") === "1"); } catch { /* private window */ }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("ops-collapsed", c ? "0" : "1"); } catch { /* private window */ }
      return !c;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); return; }
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if (typing || open || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pending.current === "g") {
        pending.current = null;
        const to = MAIN.find((m) => m.key === e.key);
        if (to) { e.preventDefault(); router.push(to.href); }
        return;
      }
      if (e.key === "g") { pending.current = "g"; window.setTimeout(() => { pending.current = null; }, 900); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router]);

  const link = (place: Place, extra?: React.ReactNode) => {
    const here = isCurrent(place.href, path);
    const Icon = OpsIco[place.icon];
    return (
      <Link key={place.href} href={place.href} className="ops-link" aria-current={here ? "page" : undefined}
        aria-label={collapsed ? place.label : undefined} data-tip={collapsed ? place.label : undefined}>
        <Icon size={18} className="ops-ico" />
        {collapsed ? null : <span className="ops-link-label">{place.label}</span>}
        {extra}
      </Link>
    );
  };

  return (
    <div className={`ops-frame${collapsed ? " ops-collapsed" : ""}`}>
      <aside className="ops-side no-print" aria-label="Operations">
        <div className="ops-brand">
          <Link href="/operations" className="ops-brand-link" aria-label="Rift Operations, Today">
            <Mark size={17} />
            {!collapsed ? <span>Operations</span> : null}
          </Link>
          <button type="button" className="ops-collapse" onClick={toggle} aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
            aria-expanded={!collapsed} data-tip={collapsed ? "Expand the menu" : undefined}>
            <OpsIco.panel size={17} />
          </button>
        </div>
        <Link href="/operations/add" className="btn btn-p btn-sm ops-add" aria-label={collapsed ? "Add someone" : undefined} data-tip={collapsed ? "Add someone" : undefined}>
          <OpsIco.addPerson size={16} />{collapsed ? null : <span>Add someone</span>}
        </Link>
        <nav className="ops-nav" aria-label="Main">
          {MAIN.map((m) => link(m))}
          <div className="ops-rule" role="separator" />
          {MORE.map((m) => link(m, m.href === "/operations/settings" && undecided
            ? collapsed
              ? <span className="ops-dot" aria-label={`${undecided} decision${undecided === 1 ? "" : "s"} still yours to make`} />
              : <span className="chip chip-warn t-2xs" title={`${undecided} decision${undecided === 1 ? "" : "s"} still yours to make`}>{undecided}</span>
            : null))}
        </nav>
        <div className="ops-foot">
          <button type="button" className="ops-link ops-jump" onClick={() => setOpen(true)} aria-label={collapsed ? "Jump anywhere" : undefined} data-tip={collapsed ? "Jump anywhere  ⌘K" : undefined}>
            <OpsIco.jump size={18} className="ops-ico" />
            {collapsed ? null : <><span className="ops-link-label">Jump anywhere</span><span className="ops-kbd">⌘K</span></>}
          </button>
          {!collapsed ? <span className="ops-who">{agentName}</span> : null}
          <form action={signOut}>
            <button className="ops-link ops-out" type="submit" aria-label={collapsed ? "Sign out" : undefined} data-tip={collapsed ? "Sign out" : undefined}>
              <OpsIco.signOut size={18} className="ops-ico" />{collapsed ? null : <span className="ops-link-label">Sign out</span>}
            </button>
          </form>
        </div>
      </aside>

      <div className="ops-main">{children}</div>

      {open ? <Switcher onClose={() => setOpen(false)} onGo={(href) => { setOpen(false); router.push(href); }} /> : null}
    </div>
  );
}

function Switcher({ onClose, onGo }: { onClose: () => void; onGo: (href: string) => void }) {
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Jump[]>([]);
  const [sel, setSel] = useState(0);
  const [loading, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  /* Records are asked for after a pause in typing, and an answer that
     arrives after a newer question is dropped rather than shown. */
  useEffect(() => {
    if (q.trim().length < 2) { setRecords([]); return; }
    let live = true;
    const t = window.setTimeout(() => start(async () => {
      const r = await jumpTo(q);
      if (live) setRecords(r);
    }), 180);
    return () => { live = false; window.clearTimeout(t); };
  }, [q]);

  const hits: Jump[] = [...records, ...placesMatching(q).map((p) => ({ label: p.label, hint: "Page", href: p.href }))].slice(0, 10);

  return (
    <div className="cmdk-veil" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Jump to" className="card ops-switch" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={input} className="input" placeholder="A person, a journey or a page" value={q}
          aria-controls="ops-switch-list" aria-activedescendant={hits[sel] ? `ops-hit-${sel}` : undefined}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && hits[sel]) { e.preventDefault(); onGo(hits[sel].href); }
          }} />
        <ul id="ops-switch-list" role="listbox" aria-label="Matches" style={{ marginTop: 8 }}>
          {hits.map((h, i) => (
            <li key={h.href + h.label} id={`ops-hit-${i}`} role="option" aria-selected={i === sel}>
              <button type="button" className="ops-hit" data-on={i === sel ? "1" : undefined} onClick={() => onGo(h.href)}>
                <span className="trunc">{h.label}</span><span className="ops-hint">{h.hint}</span>
              </button>
            </li>
          ))}
          {!hits.length ? <li className="ops-hint" style={{ padding: 8 }}>{loading ? "Looking…" : "Nothing matches."}</li> : null}
        </ul>
        <p className="ops-hint" style={{ padding: "8px 8px 2px" }}>
          <span className="ops-kbd">g</span> then <span className="ops-kbd">t</span> Today, <span className="ops-kbd">r</span> Relationships, <span className="ops-kbd">s</span> Search, <span className="ops-kbd">x</span> Transactions, <span className="ops-kbd">o</span> Offers, <span className="ops-kbd">c</span> Calendar
        </p>
      </div>
    </div>
  );
}
