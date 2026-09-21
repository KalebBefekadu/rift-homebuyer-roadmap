"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";

const FILTERS = [
  { id: "all", label: "Everyone" },
  { id: "working", label: "Being worked" },
  { id: "new", label: "Not picked up" },
  { id: "archived", label: "Archived" },
] as const;

const SIDES = [
  { id: "all", label: "Both" },
  { id: "buy", label: "Buying" },
  { id: "sell", label: "Selling" },
] as const;

/**
 * Finding one person.
 *
 * The state lives in the URL rather than in the component, for one reason that
 * matters: the agent is on the phone. He types a name, opens the record, and
 * presses back — and if the search were component state, back would return him
 * to an empty box and he would type it again while somebody waits.
 *
 * Typing is debounced and the navigation replaces rather than pushes, so the
 * history holds "the search he ran", not one entry per keystroke.
 */
export function Search({ total, more }: { total: number; more: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const filter = params.get("filter") ?? "all";
  const side = params.get("side") ?? "all";

  /* The first render must not navigate. Without this the page replaces its own
     URL on load, which resets the scroll position every time he comes back. */
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim()); else next.delete("q");
      start(() => router.replace(`/studio/clients?${next}`, { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key); else next.set(key, value);
    start(() => router.replace(`/studio/clients?${next}`, { scroll: false }));
  };

  return (
    <div className="col gap-3">
      <div className="row gap-2" style={{
        height: 40, padding: "0 12px", borderRadius: 9,
        border: "1px solid var(--line)", background: "var(--paper)",
      }}>
        <Ico.search size={15} className="c-4" />
        <input
          className="grow"
          value={q}
          onChange={(e) => { typed.current = true; setQ(e.target.value); }}
          placeholder="Name, email or phone"
          aria-label="Find someone"
          style={{ border: 0, background: "transparent", fontSize: 14, outline: "none", minWidth: 0 }}
        />
        {q ? (
          <button className="btn btn-g btn-ico" aria-label="Clear"
            onClick={() => { typed.current = true; setQ(""); }}>
            <Ico.x size={13} />
          </button>
        ) : null}
      </div>

      <div className="row gap-2 wrap">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => go("filter", f.id)}
            aria-pressed={filter === f.id}
            className={`chip ${filter === f.id ? "chip-ink" : ""}`}
            style={{ cursor: "pointer", height: 26, padding: "0 10px" }}>
            {f.label}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {SIDES.map((s) => (
          <button key={s.id} onClick={() => go("side", s.id)}
            aria-pressed={side === s.id}
            className={`chip ${side === s.id ? "chip-ink" : ""}`}
            style={{ cursor: "pointer", height: 26, padding: "0 10px" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Said plainly, including when it is nothing. A list that silently shows
          the first hundred of four hundred is the same lie as one that shows
          none of them. */}
      <div className="t-xs c-4" aria-live="polite">
        {pending ? "Looking…" : more
          ? `Showing the first ${total}. Narrow it to see the rest.`
          : `${total} ${total === 1 ? "person" : "people"}`}
      </div>
    </div>
  );
}
