"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/rift/icons";
import { GO_KEYS, SHORTCUT_HELP, isTypingTarget, matchPages } from "@/lib/core/switcher";

type Hit = { key: string; href: string; label: string; detail: string };

/**
 * Cmd+K (Blueprint v5 §8.3): jump to a person or a page, and the "g then a
 * letter" shortcuts. People come from the server as he types; pages are
 * matched here. A failed people search says so rather than looking like
 * nobody matched.
 */
export function Switcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Hit[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const goPending = useRef(0);

  const show = useCallback(() => {
    back.current = document.activeElement as HTMLElement | null;
    setOpen(true); setHelp(false); setQ(""); setPeople([]); setProblem(null); setAt(0);
  }, []);
  const close = useCallback(() => { setOpen(false); setHelp(false); back.current?.focus?.(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (open) close(); else show(); return; }
      if (e.key === "Escape" && (open || help)) { close(); return; }
      if (open || isTypingTarget(e.target as HTMLElement | null) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); show(); return; }
      if (e.key === "?") { setHelp((h) => !h); return; }
      if (e.key === "g") { goPending.current = Date.now(); return; }
      const href = GO_KEYS[e.key];
      if (href && Date.now() - goPending.current < 1200) { goPending.current = 0; router.push(href); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, help, show, close, router]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setPeople([]); setProblem(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/operations/find?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const d = await res.json().catch(() => null) as { ok: boolean; error?: string; people?: { id: string; name: string; detail: string }[] } | null;
        if (!d?.ok) { setPeople([]); setProblem(`People could not be searched${d?.error ? ` (${d.error})` : ""}. Pages still work.`); return; }
        setProblem(null);
        setPeople((d.people ?? []).map((p) => ({ key: `p:${p.id}`, href: `/operations/clients?open=${p.id}`, label: p.name, detail: p.detail })));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setProblem("People could not be searched just now. Pages still work.");
      }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  const pages: Hit[] = matchPages(q).slice(0, q ? 6 : 13).map((p) => ({ key: `g:${p.href}`, href: p.href, label: p.label, detail: "Page" }));
  const hits = [...people, ...pages];
  useEffect(() => { setAt(0); }, [q, people.length]);
  const go = (h: Hit) => { setOpen(false); router.push(h.href); };

  return (
    <>
      <button type="button" className="opsx-find" onClick={show} aria-keyshortcuts="Control+K Meta+K">
        <Ico.search size={13} aria-hidden /><span>Find</span><kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="opsx-dialog-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Find a person or a page" className="opsx-dialog">
            <div className="opsx-find-box">
              <Ico.search size={15} className="c-4" aria-hidden />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="A name, an email, a phone, or a page"
                aria-label="Find" role="combobox" aria-expanded="true" aria-controls="opsx-hits"
                aria-activedescendant={hits[at] ? `hit-${at}` : undefined}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setAt((a) => Math.min(a + 1, hits.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setAt((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && hits[at]) { e.preventDefault(); go(hits[at]); }
                }} />
              <button className="btn btn-g btn-sm" onClick={close}>Esc</button>
            </div>
            {problem ? <p className="t-xs c-warn" style={{ padding: "6px 14px 0" }}>{problem}</p> : null}
            <ul id="opsx-hits" role="listbox" className="opsx-hits">
              {hits.map((h, i) => (
                <li key={h.key} id={`hit-${i}`} role="option" aria-selected={i === at}
                  className="opsx-hit" onMouseEnter={() => setAt(i)} onClick={() => go(h)}>
                  <span className="w6 t-sm">{h.label}</span><span className="t-xs c-4">{h.detail}</span>
                </li>
              ))}
              {!hits.length ? <li className="t-sm c-3" style={{ padding: "10px 14px" }}>Nothing matches. Try part of a name.</li> : null}
            </ul>
            <p className="t-2xs c-4" style={{ padding: "8px 14px", borderTop: "1px solid var(--line-3)", margin: 0 }}>
              ↑ ↓ to move, Enter to open. Press ? anywhere for every shortcut.
            </p>
          </div>
        </div>
      ) : null}
      {help ? (
        <div className="opsx-dialog-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="opsx-dialog" style={{ padding: 16 }}>
            <div className="between"><span className="t-md w6">Keyboard shortcuts</span><button className="btn btn-g btn-sm" onClick={close}>Close</button></div>
            <dl className="ops-dl" style={{ gridTemplateColumns: "minmax(0,190px) minmax(0,1fr)", marginTop: 12 }}>
              {SHORTCUT_HELP.map(([k, v]) => <Fragment key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></Fragment>)}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
