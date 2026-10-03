import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { Notice } from "../../ui";
import type { Attention } from "@/lib/core/journey-focus";
import { TAB_LABEL, type Tab } from "./tabs";
import s from "./journey.module.css";

/** A block of content under a section heading. */
export function Panel({ children, tight, className }: { children: React.ReactNode; tight?: boolean; className?: string }) {
  return <div className={`${s.panel}${tight ? ` ${s.panelTight}` : ""}${className ? ` ${className}` : ""}`}>{children}</div>;
}

/** A read that failed, said as that, and not as "none". */
export function Unread({ what, error }: { what: string; error?: string }) {
  return (
    <Notice tone="neg" title={`The ${what} did not load`}>
      That is not the same as there being none{error ? ` (${error})` : ""}. Reload in a moment; nothing was lost.
    </Notice>
  );
}

/** A table that this deployment has not been migrated for. */
export function NeedsUpdate({ what, migration }: { what: string; migration: string }) {
  return <Notice tone="warn" title={`${what} need a database update`}>Migration {migration} has not been applied here yet.</Notice>;
}

const ICON = { neg: Ico.alert, warn: Ico.alert, info: Ico.clock } as const;

/** Everything that needs the agent on this journey: a word, the line, and where to deal with it. */
export function AttentionList({ items, id, tab }: { items: Attention[]; id: string; tab: Tab }) {
  return (
    <ul className={s.attn}>
      {items.map((a) => {
        const Icon = ICON[a.severity];
        const to = a.tab && a.tab !== tab ? (a.tab === "overview" ? `/operations/journey/${id}` : `/operations/journey/${id}?tab=${a.tab}`) : null;
        return (
          <li key={a.key}>
            <span className={s.tag} data-tone={a.severity}><Icon size={11} /> {a.word}</span>
            <div className={s.attnText}>
              {a.text}
              {a.detail ? <div className={s.attnDetail}>{a.detail}</div> : null}
            </div>
            {to && a.tab ? <Link href={to} className={s.attnGo}>Open {(TAB_LABEL[a.tab as Tab] ?? a.tab).toLowerCase()}</Link> : null}
          </li>
        );
      })}
    </ul>
  );
}
