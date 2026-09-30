import Link from "next/link";
import { Ico } from "@/components/rift/icons";

/**
 * The pieces every Operations page is built from.
 *
 * Each page used to draw its own header, its own notices and its own empty
 * state, with inline sizes, so no two pages agreed on where the title sat, how
 * far below it the content began, or what "this did not load" looked like.
 * These are the only way a page says those things now. They carry no data and
 * make no reads: a page decides what to say, these decide how it looks.
 */

/** The top of a page: its name, one line on what it is for, and its actions. */
export function PageHead({ title, lede, actions, meta, back }: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small facts under the title: counts, a status chip. */
  meta?: React.ReactNode;
  /** Where "back" goes, for a page that lives under another. */
  back?: { href: string; label: string };
}) {
  return (
    <header className="ops-head">
      {back ? <Link href={back.href} className="ops-back"><Ico.chevL size={13} />{back.label}</Link> : null}
      <div className="ops-head-row">
        <div className="ops-head-text">
          <h1 className="ops-title">{title}</h1>
          {lede ? <p className="ops-lede">{lede}</p> : null}
          {meta ? <div className="ops-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="ops-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

/** A titled part of a page. */
export function Section({ title, hint, actions, children, id }: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="ops-sec" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="ops-sec-head">
        <div>
          <h2 className="ops-sec-title" id={id ? `${id}-h` : undefined}>{title}</h2>
          {hint ? <p className="ops-sec-hint">{hint}</p> : null}
        </div>
        {actions ? <div className="ops-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

const TONE = {
  neg: { Icon: Ico.alert, cls: "ops-notice-neg" },
  warn: { Icon: Ico.alert, cls: "ops-notice-warn" },
  info: { Icon: Ico.info, cls: "ops-notice-info" },
  pos: { Icon: Ico.checkCircle, cls: "ops-notice-pos" },
} as const;

/**
 * Something the agent should know about the page itself: a read that failed,
 * a table not yet migrated, an integration missing. Always an icon and a word
 * as well as a colour (rule 10), and always a named state, never a blank.
 */
export function Notice({ tone, title, children, action }: {
  tone: keyof typeof TONE;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { Icon, cls } = TONE[tone];
  return (
    <div className={`ops-notice ${cls}`} role={tone === "neg" ? "alert" : undefined}>
      <Icon size={15} className="ops-notice-ico" />
      <div className="ops-notice-body">
        <div className="ops-notice-title">{title}</div>
        {children ? <div className="ops-notice-text">{children}</div> : null}
      </div>
      {action ? <div className="ops-notice-action">{action}</div> : null}
    </div>
  );
}

/** Nothing here, said as what that means and what makes something appear. */
export function Empty({ title, children, action }: { title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ops-empty">
      <div className="ops-empty-title">{title}</div>
      {children ? <p className="ops-empty-text">{children}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

/** One number with its label, for a row of them at the top of a page. */
export function Stat({ label, value, hint, tone, href }: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "pos" | "warn" | "neg";
  href?: string;
}) {
  const body = (
    <>
      <div className="ops-stat-label">{label}</div>
      <div className={`ops-stat-value${tone ? ` c-${tone}` : ""}`}>{value}</div>
      {hint ? <div className="ops-stat-hint">{hint}</div> : null}
    </>
  );
  return href ? <Link href={href} className="ops-stat ops-stat-link">{body}</Link> : <div className="ops-stat">{body}</div>;
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="ops-stats">{children}</div>;
}

/** Views of one list, kept in the address so back returns to the same view. */
export function Tabs({ items, current, label }: {
  items: { id: string; href: string; label: React.ReactNode; count?: number }[];
  current: string;
  label: string;
}) {
  return (
    <nav className="ops-tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.id} href={t.href} className="ops-tab" aria-current={t.id === current ? "page" : undefined}>
          {t.label}{typeof t.count === "number" ? <span className="ops-tab-count">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Label and value pairs: the facts of one record. */
export function Facts({ items, cols = 2 }: { items: [React.ReactNode, React.ReactNode][]; cols?: 1 | 2 | 3 | 4 }) {
  return (
    <dl className="ops-facts" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map(([k, v], i) => (
        <div key={i} className="ops-fact"><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
