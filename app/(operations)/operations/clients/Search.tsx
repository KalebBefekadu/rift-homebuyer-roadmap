"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import {
  STAGE_FILTERS, STAGE_FILTER_LABEL, NEXT_FILTERS, NEXT_FILTER_LABEL,
  CONTACT_FILTERS, CONTACT_FILTER_LABEL, SORTS, SORT_LABEL,
} from "@/lib/core/people";
import css from "./clients.module.css";

const STATUS = [
  { id: "all", label: "Everyone" },
  { id: "working", label: "Being worked" },
  { id: "new", label: "Not picked up" },
  { id: "archived", label: "Archived" },
] as const;

const SIDES = [
  { id: "all", label: "Buying and selling" },
  { id: "buy", label: "Buying" },
  { id: "sell", label: "Selling" },
] as const;

/* Every control that narrows or orders the list, and its default. A key at its
   default is left out of the address, so the plain list has a plain address. */
const FILTER_KEYS = { filter: "all", side: "all", stage: "any", next: "any", contact: "any", sort: "arrived" } as const;
type Key = keyof typeof FILTER_KEYS;
const SAVED = "ops-people-filters";

/**
 * Finding one person, and narrowing the book.
 *
 * The state lives in the URL rather than in the component, for one reason that
 * matters: the agent is on the phone. He types a name, opens the record, and
 * presses back, and if the search were component state, back would return him
 * to an empty box and he would type it again while somebody waits.
 *
 * Typing is debounced and the navigation replaces rather than pushes, so the
 * history holds "the search he ran", not one entry per keystroke.
 */
export function Search({ shown, total, more, overdue, quiet, quietKnown }: {
  /** After every filter. */
  shown: number;
  /** Before the stage, next-step and contact filters: what a filter is narrowing. */
  total: number;
  more: boolean;
  /** How many of `total` have a next step that is overdue / have gone quiet. */
  overdue: number;
  quiet: number;
  /** False when last contact could not be read, so "quiet" is not offered as if it were known. */
  quietKnown: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const get = (k: Key) => params.get(k) ?? FILTER_KEYS[k];

  /* The first render must not navigate. Without this the page replaces its own
     URL on load, which resets the scroll position every time he comes back. */
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim()); else next.delete("q");
      next.delete("open");
      start(() => router.replace(`/operations/clients?${next}`, { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Filters persist (§8.5): coming back from the sidebar, which carries no
     address, restores the last filters used on this device. Only the
     filters, never the search text, and only where the browser allows it. */
  useEffect(() => {
    if ([...params.keys()].length) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? "null") as Partial<Record<Key, string>> | null;
      const next = new URLSearchParams();
      for (const k of Object.keys(FILTER_KEYS) as Key[]) {
        const v = saved?.[k];
        if (v && v !== FILTER_KEYS[k] && /^[a-z]{2,10}$/.test(v)) next.set(k, v);
      }
      if (next.size) router.replace(`/operations/clients?${next}`, { scroll: false });
    } catch { /* private window: start from everyone */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = Object.fromEntries((Object.keys(FILTER_KEYS) as Key[]).map((k) => [k, get(k)]));
  useEffect(() => {
    try { localStorage.setItem(SAVED, JSON.stringify(current)); } catch { /* private window */ }
  }, [JSON.stringify(current)]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (key: Key, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === FILTER_KEYS[key]) next.delete(key); else next.set(key, value);
    next.delete("open");
    start(() => router.replace(`/operations/clients?${next}`, { scroll: false }));
  };

  const narrowed = (Object.keys(FILTER_KEYS) as Key[]).some((k) => k !== "sort" && get(k) !== FILTER_KEYS[k]) || Boolean(params.get("q"));

  const select = (key: Key, label: string, options: readonly { id: string; label: string }[]) => (
    <label>
      {label}
      <select className="input select" value={get(key)} onChange={(e) => go(key, e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
  const opts = <T extends string>(ids: readonly T[], labels: Record<T, string>) => ids.map((id) => ({ id, label: labels[id] }));

  return (
    <div className={css.bar}>
      <div className={css.find}>
        <Ico.search size={15} className="c-4" />
        <input
          value={q}
          onChange={(e) => { typed.current = true; setQ(e.target.value); }}
          placeholder="Name, email or phone"
          aria-label="Find someone"
        />
        {q ? (
          <button className="btn btn-g btn-ico" aria-label="Clear the search"
            onClick={() => { typed.current = true; setQ(""); }}>
            <Ico.x size={13} />
          </button>
        ) : null}
      </div>

      <div className={css.filters}>
        {select("filter", "Show", STATUS)}
        {select("side", "Side", SIDES)}
        {select("stage", "Stage", opts(STAGE_FILTERS, STAGE_FILTER_LABEL))}
        {select("next", "Next step", opts(NEXT_FILTERS, NEXT_FILTER_LABEL))}
        {select("contact", "Last contact", opts(CONTACT_FILTERS, CONTACT_FILTER_LABEL))}
        {select("sort", "Order", opts(SORTS, SORT_LABEL))}
      </div>

      {/* Said plainly, including when it is nothing. A list that silently shows
          the first five hundred of six hundred is the same lie as one that
          shows none of them. */}
      <div className={css.state} aria-live="polite">
        <span>
          {pending ? "Looking…" : `${shown} ${shown === 1 ? "person" : "people"}${shown !== total ? ` of ${total}` : ""}`}
        </span>
        {more ? <span><Ico.info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Only the newest 500 are loaded. Search by name to find the rest.</span> : null}
        {overdue > 0 && get("next") !== "overdue" ? (
          <button type="button" className="chip chip-neg" style={{ cursor: "pointer" }} onClick={() => go("next", "overdue")}>
            <Ico.alert size={11} />{overdue} overdue next {overdue === 1 ? "step" : "steps"}
          </button>
        ) : null}
        {quietKnown && quiet > 0 && get("contact") !== "quiet" ? (
          <button type="button" className="chip" style={{ cursor: "pointer" }} onClick={() => go("contact", "quiet")}>
            <Ico.clock size={11} />{quiet} with no contact in 14 days
          </button>
        ) : null}
        {narrowed ? <Link className="u" href="/operations/clients" onClick={() => { try { localStorage.removeItem(SAVED); } catch { /* private window */ } setQ(""); }}>Clear filters</Link> : null}
      </div>
    </div>
  );
}
