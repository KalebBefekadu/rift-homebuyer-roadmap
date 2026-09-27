"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SWITCH } from "@/lib/prototype/operations";

/**
 * The Operations mock-up's frame (Blueprint v5 §8.3, D15): a stable left
 * sidebar instead of the top bar, "Add someone" as its one primary button,
 * a quick switcher on Cmd+K (Ctrl+K), and shortcuts for moving around
 * (g then t, r, x). Utilitarian on purpose (§8.9): system sans, small
 * type, dense rows, words and icons on every state.
 */

const MAIN = [
  { href: "/prototype/operations", label: "Today", key: "t" },
  { href: "/prototype/operations/relationships", label: "Relationships", key: "r" },
  { href: "/prototype/operations/other?page=search", label: "Search", key: null },
  { href: "/prototype/operations/transactions", label: "Transactions", key: "x" },
  { href: "/prototype/operations/other?page=offers", label: "Offers", key: null },
  { href: "/prototype/operations/other?page=calendar", label: "Calendar", key: null },
];
const MORE = [
  { href: "/prototype/operations/other?page=advocacy", label: "Advocacy" },
  { href: "/prototype/operations/other?page=reports", label: "Reports" },
  { href: "/prototype/operations/other?page=programs", label: "Programs" },
  { href: "/prototype/operations/other?page=campaigns", label: "Campaigns (later)" },
  { href: "/prototype/operations/other?page=questions", label: "Questions" },
  { href: "/prototype/operations/other?page=settings", label: "Settings" },
];

export function OpsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<string | null>(null);

  const hits = useMemo(() => SWITCH.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); setQ(""); setSel(0); return; }
      if (e.key === "Escape") { setOpen(false); return; }
      if (typing || open) return;
      if (pending.current === "g") {
        const to = MAIN.find((m) => m.key === e.key);
        pending.current = null;
        if (to) { e.preventDefault(); router.push(to.href); }
        return;
      }
      if (e.key === "g") { pending.current = "g"; setTimeout(() => { pending.current = null; }, 900); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const active = (href: string) => (href === "/prototype/operations" ? path === href : path.startsWith(href.split("?")[0]) && href.split("?")[0] !== "/prototype/operations/other") || false;

  return (
    <div className="ops">
      <style>{`
        .ops { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 13.5px; color: var(--ink); display: grid; grid-template-columns: ${collapsed ? "56px" : "220px"} 1fr; min-height: 100vh; }
        .ops-side { border-right: 1px solid var(--line-2); background: var(--sunk); padding: 14px 10px; position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .ops-link { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border-radius: 6px; color: var(--ink-2); white-space: nowrap; overflow: hidden; }
        .ops-link[aria-current="page"] { background: var(--paper); color: var(--ink); font-weight: 600; box-shadow: 0 0 0 1px var(--line-2); }
        .ops-link:hover { background: var(--paper); }
        .ops-main { padding: 12px 20px 60px; min-width: 0; }
        .ops-h1 { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
        .ops-table { width: 100%; border-collapse: collapse; }
        .ops-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: var(--ink-3); padding: 6px 8px; border-bottom: 1px solid var(--line-2); white-space: nowrap; }
        .ops-table td { padding: 7px 8px; border-bottom: 1px solid var(--line-3); vertical-align: top; }
        .ops-row:hover { background: var(--sunk); cursor: pointer; }
        .ops-kbd { font-size: 11px; border: 1px solid var(--line-2); border-radius: 4px; padding: 0 5px; color: var(--ink-3); background: var(--paper); }
        @media (max-width: 760px) { .ops { grid-template-columns: 1fr; } .ops-side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; } .ops-main { padding: 14px; } }
      `}</style>

      <aside className="ops-side" aria-label="Operations">
        <div className="between" style={{ padding: "0 4px 10px" }}>
          {!collapsed ? <span style={{ fontWeight: 650 }}>Rift Operations</span> : null}
          <button className="btn btn-g btn-sm" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}>{collapsed ? "›" : "‹"}</button>
        </div>
        <Link href="/prototype/operations/other?page=add" className="btn btn-p btn-sm" style={{ margin: "0 4px 10px" }}>{collapsed ? "+" : "Add someone"}</Link>
        {MAIN.map((m) => (
          <Link key={m.href} href={m.href} className="ops-link" aria-current={active(m.href) ? "page" : undefined} title={m.label}>
            {collapsed ? m.label[0] : m.label}
          </Link>
        ))}
        <div style={{ height: 1, background: "var(--line-2)", margin: "10px 4px" }} />
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} className="ops-link" style={{ fontSize: 12.5 }} title={m.label}>{collapsed ? m.label[0] : m.label}</Link>
        ))}
        <div style={{ marginTop: "auto", padding: "10px 6px", fontSize: 11.5, color: "var(--ink-4)" }}>
          {!collapsed ? <>Jump anywhere <span className="ops-kbd">⌘K</span></> : null}
        </div>
      </aside>

      <div className="ops-main">
        <div className="card" style={{ padding: "6px 12px", marginBottom: 10, background: "var(--warn-wash, #fdf6e3)", fontSize: 12 }}>
          <strong>Mock-up with made-up people (D15).</strong> Click through and say what to keep or change; nothing here reads or writes real data.
        </div>
        {children}
      </div>

      {open ? (
        <div className="cmdk-veil" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Jump to" className="card" style={{ width: 460, maxWidth: "calc(100vw - 32px)", padding: 10 }} onMouseDown={(e) => e.stopPropagation()}>
            <input ref={input} className="input" placeholder="A person, a journey or a page" value={q}
              onChange={(e) => { setQ(e.target.value); setSel(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                if (e.key === "Enter" && hits[sel]) go(hits[sel].href);
              }} />
            <ul role="listbox" style={{ marginTop: 8 }}>
              {hits.map((h, i) => (
                <li key={h.href + h.label} role="option" aria-selected={i === sel}>
                  <button className="between" style={{ width: "100%", padding: "7px 8px", borderRadius: 6, background: i === sel ? "var(--sunk)" : "transparent", textAlign: "left" }} onClick={() => go(h.href)}>
                    <span>{h.label}</span><span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{h.hint}</span>
                  </button>
                </li>
              ))}
              {!hits.length ? <li style={{ padding: 8, color: "var(--ink-4)" }}>Nothing matches.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
