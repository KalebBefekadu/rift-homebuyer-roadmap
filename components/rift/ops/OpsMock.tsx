"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ico, Mark } from "@/components/rift/icons";
import { STAGE_LABEL, WORKSTREAMS, WORKSTREAM_LABEL, type WorkState } from "@/lib/core/progress";
import {
  ACTIVITY, GROUP_LABEL, JOURNEYS, MOCK_TODAY, PEOPLE, STATE_WORD, TODAY,
  type MockJourney, type MockPerson, type TodayGroup, type TodayItem,
} from "@/lib/prototype/ops-mock";

/**
 * The Operations mock-up (Blueprint v5 §8, decision D15).
 *
 * Kaleb clicks through this before any real Operations screen is rebuilt, and
 * says what to keep or change. It is the proposal in §8.3 to §8.9 with
 * made-up data: a left sidebar, Today in five groups, Relationships as a
 * table with a side panel that keeps your place, the journey as a workspace
 * with tabs, and the new Transactions view. Nothing is saved; snoozing and
 * approving change this page only.
 *
 * Where you are lives in the address (?v=, ?p=, ?j=, ?tab=, ?f=), so the back
 * button and a returned-to list keep their place and filters: one of §8's
 * acceptance checks, and the thing the live pages do not do.
 */

type View = "today" | "people" | "journey" | "transactions" | "search" | "offers" | "calendar"
  | "advocacy" | "reports" | "questions" | "settings";
type Tab = "overview" | "search" | "homes" | "offers" | "contract" | "history";

const NAV: { v: View; label: string; icon: keyof typeof Ico }[] = [
  { v: "today", label: "Today", icon: "home" },
  { v: "people", label: "Relationships", icon: "users" },
  { v: "search", label: "Search", icon: "search" },
  { v: "transactions", label: "Transactions", icon: "doc" },
  { v: "offers", label: "Offers", icon: "scale" },
  { v: "calendar", label: "Calendar", icon: "cal" },
];
const NAV_SMALL: { v: View; label: string }[] = [
  { v: "advocacy", label: "Advocacy" },
  { v: "reports", label: "Reports" },
  { v: "questions", label: "Questions" },
  { v: "settings", label: "Settings" },
];
const TABS: { t: Tab; label: string }[] = [
  { t: "overview", label: "Overview" },
  { t: "search", label: "Search" },
  { t: "homes", label: "Homes and showings" },
  { t: "offers", label: "Offers and documents" },
  { t: "contract", label: "Contract" },
  { t: "history", label: "History" },
];

/* Never colour alone (rule 10): every state has an icon and a word. */
const STATE_ICON: Record<WorkState, keyof typeof Ico> = {
  "not-started": "minus", "in-progress": "clock", waiting: "pause", blocked: "alert",
  reported: "info", confirmed: "checkCircle", "not-applicable": "x",
};
const STATE_TONE: Record<WorkState, string> = {
  "not-started": "c-4", "in-progress": "c-2", waiting: "c-warn", blocked: "c-neg",
  reported: "c-warn", confirmed: "c-pos", "not-applicable": "c-4",
};

const without = (o: Record<string, string>, key: string) => {
  const next = { ...o };
  delete next[key];
  return next;
};

const person = (id?: string) => PEOPLE.find((p) => p.id === id);
const journey = (id?: string) => JOURNEYS.find((j) => j.id === id);

export function OpsMock() {
  const router = useRouter();
  const q = useSearchParams();
  const view = (q.get("v") as View) || "today";
  const panel = q.get("p") ?? undefined;
  const jid = q.get("j") ?? undefined;
  const tab = (q.get("tab") as Tab) || "overview";
  const filter = q.get("f") ?? "all";

  const go = (next: Record<string, string | undefined>, replace = false) => {
    const p = new URLSearchParams(q.toString());
    for (const [k, v] of Object.entries(next)) { if (v === undefined) p.delete(k); else p.set(k, v); }
    const url = `?${p.toString()}`;
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  };
  const open = (v: View, extra: Record<string, string | undefined> = {}) =>
    go({ v, p: undefined, j: undefined, tab: undefined, ...extra });

  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  /* What Kaleb did to items in this session: snoozed, delegated, pinned,
     approved. The mock-up shows the consequence; nothing is stored. */
  const [marks, setMarks] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSwitcher((s) => !s); }
      if (e.key === "Escape") { setSwitcher(false); setMenu(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`ops ${collapsed ? "ops-collapsed" : ""}`}>
      <div className="ops-mockbar" role="note">
        <Ico.info size={13} /> Mock-up with made-up data, for Kaleb to click through before Operations is rebuilt (D15). Nothing here is saved.
      </div>

      <div className="ops-frame">
        <aside className={`ops-side ${menu ? "ops-side-open" : ""}`} aria-label="Operations">
          <div className="ops-brand">
            <Mark size={18} /><span className="ops-brand-name">Operations</span>
            <button className="ops-icon-btn ops-collapse" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
              onClick={() => setCollapsed((c) => !c)}><Ico.chevL size={14} style={{ transform: collapsed ? "rotate(180deg)" : undefined }} /></button>
          </div>
          <button className="ops-add" onClick={() => setMarks((m) => ({ ...m, add: "open" }))}>
            <Ico.plus size={14} /><span className="ops-hide-collapsed">Add someone</span>
          </button>
          <button className="ops-find" onClick={() => setSwitcher(true)}>
            <Ico.search size={13} /><span className="ops-hide-collapsed">Jump to…</span><kbd className="ops-hide-collapsed">⌘K</kbd>
          </button>
          <nav>
            {NAV.map((n) => {
              const Icon = Ico[n.icon];
              const on = view === n.v || (n.v === "people" && view === "journey");
              return (
                <button key={n.v} className="ops-nav" aria-current={on ? "page" : undefined}
                  onClick={() => { open(n.v); setMenu(false); }} title={n.label}>
                  <Icon size={15} /><span className="ops-hide-collapsed">{n.label}</span>
                  {n.v === "today" ? <span className="ops-count ops-hide-collapsed">{TODAY.filter((t) => t.group === "attention" && !marks[t.id]).length}</span> : null}
                </button>
              );
            })}
          </nav>
          <nav className="ops-nav-small ops-hide-collapsed">
            {NAV_SMALL.map((n) => (
              <button key={n.v} className="ops-nav" aria-current={view === n.v ? "page" : undefined} onClick={() => { open(n.v); setMenu(false); }}>{n.label}</button>
            ))}
            <span className="ops-nav ops-nav-later">Campaigns <em>later</em></span>
          </nav>
        </aside>

        <main className="ops-main">
          <div className="ops-top">
            <button className="ops-icon-btn ops-menu" aria-label="Menu" onClick={() => setMenu((m) => !m)}><Ico.more size={16} /></button>
            <span className="ops-crumb">{MOCK_TODAY}</span>
          </div>

          {view === "today" ? <TodayView marks={marks} setMarks={setMarks} openPerson={(id) => open("people", { p: id })} openJourney={(id, t) => open("journey", { j: id, tab: t })} /> : null}
          {view === "people" ? <PeopleView filter={filter} panel={panel} setFilter={(f) => go({ f }, true)} openPanel={(id) => go({ p: id }, true)} openJourney={(id) => open("journey", { j: id })} /> : null}
          {view === "journey" && journey(jid) ? <JourneyView j={journey(jid)!} tab={tab} setTab={(t) => go({ tab: t }, true)} marks={marks} setMarks={setMarks} /> : null}
          {view === "transactions" ? <TransactionsView openJourney={(id) => open("journey", { j: id, tab: "contract" })} /> : null}
          {view === "offers" ? <OffersView openJourney={(id) => open("journey", { j: id, tab: "offers" })} /> : null}
          {view === "calendar" ? <CalendarView /> : null}
          {view === "search" ? <SearchView openJourney={(id) => open("journey", { j: id, tab: "search" })} /> : null}
          {["advocacy", "reports", "questions", "settings"].includes(view) ? <KeptView view={view} /> : null}
        </main>
      </div>

      {switcher ? <Switcher close={() => setSwitcher(false)} go={(v, extra) => { open(v, extra); setSwitcher(false); }} /> : null}
      {marks.add ? (
        <div className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="add-h" onClick={() => setMarks((m) => without(m, "add"))}>
          <div className="ops-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="add-h" className="ops-h2">Add someone</h2>
            <p className="ops-muted">Name, how to reach them, buying or selling, and where they came from. In the real screen this is the form that exists today at /operations/add, moved into a panel.</p>
            <button className="ops-btn" onClick={() => setMarks((m) => without(m, "add"))}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Today */

function TodayView({ marks, setMarks, openPerson, openJourney }: {
  marks: Record<string, string>;
  setMarks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openPerson: (id: string) => void;
  openJourney: (id: string, tab?: Tab) => void;
}) {
  const newLead = PEOPLE.find((p) => p.stage === "New lead");
  const cols: TodayGroup[][] = [["attention", "approval"], ["today", "waiting"], ["upcoming"]];
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Today</h1>
        <span className="ops-muted">What needs you, what is happening, what is waiting on someone else.</span>
      </header>

      {newLead ? (
        <div className="ops-lead" role="region" aria-label="New lead">
          <span className="ops-chip ops-chip-neg"><Ico.clock size={11} />Reply within 15 min · 9 left</span>
          <strong>{newLead.name}</strong>
          <span className="ops-muted ops-grow">{newLead.summary}</span>
          <a className="ops-btn ops-btn-p" href={`tel:${newLead.phone}`}>Call {newLead.phone}</a>
          <button className="ops-btn" onClick={() => openPerson(newLead.id)}>Open</button>
        </div>
      ) : null}

      <div className="ops-today">
        {cols.map((groups, k) => (
          <div key={k} className="ops-col">
            {groups.map((g) => (
              <section key={g} className="ops-group" aria-labelledby={`g-${g}`}>
                <h2 id={`g-${g}`} className="ops-h2">{GROUP_LABEL[g]} <span className="ops-muted">{TODAY.filter((t) => t.group === g && !marks[t.id]).length}</span></h2>
                {TODAY.filter((t) => t.group === g).map((t) => (
                  <Item key={t.id} t={t} mark={marks[t.id]}
                    onMark={(m) => setMarks((x) => ({ ...x, [t.id]: m }))}
                    onUndo={() => setMarks((x) => without(x, t.id))}
                    onOpen={() => (t.journeyId ? openJourney(t.journeyId, t.group === "approval" ? "search" : "overview") : t.personId ? openPerson(t.personId) : undefined)} />
                ))}
              </section>
            ))}
            {k === 2 ? (
              <section className="ops-group" aria-labelledby="g-recent">
                <h2 id="g-recent" className="ops-h2">Recent activity</h2>
                <ul className="ops-activity">
                  {ACTIVITY.map((a) => (
                    <li key={a.at + a.what}><span className="ops-time">{a.at}</span><span className={`ops-by ops-by-${a.by.toLowerCase()}`}>{a.by}</span>{a.what}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function Item({ t, mark, onMark, onUndo, onOpen }: {
  t: TodayItem; mark?: string; onMark: (m: string) => void; onUndo: () => void; onOpen: () => void;
}) {
  const [more, setMore] = useState(false);
  const p = person(t.personId);
  if (mark) {
    return (
      <div className="ops-item ops-item-done">
        <span className="ops-muted">{t.title}: {mark}</span>
        <button className="ops-link" onClick={onUndo}>Undo</button>
      </div>
    );
  }
  return (
    <div className="ops-item">
      <div className="ops-item-top">
        <button className="ops-item-title" onClick={onOpen}>{t.title}</button>
        <span className={`ops-due ${t.due === "Today" || t.due.includes("min") ? "ops-due-now" : ""}`}>{t.due}</span>
      </div>
      <div className="ops-item-why">{t.why}</div>
      <div className="ops-item-actions">
        <span className="ops-chip" title="Owner"><Ico.users size={10} />{t.owner}</span>
        {p ? <span className="ops-chip">{p.name}</span> : null}
        {t.evidence ? <span className="ops-chip"><Ico.doc size={10} />{t.evidence}</span> : null}
        <button className="ops-btn ops-btn-sm ops-btn-p ops-push" onClick={() => (t.group === "approval" ? onMark("approved") : onOpen())}>{t.next}</button>
        <button className="ops-btn ops-btn-sm" aria-expanded={more} onClick={() => setMore((m) => !m)}>More</button>
        {more ? (
          <span className="ops-more">
            {/* OPS-02: snooze has an owner and a resume time and never moves a
                contract date; delegation waits for acceptance; a pin says why
                and when it expires. */}
            <button className="ops-link" onClick={() => onMark("snoozed until Mon 9:00, still yours; the contract date does not move")}>Snooze to Mon 9:00</button>
            <button className="ops-link" onClick={() => onMark("delegated to the transaction coordinator, waiting for them to accept")}>Delegate</button>
            <button className="ops-link" onClick={() => onMark("pinned until Fri 2 Oct: “watch the lender”")}>Pin</button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Relationships */

const FILTERS: { f: string; label: string; test: (p: MockPerson) => boolean }[] = [
  { f: "all", label: "Everyone", test: () => true },
  { f: "leads", label: "Leads", test: (p) => p.stage === "New lead" || p.stage === "Nurture" },
  { f: "clients", label: "Clients", test: (p) => p.stage === "Client" },
  { f: "buying", label: "Buying", test: (p) => p.side === "buy" },
  { f: "selling", label: "Selling", test: (p) => p.side === "sell" },
  { f: "past", label: "Past clients", test: (p) => p.stage === "Past client" },
];

function PeopleView({ filter, panel, setFilter, openPanel, openJourney }: {
  filter: string; panel?: string;
  setFilter: (f: string) => void; openPanel: (id: string | undefined) => void; openJourney: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const f = FILTERS.find((x) => x.f === filter) ?? FILTERS[0];
  const rows = PEOPLE.filter(f.test).filter((p) => !text || p.name.toLowerCase().includes(text.toLowerCase()));
  const open = person(panel);
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Relationships</h1>
        <span className="ops-muted">Leads and clients. The filter stays when you open someone and come back.</span>
      </header>
      <div className="ops-toolbar">
        <div className="ops-seg" role="group" aria-label="Filter">
          {FILTERS.map((x) => <button key={x.f} aria-pressed={x.f === f.f} onClick={() => setFilter(x.f)}>{x.label}</button>)}
        </div>
        <input className="ops-input" placeholder="Find by name" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find by name" />
      </div>
      <div className={`ops-split ${open ? "ops-split-open" : ""}`}>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Name</th><th>Side</th><th>Stage</th><th>Next action</th><th>Due</th><th>Last contact</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} aria-selected={p.id === panel} onClick={() => openPanel(p.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") openPanel(p.id); }}>
                  <td className="ops-strong">{p.name}</td>
                  <td>{p.side === "buy" ? "Buying" : "Selling"}</td>
                  <td>{p.journeyStage ? STAGE_LABEL[p.journeyStage] : p.stage}</td>
                  <td>{p.next}</td>
                  <td className={p.overdue ? "c-neg" : ""}>{p.overdue ? <><Ico.alert size={10} /> </> : null}{p.due}</td>
                  <td>{p.lastContact}</td>
                  <td className="ops-muted">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {open ? (
          <aside className="ops-panel" aria-label={open.name}>
            <div className="ops-panel-head">
              <h2 className="ops-h2">{open.name}</h2>
              <button className="ops-icon-btn" aria-label="Close" onClick={() => openPanel(undefined)}><Ico.x size={14} /></button>
            </div>
            {/* §8.5: the person view leads with what they did (§5.5). */}
            <p className="ops-summary">{open.summary}</p>
            <dl className="ops-dl">
              <dt>Next</dt><dd>{open.next} · {open.due}</dd>
              <dt>Reach</dt><dd>{open.phone ?? "No phone"} · {open.email}</dd>
              <dt>Source</dt><dd>{open.source}</dd>
            </dl>
            <div className="ops-row">
              {open.journeyId ? <button className="ops-btn ops-btn-p" onClick={() => openJourney(open.journeyId!)}>Open the journey</button> : <button className="ops-btn ops-btn-p">Start a journey</button>}
              <button className="ops-btn">Log a call</button>
            </div>
            <h3 className="ops-h3">History</h3>
            {open.notes.length ? (
              <ul className="ops-activity">
                {open.notes.map((n) => <li key={n.at + n.body}><span className="ops-time">{n.at}</span><span className="ops-by">{n.kind}</span>{n.body}</li>)}
              </ul>
            ) : <p className="ops-muted">Nothing yet.</p>}
          </aside>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ The journey */

function JourneyView({ j, tab, setTab, marks, setMarks }: {
  j: MockJourney; tab: Tab; setTab: (t: Tab) => void;
  marks: Record<string, string>; setMarks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const p = person(j.personId)!;
  const tabs = TABS.filter((t) => (t.t === "search" ? j.side === "buy" : t.t === "contract" ? Boolean(j.work) : true));
  const active = tabs.some((t) => t.t === tab) ? tab : "overview";
  return (
    <>
      {/* §8.6: a fixed header, then tabs, instead of nine stacked sections. */}
      <header className="ops-jhead">
        <div>
          <div className="ops-muted">{p.name} · {j.side === "buy" ? "Buying" : "Selling"}</div>
          <h1 className="ops-h1">{j.label}</h1>
        </div>
        <div className="ops-jfacts">
          <span className="ops-chip ops-chip-strong">{STAGE_LABEL[j.stage]}</span>
          <span className="ops-chip"><Ico.arrowR size={10} />{j.next}</span>
          <span className="ops-chip"><Ico.users size={10} />{j.household.map((h) => h.name.split(" ")[0]).join(", ")}</span>
        </div>
      </header>
      <div className="ops-tabs" role="tablist">
        {tabs.map((t) => <button key={t.t} role="tab" aria-selected={active === t.t} onClick={() => setTab(t.t)}>{t.label}</button>)}
      </div>

      {active === "overview" ? (
        <div className="ops-grid2">
          <section className="ops-card"><h2 className="ops-h2">Next actions</h2>
            <ul className="ops-list">{TODAY.filter((t) => t.journeyId === j.id).map((t) => <li key={t.id}><strong>{t.title}</strong><span className="ops-muted"> · {t.due} · {t.owner}</span></li>)}</ul>
          </section>
          <section className="ops-card"><h2 className="ops-h2">Key dates</h2>
            <ul className="ops-list">{j.keyDates.map((d) => <li key={d.label}><DateMark s={d.state} /><strong>{d.label}</strong><span className="ops-muted"> · {d.on}</span></li>)}</ul>
          </section>
          <section className="ops-card"><h2 className="ops-h2">Household</h2>
            <ul className="ops-list">{j.household.map((h) => <li key={h.name}><strong>{h.name}</strong><span className="ops-muted"> · {h.role} · {h.joined ? "joined" : "invited, not joined"}</span></li>)}</ul>
          </section>
          <section className="ops-card"><h2 className="ops-h2">Recent activity</h2>
            <ul className="ops-list">{j.activity.map((a) => <li key={a.at + a.what}><span className="ops-time">{a.at}</span>{a.what}</li>)}</ul>
          </section>
        </div>
      ) : null}

      {active === "search" ? (
        <section className="ops-card">
          {j.briefNote ? (
            <div className="ops-callout">
              <Ico.bell size={13} /><span className="ops-grow">{j.briefNote}</span>
              {marks[`brief-${j.id}`]
                ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} />Approved: Matrix search to update</span>
                : <button className="ops-btn ops-btn-p ops-btn-sm" onClick={() => setMarks((m) => ({ ...m, [`brief-${j.id}`]: "approved" }))}>Approve the update</button>}
            </div>
          ) : null}
          <table className="ops-table">
            <thead><tr><th>Criterion</th><th>Value</th><th>Strength</th><th>Who said it</th></tr></thead>
            <tbody>{(j.brief ?? []).map((b) => <tr key={b.field}><td className="ops-strong">{b.field}</td><td>{b.value}</td><td>{b.strength}</td><td className="ops-muted">{b.by}</td></tr>)}</tbody>
          </table>
          {!j.brief?.length ? <p className="ops-muted">No brief yet.</p> : null}
        </section>
      ) : null}

      {active === "homes" ? (
        <section className="ops-card">
          <table className="ops-table">
            <thead><tr><th>Home</th><th>Price</th><th>Their reaction</th><th>Showing</th></tr></thead>
            <tbody>{(j.homes ?? []).map((h) => <tr key={h.address}><td className="ops-strong">{h.address}</td><td>{h.price}</td><td>{h.reaction}</td><td className="ops-muted">{h.showing ?? ""}</td></tr>)}</tbody>
          </table>
          {!j.homes?.length ? <p className="ops-muted">No homes yet.</p> : null}
        </section>
      ) : null}

      {active === "offers" ? (
        <section className="ops-card">
          <table className="ops-table">
            <thead><tr><th>From</th><th>Price</th>{j.side === "sell" ? <th>Reaches the seller</th> : null}<th>Terms</th><th>Status</th></tr></thead>
            <tbody>{(j.offers ?? []).map((o) => <tr key={o.from}><td className="ops-strong">{o.from}</td><td>{o.price}</td>{j.side === "sell" ? <td className="ops-strong">{o.reaches}</td> : null}<td>{o.terms}</td><td>{o.status}</td></tr>)}</tbody>
          </table>
          {j.side === "sell" ? <p className="ops-muted" style={{ marginTop: 8 }}>Ranked by what reaches the seller, not the headline price: the lower offer leaves more.</p> : null}
        </section>
      ) : null}

      {active === "contract" && j.work ? (
        <section className="ops-card">
          <p className="ops-muted" style={{ marginBottom: 8 }}>{j.property}</p>
          <table className="ops-table">
            <thead><tr><th>Workstream</th><th>State</th><th>Note</th><th>Due</th></tr></thead>
            <tbody>{j.work.map((w) => {
              const Icon = Ico[STATE_ICON[w.state]];
              return <tr key={w.stream}><td className="ops-strong">{WORKSTREAM_LABEL[w.stream]}</td><td className={STATE_TONE[w.state]}><Icon size={11} /> {STATE_WORD[w.state]}</td><td>{w.note ?? ""}</td><td>{w.due ?? ""}</td></tr>;
            })}</tbody>
          </table>
        </section>
      ) : null}

      {active === "history" ? (
        <section className="ops-card">
          <ul className="ops-activity">{[...j.activity, ...p.notes.map((n) => ({ at: n.at, what: `${n.kind}: ${n.body}` }))].map((a) => <li key={a.at + a.what}><span className="ops-time">{a.at}</span>{a.what}</li>)}</ul>
        </section>
      ) : null}
    </>
  );
}

function DateMark({ s }: { s: "done" | "soon" | "passed" | "later" }) {
  if (s === "done") return <span className="ops-chip ops-chip-pos"><Ico.check size={10} />Done</span>;
  if (s === "passed") return <span className="ops-chip ops-chip-neg"><Ico.alert size={10} />Passed</span>;
  if (s === "soon") return <span className="ops-chip ops-chip-warn"><Ico.clock size={10} />Soon</span>;
  return <span className="ops-chip"><Ico.cal size={10} />Later</span>;
}

/* ----------------------------------------------------------- Transactions */

function TransactionsView({ openJourney }: { openJourney: (id: string) => void }) {
  const deals = JOURNEYS.filter((j) => j.work);
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Transactions</h1>
        <span className="ops-muted">Every contract, its ten workstreams, and what is blocked or not yet checked. Opens the journey&apos;s Contract tab.</span>
      </header>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr><th>Property</th><th>Client</th><th>Stage</th><th>Next deadline</th><th>Workstreams</th><th>Needs you</th></tr>
          </thead>
          <tbody>
            {deals.map((j) => {
              const p = person(j.personId)!;
              const next = j.keyDates.find((d) => d.state === "soon") ?? j.keyDates.find((d) => d.state === "later");
              const flags = (j.work ?? []).filter((w) => ["blocked", "waiting", "reported"].includes(w.state));
              return (
                <tr key={j.id} onClick={() => openJourney(j.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") openJourney(j.id); }}>
                  <td className="ops-strong">{j.property}</td>
                  <td>{p.name}</td>
                  <td>{STAGE_LABEL[j.stage]}</td>
                  <td>{next ? `${next.label}, ${next.on}` : ""}</td>
                  <td>
                    <span className="ops-streams">
                      {WORKSTREAMS.map((s) => {
                        const w = j.work!.find((x) => x.stream === s)!;
                        const Icon = Ico[STATE_ICON[w.state]];
                        return <span key={s} className={STATE_TONE[w.state]} title={`${WORKSTREAM_LABEL[s]}: ${STATE_WORD[w.state]}`} aria-label={`${WORKSTREAM_LABEL[s]}: ${STATE_WORD[w.state]}`}><Icon size={12} /></span>;
                      })}
                    </span>
                  </td>
                  <td>{flags.map((w) => `${WORKSTREAM_LABEL[w.stream]}: ${STATE_WORD[w.state].toLowerCase()}`).join(" · ") || "Nothing"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ops-muted" style={{ marginTop: 10 }}>
        Key: {(["confirmed", "in-progress", "waiting", "reported", "blocked", "not-started"] as WorkState[]).map((s) => {
          const Icon = Ico[STATE_ICON[s]];
          return <span key={s} className={`ops-key ${STATE_TONE[s]}`}><Icon size={11} /> {STATE_WORD[s]}</span>;
        })}
      </p>
    </>
  );
}

/* ------------------------------------------------------- The other pages */

function OffersView({ openJourney }: { openJourney: (id: string) => void }) {
  const j = journey("j3")!;
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Offers</h1><span className="ops-muted">Offers from the offer page, now with the uploaded PDF and its terms read and checked by the sender (§5.9).</span></header>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead><tr><th>Property</th><th>From</th><th>Price</th><th>Reaches the seller</th><th>Terms</th><th>Status</th></tr></thead>
          <tbody>{j.offers!.map((o) => (
            <tr key={o.from} onClick={() => openJourney(j.id)} tabIndex={0}>
              <td className="ops-strong">Grace Whitfield&apos;s home</td><td>{o.from}</td><td>{o.price}</td><td className="ops-strong">{o.reaches}</td><td>{o.terms}</td><td>{o.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

function CalendarView() {
  const items = [
    ...TODAY.filter((t) => ["today", "upcoming"].includes(t.group)).map((t) => ({ when: t.due, what: t.title, who: person(t.personId)?.name ?? "" })),
    { when: "Tue 29 Sep", what: "Booked call: Maya Tesfaye (Cal.com)", who: "Maya Tesfaye" },
  ];
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Calendar</h1><span className="ops-muted">Booked calls from Cal.com beside contract dates and showings.</span></header>
      <div className="ops-table-wrap">
        <table className="ops-table"><thead><tr><th>When</th><th>What</th><th>Who</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.when + i.what}><td className="ops-strong">{i.when}</td><td>{i.what}</td><td>{i.who}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

function SearchView({ openJourney }: { openJourney: (id: string) => void }) {
  const [pending, setPending] = useState(false);
  const rows = JOURNEYS.filter((j) => j.side === "buy").map((j) => ({
    j, status: j.briefNote ? "Update pending your approval" : j.stage === "tour" || j.stage === "search" ? "Running in Matrix" : "Finished: under contract",
  }));
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Search</h1><span className="ops-muted">Every buyer&apos;s search, and which ones changed.</span></header>
      <div className="ops-toolbar"><div className="ops-seg"><button aria-pressed={!pending} onClick={() => setPending(false)}>All</button><button aria-pressed={pending} onClick={() => setPending(true)}>Update pending</button></div></div>
      <div className="ops-table-wrap">
        <table className="ops-table"><thead><tr><th>Buyer</th><th>Journey</th><th>Search</th></tr></thead>
          <tbody>{rows.filter((r) => !pending || r.status.startsWith("Update")).map((r) => (
            <tr key={r.j.id} onClick={() => openJourney(r.j.id)} tabIndex={0}><td className="ops-strong">{person(r.j.personId)!.name}</td><td>{r.j.label}</td><td>{r.status}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

function KeptView({ view }: { view: View }) {
  const text: Record<string, string> = {
    advocacy: "Kept as it is today, restyled to this density.",
    reports: "The pilot report, plus funnel and value figures: how many people started each value, finished it, and saved a plan.",
    questions: "The funnel question editor, kept as it is, restyled.",
    settings: "Kept, with the settings grouped by what they affect: leads, emails, contract dates, privacy.",
  };
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">{view[0].toUpperCase() + view.slice(1)}</h1></header>
      <p className="ops-muted">{text[view]}</p>
    </>
  );
}

/* --------------------------------------------------------- Quick switcher */

function Switcher({ close, go }: { close: () => void; go: (v: View, extra?: Record<string, string | undefined>) => void }) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const all = useMemo(() => [
    ...PEOPLE.map((p) => ({ label: p.name, hint: "Person", run: () => go("people", { p: p.id }) })),
    ...JOURNEYS.map((j) => ({ label: `${person(j.personId)!.name}: ${j.label}`, hint: "Journey", run: () => go("journey", { j: j.id }) })),
    ...[...NAV, ...NAV_SMALL].map((n) => ({ label: n.label, hint: "Page", run: () => go(n.v) })),
  ], [go]);
  const hits = all.filter((x) => x.label.toLowerCase().includes(text.toLowerCase())).slice(0, 8);
  return (
    <div className="ops-modal" role="dialog" aria-modal="true" aria-label="Jump to" onClick={close}>
      <div className="ops-modal-card ops-switcher" onClick={(e) => e.stopPropagation()}>
        <input ref={input} className="ops-input" placeholder="Jump to a person, journey or page" value={text}
          onChange={(e) => { setText(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
            if (e.key === "Enter" && hits[i]) hits[i].run();
          }}
          role="combobox" aria-expanded="true" aria-controls="switch-list" aria-activedescendant={hits[i] ? `sw-${i}` : undefined} />
        <ul id="switch-list" role="listbox" className="ops-switch-list">
          {hits.map((h, k) => (
            <li key={h.hint + h.label} id={`sw-${k}`} role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={h.run}>
              <span>{h.label}</span><span className="ops-muted">{h.hint}</span>
            </li>
          ))}
          {!hits.length ? <li className="ops-muted">Nothing matches.</li> : null}
        </ul>
        <p className="ops-muted" style={{ marginTop: 8 }}>↑ ↓ to move, Enter to open, Esc to close. <Link href="/prototype/operations" className="ops-link">Start over</Link></p>
      </div>
    </div>
  );
}
