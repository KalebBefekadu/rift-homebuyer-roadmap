"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ico, Mark } from "@/components/rift/icons";
import { STAGES, STAGE_LABEL, WORKSTREAMS, WORKSTREAM_LABEL, type WorkState } from "@/lib/core/progress";
import {
  ACTIVITY, AUTOMATION, CALENDAR, GROUP_LABEL, JOURNEYS, MOMENTS, NOW, PEOPLE, REPORT, STATE_WORD, TODAY,
  WORKSTREAM_SHORT, daysFromNow, inDays,
  type MockJourney, type MockPerson, type TodayGroup, type TodayItem,
} from "@/lib/prototype/ops-mock";

/**
 * The Operations mock-up (Blueprint v5 §8, decision D15), second version.
 *
 * Kaleb clicks through this before any real Operations screen is rebuilt, and
 * says what to keep or change. Made-up data, nothing saved: snoozing,
 * approving and marking done change this page only.
 *
 * Where you are lives in the address (?v=, ?p=, ?j=, ?tab=, ?f=, ?s=), so the
 * back button and a returned-to list keep their place, filter and sort: one
 * of §8's acceptance checks, and the thing the live pages do not do.
 *
 * What the second version changed, and why, is in CHANGES below and behind
 * the "What changed" button on the page, so the review can check each one.
 */

type View = "today" | "people" | "person" | "journey" | "transactions" | "search" | "offers" | "calendar"
  | "advocacy" | "reports" | "questions" | "settings";
type Tab = "overview" | "search" | "homes" | "offers" | "contract" | "history";
type Marks = Record<string, string>;
type SetMarks = React.Dispatch<React.SetStateAction<Marks>>;

const NAV: { v: View; label: string; icon: keyof typeof Ico; key: string }[] = [
  { v: "today", label: "Today", icon: "home", key: "t" },
  { v: "people", label: "Relationships", icon: "users", key: "r" },
  { v: "search", label: "Search", icon: "search", key: "s" },
  { v: "transactions", label: "Transactions", icon: "doc", key: "x" },
  { v: "offers", label: "Offers", icon: "scale", key: "o" },
  { v: "calendar", label: "Calendar", icon: "cal", key: "c" },
];
const NAV_SMALL: { v: View; label: string }[] = [
  { v: "advocacy", label: "Advocacy" },
  { v: "reports", label: "Reports" },
  { v: "questions", label: "Questions" },
  { v: "settings", label: "Settings" },
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
const KIND: Record<TodayItem["kind"], { icon: keyof typeof Ico; word: string }> = {
  date: { icon: "cal", word: "Contract date" },
  failed: { icon: "alert", word: "Failed job" },
  request: { icon: "mail", word: "Client request" },
  lead: { icon: "bolt", word: "New lead" },
  draft: { icon: "send", word: "Draft" },
  search: { icon: "search", word: "Search change" },
  program: { icon: "shield", word: "Program" },
  call: { icon: "clock", word: "Call" },
  showing: { icon: "home", word: "Showing" },
  offer: { icon: "scale", word: "Offer" },
  closing: { icon: "key", word: "Closing" },
  moment: { icon: "gift", word: "Advocacy" },
};
const CAL_KIND: Record<(typeof CALENDAR)[number]["kind"], { icon: keyof typeof Ico; word: string }> = {
  call: { icon: "clock", word: "Call" },
  showing: { icon: "home", word: "Showing" },
  date: { icon: "cal", word: "Date" },
  closing: { icon: "key", word: "Closing" },
  moment: { icon: "gift", word: "Advocacy" },
};

/** The one assistant in the made-up business, so delegation has somebody to wait for. */
const DELEGATE = "Meron (transaction coordinator)";

const without = (o: Marks, key: string) => {
  const next = { ...o };
  delete next[key];
  return next;
};
const person = (id?: string) => PEOPLE.find((p) => p.id === id);
const journey = (id?: string) => JOURNEYS.find((j) => j.id === id);
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
};
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

/** What the second version changed, shown on the page so Kaleb can check each one. */
const CHANGES: string[] = [
  "Today opens with a strip answering the seven questions in §8.2, each a jump to its group.",
  "Maya is shown once, in the new-lead bar with the time left, not again inside Needs attention.",
  "The clock agrees with itself: it is 9:31, so the 8:00 retry has already happened (and failed), and Saturday's tours are under Next two weeks, not Today.",
  "Items have a Done button, and More offers three snooze times, delegation that waits for acceptance, and a pin with a reason.",
  "One black button per screen at most; item actions are quiet until they matter.",
  "Waiting on others says when you last heard and when to chase, instead of a chip.",
  "Next two weeks is a day-by-day agenda, and What changed says who did each thing, including what Rift did on its own.",
  "Relationships sorts by any column, shows counts on filters, keeps sort and filter in the address, and turns into cards on a phone.",
  "The person panel follows §8.5: summary, next action, journeys, plan, agreement, history, and a full page one click away.",
  "The journey has a way back (breadcrumb), a stage track, closing countdown, the deal team, and a Blocked or unconfirmed card.",
  "The Contract tab says who each workstream waits on and whose word confirmed it (rule 9), and flags a week with no word.",
  "Transactions is a grid: one column per workstream, the closing countdown, sorted by closing, with a blocked deal to show the state.",
  "Offers shows expiry countdowns, earnest money, where each came from, and which leaves the seller the most.",
  "Calendar is a day-by-day agenda with filters; Search, Advocacy, Reports, Questions and Settings are sketched, not placeholders.",
  "Settings shows a missing connection as missing (Brevo domain, Cal.com, offer reading), the same failure Today reports.",
  "Keyboard: ⌘K or / to jump, ? for the list, g then a letter to change page, j and k to move, e for done.",
];

export function OpsMock() {
  const router = useRouter();
  const q = useSearchParams();
  const view = (q.get("v") as View) || "today";
  const panel = q.get("p") ?? undefined;
  const jid = q.get("j") ?? undefined;
  const tab = (q.get("tab") as Tab) || "overview";
  const filter = q.get("f") ?? "all";
  const sort = q.get("s") ?? "due";

  const go = useCallback((next: Record<string, string | undefined>, replace = false) => {
    const p = new URLSearchParams(q.toString());
    for (const [k, v] of Object.entries(next)) { if (v === undefined) p.delete(k); else p.set(k, v); }
    const url = `?${p.toString()}`;
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }, [q, router]);
  const open = useCallback((v: View, extra: Record<string, string | undefined> = {}) => {
    go({ v, p: undefined, j: undefined, tab: undefined, ...extra });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [go]);

  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<null | "switcher" | "add" | "keys" | "changes" | { draft: string }>(null);
  const [toast, setToast] = useState<string | null>(null);
  /* What Kaleb did to items in this session: done, snoozed, delegated, pinned,
     approved. The mock-up shows the consequence; nothing is stored. */
  const [marks, setMarks] = useState<Marks>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* Keyboard (§8.9: everything by keyboard). "g" then a letter changes page,
     the way mail clients do it, so single letters stay free for the list. */
  const pendingG = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setDialog((d) => (d === "switcher" ? null : "switcher")); return; }
      if (e.key === "Escape") { setMenu(false); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || dialog) return;
      if (Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const n = NAV.find((x) => x.key === e.key);
        if (n) { e.preventDefault(); open(n.v); }
        return;
      }
      if (e.key === "g") { pendingG.current = Date.now(); return; }
      if (e.key === "/") { e.preventDefault(); setDialog("switcher"); return; }
      if (e.key === "?") { e.preventDefault(); setDialog("keys"); return; }
      if (e.key === "j" || e.key === "k") {
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row]"));
        if (!rows.length) return;
        e.preventDefault();
        const at = rows.findIndex((r) => r.contains(document.activeElement));
        const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === "j" ? 1 : -1)))] ?? rows[0];
        next.focus();
        next.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "e") {
        const item = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-item]");
        if (item?.dataset.item) { e.preventDefault(); setMarks((m) => ({ ...m, [item.dataset.item!]: "Done" })); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, open]);

  const attention = TODAY.filter((t) => t.group === "attention" && !marks[t.id]).length + (marks.lead ? 0 : 1);
  const counts: Partial<Record<View, { n: number; tone?: "neg" }>> = {
    today: { n: attention, tone: "neg" },
    search: { n: marks["brief-j2"] ? 0 : 1 },
    offers: { n: 1 },
    transactions: { n: 1, tone: "neg" },
  };
  const current = view === "journey" || view === "person" ? "people" : view;

  return (
    <div className={`ops ${collapsed ? "ops-collapsed" : ""}`}>
      <div className="ops-mockbar" role="note">
        <Ico.info size={13} aria-hidden />
        <span className="ops-grow">Mock-up with made-up data, for Kaleb to click through before Operations is rebuilt (D15). Nothing here is saved.</span>
        <button className="ops-mockbar-btn" onClick={() => setDialog("changes")}>What changed in version 2</button>
      </div>

      <div className="ops-frame">
        {menu ? <div className="ops-scrim" onClick={() => setMenu(false)} aria-hidden /> : null}
        <aside id="ops-side" className={`ops-side ${menu ? "ops-side-open" : ""}`} aria-label="Operations">
          <div className="ops-brand">
            <Mark size={18} /><span className="ops-brand-name">Operations</span>
            <button className="ops-icon-btn ops-collapse" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
              aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
              <Ico.chevL size={14} style={{ transform: collapsed ? "rotate(180deg)" : undefined }} />
            </button>
          </div>
          <button className="ops-add" onClick={() => { setDialog("add"); setMenu(false); }} title="Add someone">
            <Ico.plus size={14} /><span className="ops-hide-collapsed">Add someone</span>
          </button>
          <button className="ops-find" onClick={() => { setDialog("switcher"); setMenu(false); }} title="Jump to (⌘K)">
            <Ico.search size={13} /><span className="ops-hide-collapsed">Jump to…</span><kbd className="ops-hide-collapsed">⌘K</kbd>
          </button>
          <nav aria-label="Pages">
            {NAV.map((n) => {
              const Icon = Ico[n.icon];
              const c = counts[n.v];
              return (
                <button key={n.v} className="ops-nav" aria-current={current === n.v ? "page" : undefined}
                  onClick={() => { open(n.v); setMenu(false); }} title={n.label}>
                  <Icon size={15} /><span className="ops-hide-collapsed">{n.label}</span>
                  {c && c.n ? (
                    <span className={`ops-count ${c.tone === "neg" ? "ops-count-neg" : ""}`}>
                      {c.n}<span className="sr-only"> {c.tone === "neg" ? "need attention" : "new"}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <nav className="ops-nav-small ops-hide-collapsed" aria-label="More pages">
            {NAV_SMALL.map((n) => (
              <button key={n.v} className="ops-nav" aria-current={view === n.v ? "page" : undefined} onClick={() => { open(n.v); setMenu(false); }}>{n.label}</button>
            ))}
            <span className="ops-nav ops-nav-later">Campaigns <em>later</em></span>
          </nav>
          <button className="ops-nav ops-keys ops-hide-collapsed" onClick={() => { setDialog("keys"); setMenu(false); }}>
            <kbd>?</kbd> Keyboard shortcuts
          </button>
        </aside>

        <main className="ops-main" id="ops-main">
          <div className="ops-top">
            <button className="ops-btn ops-btn-sm ops-menu" aria-expanded={menu} aria-controls="ops-side" onClick={() => setMenu((m) => !m)}>
              <Ico.filter size={14} /> Menu
            </button>
            <span className="ops-crumb">{NOW.label}</span>
            <button className="ops-icon-btn" aria-label="Jump to" onClick={() => setDialog("switcher")}><Ico.search size={14} /></button>
          </div>

          {view === "today" ? (
            <TodayView marks={marks} setMarks={setMarks} setToast={setToast}
              openPerson={(id) => open("people", { p: id })}
              openJourney={(id, t) => open("journey", { j: id, tab: t })}
              openDraft={(id) => setDialog({ draft: id })}
              openView={(v) => open(v)} />
          ) : null}
          {view === "people" ? (
            <PeopleView filter={filter} sort={sort} panel={panel}
              setFilter={(f) => go({ f }, true)} setSort={(s) => go({ s }, true)}
              openPanel={(id) => go({ p: id }, true)}
              openFull={(id) => open("person", { p: id })}
              openJourney={(id) => open("journey", { j: id })} setToast={setToast} />
          ) : null}
          {view === "person" && person(panel) ? (
            <>
              <nav className="ops-crumbs" aria-label="Breadcrumb">
                <button className="ops-link" onClick={() => open("people")}>Relationships</button><Ico.chevR size={11} aria-hidden />
                <span aria-current="page">{person(panel)!.name}</span>
              </nav>
              <div className="ops-card ops-person-full">
                <PersonDetail p={person(panel)!} wide openJourney={(id) => open("journey", { j: id })} setToast={setToast} />
              </div>
            </>
          ) : null}
          {view === "journey" && journey(jid) ? (
            <JourneyView j={journey(jid)!} tab={tab} setTab={(t) => go({ tab: t }, true)} marks={marks} setMarks={setMarks} setToast={setToast}
              back={() => open("people")} openPerson={(id) => open("people", { p: id })} />
          ) : null}
          {view === "transactions" ? <TransactionsView openJourney={(id) => open("journey", { j: id, tab: "contract" })} /> : null}
          {view === "offers" ? <OffersView openJourney={(id) => open("journey", { j: id, tab: "offers" })} /> : null}
          {view === "calendar" ? <CalendarView openPerson={(id) => open("people", { p: id })} /> : null}
          {view === "search" ? <SearchView marks={marks} openJourney={(id) => open("journey", { j: id, tab: "search" })} /> : null}
          {view === "advocacy" ? <AdvocacyView setToast={setToast} /> : null}
          {view === "reports" ? <ReportsView /> : null}
          {view === "questions" ? <QuestionsView /> : null}
          {view === "settings" ? <SettingsView /> : null}
        </main>
      </div>

      {dialog === "switcher" ? <Switcher close={() => setDialog(null)} go={(v, extra) => { open(v, extra); setDialog(null); }} /> : null}
      {dialog === "keys" ? (
        <Dialog title="Keyboard shortcuts" close={() => setDialog(null)}>
          <dl className="ops-keys-list">
            {[
              ["⌘K or /", "Jump to a person, journey or page"],
              ["g then t, r, s, x, o, c", "Today, Relationships, Search, Transactions, Offers, Calendar"],
              ["j and k", "Next and previous item or row"],
              ["Enter", "Open it"],
              ["e", "Mark the item on Today done"],
              ["Esc", "Close a panel, menu or dialog"],
              ["?", "This list"],
            ].map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}
          </dl>
        </Dialog>
      ) : null}
      {dialog === "changes" ? (
        <Dialog title="What changed in version 2" close={() => setDialog(null)} wide>
          <p className="ops-muted">From an audit of the first version against §8. Say which of these to keep.</p>
          <ol className="ops-changes">{CHANGES.map((c) => <li key={c}>{c}</li>)}</ol>
        </Dialog>
      ) : null}
      {dialog === "add" ? <AddDialog close={() => setDialog(null)} setToast={setToast} /> : null}
      {dialog && typeof dialog === "object" ? (
        <Dialog title="Draft reply to Tomás Rivera" close={() => setDialog(null)} wide>
          <p className="ops-muted">Drafted from his saved plan. Every figure is from the plan, not written by a model; nothing sends until you approve (AUTO-01).</p>
          <blockquote className="ops-draft">
            Hi Tomás, good question. Your plan used your income only and came out at 14 months to save the down payment.
            If your partner&apos;s income counts too, the plan can be run again with both, and the timeline will change.
            Want me to send you the link to add it, or talk it through on a call?
          </blockquote>
          <div className="ops-row">
            <button className="ops-btn ops-btn-p" onClick={() => { setMarks((m) => ({ ...m, [dialog.draft]: "Approved and sent" })); setDialog(null); setToast("Approved. In the real screen this sends from your address."); }}>Approve and send</button>
            <button className="ops-btn" onClick={() => { setDialog(null); setToast("In the real screen you edit the draft here before sending."); }}>Edit first</button>
          </div>
        </Dialog>
      ) : null}

      <div className="ops-toast-wrap" role="status" aria-live="polite">{toast ? <div className="ops-toast">{toast}</div> : null}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Dialog */

/** A modal that takes focus, keeps it, and gives it back where it was. */
function Dialog({ title, close, children, wide }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    /* A field first, if there is one: the switcher opened on its Close button,
       so the first thing typed went nowhere. */
    const first = card.current?.querySelector<HTMLElement>("input, textarea, select")
      ?? card.current?.querySelector<HTMLElement>("[href], button:not([aria-label='Close'])");
    (first ?? card.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key !== "Tab" || !card.current) return;
      const f = Array.from(card.current.querySelectorAll<HTMLElement>("input, button, [href], textarea, select")).filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [close]);
  const id = `d-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="ops-modal" onClick={close}>
      <div ref={card} className={`ops-modal-card ${wide ? "ops-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}
        tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="ops-panel-head">
          <h2 id={id} className="ops-h2">{title}</h2>
          <button className="ops-icon-btn" aria-label="Close" onClick={close}><Ico.x size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddDialog({ close, setToast }: { close: () => void; setToast: (t: string) => void }) {
  return (
    <Dialog title="Add someone" close={close}>
      <form className="ops-form" onSubmit={(e) => { e.preventDefault(); close(); setToast("Not saved: this is a mock-up. The real form files them under Relationships and starts the 15-minute clock."); }}>
        <label htmlFor="add-name">Name<input id="add-name" className="ops-input" required autoComplete="off" /></label>
        <div className="ops-form-2">
          <label htmlFor="add-phone">Phone<input id="add-phone" className="ops-input" inputMode="tel" autoComplete="off" /></label>
          <label htmlFor="add-email">Email<input id="add-email" className="ops-input" type="email" autoComplete="off" /></label>
        </div>
        <fieldset className="ops-fieldset">
          <legend>They are</legend>
          <label><input type="radio" name="add-side" defaultChecked /> Buying</label>
          <label><input type="radio" name="add-side" /> Selling</label>
          <label><input type="radio" name="add-side" /> Both</label>
        </fieldset>
        <label htmlFor="add-source">Where they came from
          <select id="add-source" className="ops-input" defaultValue="Referral">
            <option>Referral</option><option>Past client</option><option>Instagram</option><option>Open house</option><option>Other</option>
          </select>
        </label>
        <p className="ops-muted">Only you can text them: a text needs their consent first, so the first touch is a call or an email.</p>
        <div className="ops-row"><button className="ops-btn ops-btn-p" type="submit">Add</button><button className="ops-btn" type="button" onClick={close}>Cancel</button></div>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Today */

const GROUP_ICON: Record<TodayGroup, keyof typeof Ico> = {
  attention: "alert", approval: "check", today: "clock", waiting: "pause", upcoming: "cal",
};

function TodayView({ marks, setMarks, setToast, openPerson, openJourney, openDraft, openView }: {
  marks: Marks; setMarks: SetMarks; setToast: (t: string) => void;
  openPerson: (id: string) => void;
  openJourney: (id: string, tab?: Tab) => void;
  openDraft: (id: string) => void;
  openView: (v: View) => void;
}) {
  const lead = PEOPLE.find((p) => p.stage === "New lead")!;
  const live = (g: TodayGroup) => TODAY.filter((t) => t.group === g && !marks[t.id]).length;
  const jump = (g: string) => {
    const h = document.getElementById(`g-${g}`);
    h?.scrollIntoView({ block: "start", behavior: "smooth" });
    h?.focus({ preventScroll: true });
  };
  const openItem = (t: TodayItem) => (t.journeyId ? openJourney(t.journeyId, t.tab) : t.personId ? openPerson(t.personId) : undefined);
  const act = (t: TodayItem) => {
    if (t.kind === "draft") return openDraft(t.id);
    if (t.kind === "failed") return openView("settings");
    if (t.kind === "program") return setToast("In the real screen this opens the official page beside the change, with Approve and Reject.");
    if (t.kind === "moment") return openView("advocacy");
    return openItem(t);
  };
  const summary: { g: string; label: string; n: number; icon: keyof typeof Ico; tone?: string }[] = [
    { g: "attention", label: "need you", n: live("attention") + (marks.lead ? 0 : 1), icon: "alert", tone: "neg" },
    { g: "approval", label: "to approve", n: live("approval"), icon: "check" },
    { g: "today", label: "today", n: live("today"), icon: "clock" },
    { g: "waiting", label: "waiting", n: live("waiting"), icon: "pause" },
    { g: "upcoming", label: "coming up", n: live("upcoming"), icon: "cal" },
    { g: "recent", label: "changes", n: ACTIVITY.length, icon: "refresh" },
  ];
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Today</h1>
        <span className="ops-muted">Friday 25 September, {NOW.time}</span>
      </header>

      {/* §8.2's seven questions, answered in one line before anything else. */}
      <nav className="ops-glance" aria-label="Today at a glance">
        {summary.map((s) => {
          const Icon = Ico[s.icon];
          return (
            <button key={s.g} className={`ops-glance-item ${s.tone === "neg" && s.n ? "is-neg" : ""}`} onClick={() => jump(s.g)}>
              <Icon size={13} aria-hidden /><strong>{s.n}</strong> {s.label}
            </button>
          );
        })}
        <button className={`ops-glance-item ${AUTOMATION.failed ? "is-neg" : ""}`} onClick={() => jump("recent")}>
          <Ico.bolt size={13} aria-hidden />Rift: {AUTOMATION.failed ? <><strong>{AUTOMATION.failed}</strong> failing</> : "nothing failing"}
        </button>
      </nav>

      {marks.lead ? (
        <div className="ops-lead ops-lead-done" role="region" aria-label="New lead">
          <Ico.checkCircle size={14} aria-hidden /> Maya Tesfaye: {marks.lead}.
          <button className="ops-link" onClick={() => setMarks((m) => without(m, "lead"))}>Undo</button>
        </div>
      ) : (
        <div className="ops-lead" role="region" aria-label="New lead">
          <span className="ops-chip ops-chip-neg"><Ico.clock size={11} aria-hidden />New lead · reply by 9:40, 9 min left</span>
          <strong>{lead.name}</strong>
          <span className="ops-lead-sum" title={lead.summary}>{lead.summary}</span>
          <span className="ops-row ops-lead-actions">
            <a className="ops-btn ops-btn-p" href={`tel:${lead.phone}`}>Call {lead.phone}</a>
            <button className="ops-btn" onClick={() => openPerson(lead.id)}>Open</button>
            <button className="ops-btn" onClick={() => setMarks((m) => ({ ...m, lead: "called, logged at 9:33" }))}>Log the call</button>
          </span>
        </div>
      )}

      <div className="ops-today">
        <div className="ops-col">
          {(["attention"] as TodayGroup[]).map((g) => (
            <section key={g} className="ops-group" aria-labelledby={`g-${g}`}>
              <GroupHead g={g} n={live(g)} />
              {TODAY.filter((t) => t.group === g).map((t) => (
                <Item key={t.id} t={t} mark={marks[t.id]} urgent={g === "attention"}
                  onMark={(m) => setMarks((x) => ({ ...x, [t.id]: m }))}
                  onUndo={() => setMarks((x) => without(x, t.id))}
                  onOpen={() => openItem(t)}
                  onAct={() => (t.kind === "search" ? setMarks((x) => ({ ...x, [t.id]: "Approved: the Matrix search updates tonight", "brief-j2": "approved" })) : act(t))}
                  actLabel={t.kind === "search" ? "Approve" : t.next}
                  second={t.kind === "search" ? { label: "Review first", run: () => openItem(t) } : undefined} />
              ))}
              {!live(g) ? <p className="ops-empty"><Ico.checkCircle size={13} aria-hidden /> Nothing left here.</p> : null}
            </section>
          ))}
          <section className="ops-group" aria-labelledby="g-waiting">
            <GroupHead g="waiting" n={live("waiting")} />
            {TODAY.filter((t) => t.group === "waiting").map((t) => (
              marks[t.id] ? <DoneRow key={t.id} t={t} mark={marks[t.id]} undo={() => setMarks((x) => without(x, t.id))} /> : (
                <div key={t.id} className="ops-item" data-item={t.id}>
                  <div className="ops-item-top">
                    <button className="ops-item-title" data-row onClick={() => openItem(t)}>{t.title}</button>
                    <span className="ops-due">{t.due}</span>
                  </div>
                  <div className="ops-item-why" title={t.why}>{t.why}</div>
                  <dl className="ops-wait">
                    <div><dt>With</dt><dd>{t.owner}</dd></div>
                    <div><dt>Last heard</dt><dd>{t.lastHeard}</dd></div>
                    <div><dt>Chase</dt><dd>{t.checkIn}</dd></div>
                  </dl>
                  <div className="ops-item-actions">
                    <button className="ops-btn ops-btn-sm" onClick={() => setMarks((x) => ({ ...x, [t.id]: `Chased at ${NOW.time}; the next check-in moves to Tuesday` }))}>Chase now</button>
                    <button className="ops-btn ops-btn-sm" onClick={() => setMarks((x) => ({ ...x, [t.id]: "Done" }))}><Ico.check size={11} aria-hidden />Arrived</button>
                  </div>
                </div>
              )
            ))}
          </section>
        </div>

        <div className="ops-col">
          {(["approval"] as TodayGroup[]).map((g) => (
            <section key={g} className="ops-group" aria-labelledby={`g-${g}`}>
              <GroupHead g={g} n={live(g)} />
              {TODAY.filter((t) => t.group === g).map((t) => (
                <Item key={t.id} t={t} mark={marks[t.id]} urgent={g === "attention"}
                  onMark={(m) => setMarks((x) => ({ ...x, [t.id]: m }))}
                  onUndo={() => setMarks((x) => without(x, t.id))}
                  onOpen={() => openItem(t)}
                  onAct={() => (t.kind === "search" ? setMarks((x) => ({ ...x, [t.id]: "Approved: the Matrix search updates tonight", "brief-j2": "approved" })) : act(t))}
                  actLabel={t.kind === "search" ? "Approve" : t.next}
                  second={t.kind === "search" ? { label: "Review first", run: () => openItem(t) } : undefined} />
              ))}
              {!live(g) ? <p className="ops-empty"><Ico.checkCircle size={13} aria-hidden /> Nothing left here.</p> : null}
            </section>
          ))}
          <section className="ops-group" aria-labelledby="g-today">
            <GroupHead g="today" n={live("today")} />
            <ul className="ops-agenda">
              {TODAY.filter((t) => t.group === "today").map((t) => {
                const K = Ico[KIND[t.kind].icon];
                if (marks[t.id]) return <DoneRow key={t.id} t={t} mark={marks[t.id]} undo={() => setMarks((x) => without(x, t.id))} />;
                return (
                  <li key={t.id} className="ops-agenda-row" data-item={t.id}>
                    <span className="ops-agenda-time">{t.due}</span>
                    <span className="ops-agenda-body">
                      <button className="ops-item-title" data-row onClick={() => openItem(t)}>
                        <K size={12} aria-hidden /> {t.title}
                      </button>
                      <span className="ops-item-why">{t.why}</span>
                      <span className="ops-item-meta">
                        <Owner o={t.owner} />
                        <button className="ops-link" onClick={() => act(t)}>{t.next}</button>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="ops-col">
          <section className="ops-group" aria-labelledby="g-upcoming">
            <GroupHead g="upcoming" n={live("upcoming")} />
            <div className="ops-card ops-card-tight">
              {[...new Set(TODAY.filter((t) => t.group === "upcoming").map((t) => t.on))].map((d) => (
                <div key={d} className="ops-day">
                  <h3 className="ops-day-head">{dayLabel(d)} <span className="ops-muted">· {inDays(d)}</span></h3>
                  <ul className="ops-day-list">
                    {TODAY.filter((t) => t.group === "upcoming" && t.on === d).map((t) => {
                      const K = Ico[KIND[t.kind].icon];
                      return (
                        <li key={t.id}>
                          <span className="ops-kind" title={KIND[t.kind].word}><K size={11} aria-hidden /><span className="sr-only">{KIND[t.kind].word}: </span></span>
                          <button className="ops-item-title" data-row onClick={() => (t.kind === "moment" ? openView("advocacy") : openItem(t))}>{t.title}</button>
                          <Owner o={t.owner} quiet />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          <section className="ops-group" aria-labelledby="g-recent">
            <h2 id="g-recent" className="ops-h2" tabIndex={-1}><Ico.refresh size={12} aria-hidden /> What changed since yesterday</h2>
            <p className="ops-rift-line">
              <Ico.bolt size={12} aria-hidden /> Rift on its own: {AUTOMATION.sent} emails sent, {AUTOMATION.stopped} stopped by a reply, {AUTOMATION.checked} program pages checked,{" "}
              {AUTOMATION.failed ? <strong className="c-neg">{AUTOMATION.failed} job failing</strong> : "nothing failing"}.
            </p>
            <ul className="ops-activity">
              {ACTIVITY.map((a) => (
                <li key={a.at + a.what}><span className="ops-time">{a.at}</span><span className={`ops-by ops-by-${a.by.toLowerCase()}`}>{a.by}</span><span>{a.what}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function GroupHead({ g, n }: { g: TodayGroup; n: number }) {
  const Icon = Ico[GROUP_ICON[g]];
  return (
    <h2 id={`g-${g}`} className={`ops-h2 ${g === "attention" && n ? "c-neg" : ""}`} tabIndex={-1}>
      <Icon size={12} aria-hidden /> {GROUP_LABEL[g]} <span className="ops-muted">{n}</span>
    </h2>
  );
}

/** Who owns it. "You" is quiet; anyone else is the point, so it is not. */
function Owner({ o, quiet }: { o: string; quiet?: boolean }) {
  return o === "You"
    ? <span className="ops-owner">{quiet ? "" : "You"}</span>
    : <span className="ops-owner ops-owner-other"><Ico.users size={10} aria-hidden />{o}</span>;
}

function DoneRow({ t, mark, undo }: { t: TodayItem; mark: string; undo: () => void }) {
  return (
    <div className="ops-item ops-item-done" data-item={t.id}>
      <span><Ico.check size={11} aria-hidden /> <span className="ops-muted">{t.title}:</span> {mark}</span>
      <button className="ops-link" data-row onClick={undo}>Undo</button>
    </div>
  );
}

function Item({ t, mark, urgent, onMark, onUndo, onOpen, onAct, actLabel, second }: {
  t: TodayItem; mark?: string; urgent?: boolean;
  onMark: (m: string) => void; onUndo: () => void; onOpen: () => void; onAct: () => void;
  actLabel: string; second?: { label: string; run: () => void };
}) {
  const [more, setMore] = useState(false);
  const p = person(t.personId);
  const K = Ico[KIND[t.kind].icon];
  if (mark) return <DoneRow t={t} mark={mark} undo={onUndo} />;
  return (
    <div className={`ops-item ${urgent ? "ops-item-urgent" : ""}`} data-item={t.id}>
      <div className="ops-item-top">
        <span className="ops-kind" title={KIND[t.kind].word}><K size={12} aria-hidden /></span>
        <button className="ops-item-title" data-row onClick={onOpen}><span className="sr-only">{KIND[t.kind].word}: </span>{t.title}</button>
        <span className={`ops-due ${urgent ? "ops-due-now" : ""}`}>{t.due}</span>
      </div>
      <div className="ops-item-why" title={t.why}>{t.why}</div>
      <div className="ops-item-meta">
        <Owner o={t.owner} />
        {p ? <button className="ops-link" onClick={onOpen}>{p.name}</button> : null}
        {t.evidence ? <span className="ops-evidence"><Ico.doc size={10} aria-hidden />{t.evidence}</span> : null}
      </div>
      <div className="ops-item-actions">
        <button className={`ops-btn ops-btn-sm ${urgent ? "ops-btn-strong" : ""}`} onClick={onAct}>{actLabel}</button>
        {second ? <button className="ops-btn ops-btn-sm" onClick={second.run}>{second.label}</button> : null}
        <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => onMark("Done")} aria-label={`Mark done: ${t.title}`}><Ico.check size={11} aria-hidden />Done</button>
        <button className="ops-icon-btn ops-icon-quiet" aria-expanded={more} aria-label={`More: snooze, delegate or pin ${t.title}`} title="Snooze, delegate or pin" onClick={() => setMore((m) => !m)}><Ico.more size={15} /></button>
      </div>
      {more ? (
        /* OPS-02: snooze has an owner and a resume time and never moves a
           contract date; delegation waits for acceptance; a pin says why and
           when it expires. */
        <div className="ops-more" role="group" aria-label="More actions">
          <span className="ops-more-label">Snooze, still yours:</span>
          <button className="ops-link" onClick={() => onMark("Snoozed until 1:00 pm, still yours")}>Until 1:00 pm</button>
          <button className="ops-link" onClick={() => onMark("Snoozed until tomorrow 9:00, still yours")}>Tomorrow 9:00</button>
          <button className="ops-link" onClick={() => onMark("Snoozed until Mon 9:00, still yours")}>Monday 9:00</button>
          {t.kind === "date" ? <span className="ops-more-note">Snoozing never moves the contract date.</span> : null}
          <span className="ops-more-label">Or:</span>
          <button className="ops-link" onClick={() => onMark(`Offered to ${DELEGATE}; yours until they accept`)}>Delegate to Meron</button>
          <button className="ops-link" onClick={() => onMark("Pinned to the top until Fri 2 Oct: “watch this one”")}>Pin with a reason</button>
        </div>
      ) : null}
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
const SORTS: Record<string, { label: string; by: (a: MockPerson, b: MockPerson) => number }> = {
  name: { label: "Name", by: (a, b) => a.name.localeCompare(b.name) },
  due: { label: "Due", by: (a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) || a.dueOn.localeCompare(b.dueOn) },
  contact: { label: "Last contact", by: (a, b) => b.lastContactOn.localeCompare(a.lastContactOn) },
};

const stageOf = (p: MockPerson) => (p.journeyStage ? STAGE_LABEL[p.journeyStage] : p.stage);

function PeopleView({ filter, sort, panel, setFilter, setSort, openPanel, openFull, openJourney, setToast }: {
  filter: string; sort: string; panel?: string;
  setFilter: (f: string) => void; setSort: (s: string) => void;
  openPanel: (id: string | undefined) => void; openFull: (id: string) => void; openJourney: (id: string) => void;
  setToast: (t: string) => void;
}) {
  const [text, setText] = useState("");
  const f = FILTERS.find((x) => x.f === filter) ?? FILTERS[0];
  const s = SORTS[sort] ?? SORTS.due;
  const rows = PEOPLE.filter(f.test).filter((p) => !text || p.name.toLowerCase().includes(text.toLowerCase())).sort(s.by);
  const open = person(panel);
  const selectedRow = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isTyping(e.target)) openPanel(undefined); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);
  const th = (key: string, label: string, cls = "") => (
    <th className={cls} aria-sort={sort === key ? (key === "contact" ? "descending" : "ascending") : undefined}>
      <button className="ops-sort" onClick={() => setSort(key)}>{label}{sort === key ? <Ico.chevD size={10} aria-hidden /> : null}</button>
    </th>
  );
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Relationships</h1>
        <span className="ops-muted">Leads and clients. Filter and sort stay when you open someone and come back.</span>
      </header>
      <div className="ops-toolbar">
        <div className="ops-seg" role="group" aria-label="Show">
          {FILTERS.map((x) => (
            <button key={x.f} aria-pressed={x.f === f.f} onClick={() => setFilter(x.f)}>
              {x.label} <span className="ops-seg-n">{PEOPLE.filter(x.test).length}</span>
            </button>
          ))}
        </div>
        <label className="ops-search">
          <Ico.search size={13} aria-hidden />
          <input className="ops-input" placeholder="Find by name" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find by name" />
        </label>
      </div>
      <div className={`ops-split ${open ? "ops-split-open" : ""}`}>
        <div className="ops-table-wrap">
          <table className="ops-table ops-table-cards">
            <caption className="sr-only">{rows.length} people, sorted by {s.label.toLowerCase()}</caption>
            <thead>
              <tr>{th("name", "Name")}<th className="ops-opt">Side</th><th>Stage</th><th>Next action</th>{th("due", "Due")}{th("contact", "Last contact", "ops-opt")}<th className="ops-opt">Source</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} aria-selected={p.id === panel} onClick={() => openPanel(p.id)}>
                  <td className="ops-strong">
                    <button ref={p.id === panel ? selectedRow : undefined} className="ops-rowlink" data-row onClick={(e) => { e.stopPropagation(); openPanel(p.id); }}>{p.name}</button>
                  </td>
                  <td className="ops-opt" data-label="Side">{p.side === "buy" ? "Buying" : "Selling"}</td>
                  <td data-label="Stage"><span className="ops-stage">{stageOf(p)}</span></td>
                  <td data-label="Next">{p.next}</td>
                  <td data-label="Due" className={p.overdue ? "c-neg ops-strong" : ""}>{p.overdue ? <><Ico.alert size={10} aria-hidden /> Overdue · </> : null}{p.due}</td>
                  <td className="ops-opt" data-label="Last contact">{p.lastContact}</td>
                  <td className="ops-opt ops-muted" data-label="Source">{p.source}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={7} className="ops-muted">Nobody matches. Clear the search or pick Everyone.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {open ? (
          <aside className="ops-panel" aria-label={open.name}>
            <div className="ops-panel-head">
              <h2 className="ops-h2 ops-panel-title">{open.name}</h2>
              <span className="ops-row">
                <button className="ops-btn ops-btn-sm" onClick={() => openFull(open.id)}>Full page<Ico.arrowUpR size={11} aria-hidden /></button>
                <button className="ops-icon-btn" aria-label="Close the panel" onClick={() => { openPanel(undefined); }}><Ico.x size={14} /></button>
              </span>
            </div>
            <PersonDetail p={open} openJourney={openJourney} setToast={setToast} />
          </aside>
        ) : null}
      </div>
    </>
  );
}

/** §8.5: the person view leads with what they did (§5.5), then journeys, plan, agreement, history. */
function PersonDetail({ p, wide, openJourney, setToast }: { p: MockPerson; wide?: boolean; openJourney: (id: string) => void; setToast: (t: string) => void }) {
  const js = p.journeyIds.map((id) => journey(id)!).filter(Boolean);
  const agreementIcon = p.agreement.state === "signed" ? "checkCircle" : "alert";
  const AgreementIcon = Ico[agreementIcon];
  return (
    <div className={wide ? "ops-person ops-person-wide" : "ops-person"}>
      <div>
        <p className="ops-summary"><span className="ops-summary-label">What they did</span>{p.summary}</p>
        <dl className="ops-dl">
          <dt>Next</dt><dd><strong>{p.next}</strong> · <span className={p.overdue ? "c-neg" : ""}>{p.overdue ? "overdue, " : ""}{p.due}</span></dd>
          <dt>Phone</dt><dd>{p.phone ? <span className="ops-copy">{p.phone}</span> : <span className="ops-muted">None given</span>}</dd>
          <dt>Email</dt><dd><span className="ops-copy">{p.email}</span></dd>
          <dt>Source</dt><dd>{p.source}</dd>
          <dt>Plan</dt><dd>{p.plan ?? <span className="ops-muted">No saved plan</span>}</dd>
          <dt>Agreement</dt><dd className={p.agreement.state === "signed" ? "c-pos" : "c-warn"}><AgreementIcon size={11} aria-hidden /> {p.agreement.text}</dd>
        </dl>
        <div className="ops-row">
          {js[0] ? <button className="ops-btn ops-btn-p" onClick={() => openJourney(js[0].id)}>Open the journey</button>
            : <button className="ops-btn ops-btn-p" onClick={() => setToast("In the real screen this starts a journey and invites the household.")}>Start a journey</button>}
          <button className="ops-btn" onClick={() => setToast("In the real screen: who, what was said, and when. It is added to the history.")}>Log a call</button>
        </div>
      </div>
      <div>
        {js.length ? (
          <>
            <h3 className="ops-h3">Journeys</h3>
            <ul className="ops-list">
              {js.map((j) => (
                <li key={j.id}>
                  <button className="ops-link ops-strong" onClick={() => openJourney(j.id)}>{j.label}</button>
                  <span className="ops-stage">{STAGE_LABEL[j.stage]}</span>
                  {j.closing ? <span className="ops-muted">closing {j.closing.label}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3 className="ops-h3">History</h3>
        {p.notes.length ? (
          <ul className="ops-activity">
            {p.notes.map((n) => <li key={n.at + n.body}><span className="ops-time ops-time-wide">{n.at}</span><span className="ops-by">{n.kind}</span><span>{n.body}</span></li>)}
          </ul>
        ) : <p className="ops-muted">Nothing yet.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ The journey */

const TABS: { t: Tab; label: string }[] = [
  { t: "overview", label: "Overview" },
  { t: "search", label: "Search" },
  { t: "homes", label: "Homes and showings" },
  { t: "offers", label: "Offers and documents" },
  { t: "contract", label: "Contract" },
  { t: "history", label: "History" },
];

function JourneyView({ j, tab, setTab, marks, setMarks, setToast, back, openPerson }: {
  j: MockJourney; tab: Tab; setTab: (t: Tab) => void;
  marks: Marks; setMarks: SetMarks; setToast: (t: string) => void;
  back: () => void; openPerson: (id: string) => void;
}) {
  const p = person(j.personId)!;
  const tabs = TABS.filter((t) => (t.t === "search" ? j.side === "buy" && j.brief : t.t === "contract" ? Boolean(j.work) : true));
  const active = tabs.some((t) => t.t === tab) ? tab : "overview";
  const count: Partial<Record<Tab, number>> = { homes: j.homes?.length, offers: (j.offers?.length ?? 0) + (j.documents?.length ?? 0) };
  const flags = (j.work ?? []).filter((w) => ["blocked", "waiting", "reported"].includes(w.state) || w.stale);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stageAt = STAGES.indexOf(j.stage);
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[n].t);
    tabRefs.current[n]?.focus();
  };
  return (
    <>
      <nav className="ops-crumbs" aria-label="Breadcrumb">
        <button className="ops-link" onClick={back}>Relationships</button><Ico.chevR size={11} aria-hidden />
        <button className="ops-link" onClick={() => openPerson(p.id)}>{p.name}</button><Ico.chevR size={11} aria-hidden />
        <span aria-current="page">{j.label}</span>
      </nav>

      {/* §8.6: a fixed header, then tabs, instead of nine stacked sections. */}
      <header className="ops-jhead">
        <div className="ops-jtitle">
          <h1 className="ops-h1">{j.label}</h1>
          <span className="ops-muted">{j.side === "buy" ? "Buying" : "Selling"}{j.property ? ` · ${j.property}` : ""}{j.price ? ` · ${j.price}` : ""}</span>
        </div>
        <ol className="ops-track" aria-label="Stage">
          {STAGES.map((s, i) => (
            <li key={s} className={i < stageAt ? "is-past" : i === stageAt ? "is-now" : ""} aria-current={i === stageAt ? "step" : undefined}>
              {i < stageAt ? <Ico.check size={9} aria-hidden /> : null}{STAGE_LABEL[s]}
            </li>
          ))}
        </ol>
        <div className="ops-jfacts">
          <span className="ops-jnext"><Ico.arrowR size={11} aria-hidden /><strong>Next:</strong> {j.next}</span>
          {j.closing ? <span className="ops-chip"><Ico.key size={10} aria-hidden />Closing {j.closing.label}, {inDays(j.closing.iso)}</span> : null}
          <span className="ops-chip"><Ico.users size={10} aria-hidden />{j.household.map((h) => h.name.split(" ")[0]).join(", ")}</span>
          {flags.length ? <span className="ops-chip ops-chip-warn"><Ico.alert size={10} aria-hidden />{flags.length} blocked or unconfirmed</span> : null}
        </div>
      </header>
      <div className="ops-tabs" role="tablist" aria-label={j.label}>
        {tabs.map((t, i) => (
          <button key={t.t} ref={(el) => { tabRefs.current[i] = el; }} role="tab" id={`tab-${t.t}`} aria-controls="tabpanel"
            aria-selected={active === t.t} tabIndex={active === t.t ? 0 : -1}
            onClick={() => setTab(t.t)} onKeyDown={(e) => onTabKey(e, i)}>
            {t.label}{count[t.t] ? <span className="ops-seg-n">{count[t.t]}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${active}`}>
        {active === "overview" ? (
          <div className="ops-grid2">
            <section className="ops-card"><h2 className="ops-h2">Next actions</h2>
              <ul className="ops-list">
                {TODAY.filter((t) => t.journeyId === j.id && t.group !== "upcoming").map((t) => (
                  <li key={t.id} className="ops-list-row">
                    <span className="ops-grow"><strong>{t.title}</strong><span className="ops-muted"> · {t.due} · {t.owner}</span></span>
                    {marks[t.id] ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />{marks[t.id]}</span>
                      : <button className="ops-btn ops-btn-sm" onClick={() => setMarks((m) => ({ ...m, [t.id]: "Done" }))}>Done</button>}
                  </li>
                ))}
                {!TODAY.some((t) => t.journeyId === j.id && t.group !== "upcoming") ? <li className="ops-muted">Nothing due. {j.next}.</li> : null}
              </ul>
            </section>
            <section className="ops-card"><h2 className="ops-h2">Blocked or unconfirmed</h2>
              {flags.length ? (
                <ul className="ops-list">
                  {flags.map((w) => {
                    const Icon = Ico[STATE_ICON[w.state]];
                    return (
                      <li key={w.stream}>
                        <span className={STATE_TONE[w.state]}><Icon size={11} aria-hidden /> {STATE_WORD[w.state]}</span>
                        <strong>{WORKSTREAM_LABEL[w.stream]}</strong>
                        <span className="ops-muted">· {w.note ?? ""}{w.stale ? " · no word for 7 days" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="ops-muted">{j.work ? "Nothing. Every open workstream has recent word." : "No contract yet."}</p>}
            </section>
            <section className="ops-card"><h2 className="ops-h2">Key dates</h2>
              <ul className="ops-list">{j.keyDates.map((d) => (
                <li key={d.label}><DateMark s={d.state} /><strong>{d.label}</strong><span className="ops-muted"> · {d.on}{d.state !== "done" ? `, ${inDays(d.iso)}` : ""}</span></li>
              ))}</ul>
            </section>
            {j.team ? (
              <section className="ops-card"><h2 className="ops-h2">The deal team</h2>
                <dl className="ops-dl ops-dl-wide">{j.team.map((t) => <div key={t.role} className="ops-dl-row"><dt>{t.role}</dt><dd>{t.name} · <span className="ops-copy">{t.reach}</span></dd></div>)}</dl>
              </section>
            ) : null}
            <section className="ops-card"><h2 className="ops-h2">Household</h2>
              <ul className="ops-list">{j.household.map((h) => (
                <li key={h.name}><strong>{h.name}</strong><span className="ops-muted"> · {h.role}</span>
                  {h.joined ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />Joined</span> : <span className="ops-chip ops-chip-warn"><Ico.clock size={10} aria-hidden />Invited, not joined</span>}</li>
              ))}</ul>
            </section>
            <section className="ops-card"><h2 className="ops-h2">Recent activity</h2>
              <ul className="ops-activity">{j.activity.map((a) => <li key={a.at + a.what}><span className="ops-time ops-time-wide">{a.at}</span><span>{a.what}</span></li>)}</ul>
            </section>
          </div>
        ) : null}

        {active === "search" ? (
          <section className="ops-card">
            {j.briefNote ? (
              <div className="ops-callout">
                <Ico.bell size={13} aria-hidden /><span className="ops-grow">{j.briefNote}</span>
                {marks[`brief-${j.id}`]
                  ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />Approved: the Matrix search updates tonight</span>
                  : (
                    <span className="ops-row">
                      <button className="ops-btn ops-btn-p ops-btn-sm" onClick={() => setMarks((m) => ({ ...m, [`brief-${j.id}`]: "approved", t4: "Approved: the Matrix search updates tonight" }))}>Approve the change</button>
                      <button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen this drafts a message to Selam and Yonas asking them to agree first.")}>Ask them to agree first</button>
                    </span>
                  )}
              </div>
            ) : null}
            <div className="ops-table-wrap ops-flat">
              <table className="ops-table">
                <thead><tr><th>Criterion</th><th>Value</th><th>Strength</th><th>Who said it</th></tr></thead>
                <tbody>{(j.brief ?? []).map((b) => (
                  <tr key={b.field} className="ops-static">
                    <td className="ops-strong">{b.field}</td><td>{b.value}</td>
                    <td>{b.strength === "Not decided" ? <span className="c-warn"><Ico.alert size={10} aria-hidden /> Not decided</span> : b.strength}</td>
                    <td className="ops-muted">{b.by}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {j.matrix ? <p className="ops-muted ops-note"><Ico.layers size={11} aria-hidden /> Matrix: {j.matrix}</p> : null}
          </section>
        ) : null}

        {active === "homes" ? (
          <section className="ops-card">
            <div className="ops-table-wrap ops-flat">
              <table className="ops-table">
                <thead><tr><th>Home</th><th>Price</th><th>Reactions</th><th>Showing</th></tr></thead>
                <tbody>{(j.homes ?? []).map((h) => {
                  const says = new Set(h.reactions.map((r) => r.says.split(":")[0]));
                  const split = h.reactions.length > 1 && says.size > 1;
                  return (
                    <tr key={h.address} className="ops-static">
                      <td className="ops-strong">{h.address}</td><td>{h.price}</td>
                      <td>
                        {h.reactions.map((r) => <span key={r.who} className="ops-react">{r.who}: {r.says}</span>)}
                        {split ? <span className="ops-chip ops-chip-warn"><Ico.alert size={10} aria-hidden />They disagree</span> : null}
                      </td>
                      <td className="ops-muted">{h.showing ?? "Not booked"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {!j.homes?.length ? <p className="ops-muted">No homes yet.</p> : null}
          </section>
        ) : null}

        {active === "offers" ? (
          <div className="ops-stack">
            <section className="ops-card">
              <h2 className="ops-h2">Offers</h2>
              <OfferTable j={j} />
            </section>
            <section className="ops-card">
              <h2 className="ops-h2">Documents</h2>
              {j.documents?.length ? (
                <ul className="ops-list">{j.documents.map((d) => (
                  <li key={d.name}><Ico.doc size={11} aria-hidden /><strong>{d.name}</strong><span className="ops-muted">· added {d.added} · {d.shared === "Not shared" ? "not shared with anyone yet" : `shared with ${d.shared}`}</span></li>
                ))}</ul>
              ) : <p className="ops-muted">No documents yet.</p>}
            </section>
          </div>
        ) : null}

        {active === "contract" && j.work ? (
          <section className="ops-card">
            <p className="ops-contract-sum">
              <strong>{j.work.filter((w) => w.state === "confirmed").length} of {j.work.filter((w) => w.state !== "not-applicable").length} confirmed</strong>
              {flags.length ? <span className="c-warn"> · <Ico.alert size={11} aria-hidden /> {flags.length} blocked or unconfirmed</span> : null}
              {j.closing ? <span className="ops-muted"> · closing {j.closing.label}, {inDays(j.closing.iso)}</span> : null}
            </p>
            <div className="ops-table-wrap ops-flat">
              <table className="ops-table ops-table-cards">
                <thead><tr><th>Workstream</th><th>State</th><th>Waiting on</th><th>Last word</th><th>Note</th><th>Due</th><th><span className="sr-only">Update</span></th></tr></thead>
                <tbody>{j.work.map((w) => {
                  const Icon = Ico[STATE_ICON[w.state]];
                  return (
                    <tr key={w.stream} className="ops-static">
                      <td className="ops-strong">{WORKSTREAM_LABEL[w.stream]}</td>
                      <td data-label="State" className={`${STATE_TONE[w.state]} ops-nowrap`}><Icon size={11} aria-hidden /> {STATE_WORD[w.state]}</td>
                      <td data-label="Waiting on">{w.who}</td>
                      <td data-label="Last word" className={w.stale ? "c-warn" : "ops-muted"}>{w.stale ? <><Ico.clock size={10} aria-hidden /> </> : null}{w.word ?? "None yet"}{w.stale ? " · 7 days" : ""}</td>
                      <td data-label="Note">{w.note ?? ""}</td>
                      <td data-label="Due" className="ops-nowrap">{w.due ?? ""}</td>
                      <td><button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => setToast("In the real screen: the new state, who said so and on what day. Confirmed needs a named party.")}>Update</button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {active === "history" ? (
          <section className="ops-card">
            <ul className="ops-activity">{[...j.activity, ...p.notes.map((n) => ({ at: n.at, what: `${n.kind}: ${n.body}` }))].map((a) => (
              <li key={a.at + a.what}><span className="ops-time ops-time-wide">{a.at}</span><span>{a.what}</span></li>
            ))}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function OfferTable({ j }: { j: MockJourney }) {
  const offers = j.offers ?? [];
  const selling = j.side === "sell";
  const best = selling ? [...offers].sort((a, b) => Number(b.reaches?.replace(/\D/g, "")) - Number(a.reaches?.replace(/\D/g, "")))[0] : undefined;
  if (!offers.length) return <p className="ops-muted">No offers yet.</p>;
  return (
    <div className="ops-table-wrap ops-flat">
      <table className="ops-table ops-table-cards">
        <thead><tr><th>Offer</th><th>Price</th>{selling ? <th>Reaches the seller</th> : null}<th>Terms</th>{selling ? <><th>Earnest</th><th>Expires</th></> : null}<th>Status</th></tr></thead>
        <tbody>{offers.map((o) => (
          <tr key={o.from} className="ops-static">
            <td className="ops-strong">{o.from}{o.source ? <span className="ops-sub">{o.received} · {o.source}</span> : null}</td>
            <td data-label="Price">{o.price}</td>
            {selling ? (
              <td data-label="Reaches the seller" className="ops-strong">
                {o.reaches}{o === best ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />Leaves the most</span> : null}
              </td>
            ) : null}
            <td data-label="Terms">{o.terms}</td>
            {selling ? <><td data-label="Earnest">{o.earnest}</td><td data-label="Expires" className={o.expires?.startsWith("Today") ? "c-neg ops-strong" : ""}>{o.expires?.startsWith("Today") ? <><Ico.clock size={10} aria-hidden /> </> : null}{o.expires}</td></> : null}
            <td data-label="Status">{o.status}</td>
          </tr>
        ))}</tbody>
      </table>
      {selling ? <p className="ops-muted ops-note">Ranked by what reaches the seller after costs, not the headline price: the lower offer leaves her more.</p> : null}
    </div>
  );
}

function DateMark({ s }: { s: "done" | "soon" | "passed" | "later" }) {
  if (s === "done") return <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />Done</span>;
  if (s === "passed") return <span className="ops-chip ops-chip-neg"><Ico.alert size={10} aria-hidden />Passed</span>;
  if (s === "soon") return <span className="ops-chip ops-chip-warn"><Ico.clock size={10} aria-hidden />Soon</span>;
  return <span className="ops-chip"><Ico.cal size={10} aria-hidden />Later</span>;
}

/* ----------------------------------------------------------- Transactions */

function TransactionsView({ openJourney }: { openJourney: (id: string) => void }) {
  const deals = JOURNEYS.filter((j) => j.work && j.closing).sort((a, b) => a.closing!.iso.localeCompare(b.closing!.iso));
  const blocked = deals.filter((j) => j.work!.some((w) => w.state === "blocked")).length;
  const first = deals[0];
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Transactions</h1>
        <span className="ops-muted">Every contract, sorted by closing. Opens the journey&apos;s Contract tab.</span>
      </header>
      <p className="ops-glance ops-glance-plain">
        <span className="ops-glance-item"><strong>{deals.length}</strong> under contract</span>
        {blocked ? <span className="ops-glance-item is-neg"><Ico.alert size={13} aria-hidden /><strong>{blocked}</strong> blocked</span> : null}
        {first ? <span className="ops-glance-item"><Ico.key size={13} aria-hidden />Next closing: {person(first.personId)!.name}, {first.closing!.label} ({inDays(first.closing!.iso)})</span> : null}
      </p>
      <div className="ops-table-wrap">
        <table className="ops-table ops-tx ops-table-cards">
          <thead>
            <tr>
              <th>Property</th><th>Closing</th><th>Next date</th>
              {WORKSTREAMS.map((s) => <th key={s} className="ops-ws"><abbr title={WORKSTREAM_LABEL[s]}>{WORKSTREAM_SHORT[s]}</abbr></th>)}
              <th className="ops-ws-sum">Workstreams</th><th>Needs a look</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((j) => {
              const p = person(j.personId)!;
              const next = j.keyDates.find((d) => d.state === "soon") ?? j.keyDates.find((d) => d.state === "later");
              const flags = j.work!.filter((w) => ["blocked", "waiting", "reported"].includes(w.state) || w.stale);
              const soon = daysFromNow(j.closing!.iso) <= 7;
              return (
                <tr key={j.id} onClick={() => openJourney(j.id)}>
                  <td>
                    <button className="ops-rowlink ops-strong" data-row onClick={(e) => { e.stopPropagation(); openJourney(j.id); }}>{j.property}</button>
                    <span className="ops-sub">{p.name} · {STAGE_LABEL[j.stage]}</span>
                  </td>
                  <td data-label="Closing" className={soon ? "ops-strong" : ""}>{j.closing!.label}<span className="ops-sub">{inDays(j.closing!.iso)}</span></td>
                  <td data-label="Next date">{next ? <>{next.label}<span className="ops-sub">{next.on}</span></> : ""}</td>
                  {WORKSTREAMS.map((s) => {
                    const w = j.work!.find((x) => x.stream === s)!;
                    const Icon = Ico[STATE_ICON[w.state]];
                    return (
                      <td key={s} className={`ops-ws ${STATE_TONE[w.state]}`} title={`${WORKSTREAM_LABEL[s]}: ${STATE_WORD[w.state]}`}>
                        <Icon size={13} aria-hidden /><span className="sr-only">{WORKSTREAM_LABEL[s]}: {STATE_WORD[w.state]}</span>
                      </td>
                    );
                  })}
                  <td className="ops-ws-sum" data-label="Workstreams">{j.work!.filter((w) => w.state === "confirmed").length} of {j.work!.filter((w) => w.state !== "not-applicable").length} confirmed</td>
                  <td data-label="Needs a look">
                    <span className="ops-flags">
                      {flags.length ? flags.map((w) => (
                        <span key={w.stream} className={STATE_TONE[w.state]}>{WORKSTREAM_LABEL[w.stream]}: {w.stale ? "no word for 7 days" : STATE_WORD[w.state].toLowerCase()}</span>
                      )) : <span className="ops-muted">Nothing</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ops-legend">
        {(["confirmed", "in-progress", "waiting", "reported", "blocked", "not-started", "not-applicable"] as WorkState[]).map((s) => {
          const Icon = Ico[STATE_ICON[s]];
          return <span key={s} className={`ops-key ${STATE_TONE[s]}`}><Icon size={11} aria-hidden /> {STATE_WORD[s]}</span>;
        })}
        <span className="ops-muted ops-desk">Column heads: hover for the full name.</span>
      </p>
    </>
  );
}

/* ------------------------------------------------------- The other pages */

function OffersView({ openJourney }: { openJourney: (id: string) => void }) {
  const listing = JOURNEYS.filter((j) => j.side === "sell" && j.offers?.length);
  const made = JOURNEYS.filter((j) => j.side === "buy" && j.offers?.length);
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Offers</h1><span className="ops-muted">Offers on your listings, and the ones your buyers made.</span></header>
      {listing.map((j) => (
        <section key={j.id} className="ops-card ops-section">
          <div className="ops-section-head">
            <h2 className="ops-h2">{j.property} <span className="ops-muted">· {person(j.personId)!.name} · {j.price}</span></h2>
            <button className="ops-btn ops-btn-sm" onClick={() => openJourney(j.id)}>Open with Grace&apos;s numbers<Ico.arrowR size={11} aria-hidden /></button>
          </div>
          <OfferTable j={j} />
        </section>
      ))}
      <section className="ops-card ops-section">
        <h2 className="ops-h2">Your buyers&apos; offers</h2>
        <div className="ops-table-wrap ops-flat">
          <table className="ops-table ops-table-cards">
            <thead><tr><th>Buyer</th><th>Home</th><th>Price</th><th>Terms</th><th>Status</th></tr></thead>
            <tbody>{made.map((j) => j.offers!.map((o) => (
              <tr key={j.id + o.from} onClick={() => openJourney(j.id)}>
                <td className="ops-strong"><button className="ops-rowlink" data-row onClick={(e) => { e.stopPropagation(); openJourney(j.id); }}>{person(j.personId)!.name}</button></td>
                <td data-label="Home">{j.property}</td><td data-label="Price">{o.price}</td><td data-label="Terms">{o.terms}</td>
                <td data-label="Status" className="c-pos ops-nowrap"><Ico.check size={10} aria-hidden /> {o.status}</td>
              </tr>
            )))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const CAL_FILTERS: { f: string; label: string; kinds: string[] }[] = [
  { f: "all", label: "Everything", kinds: ["call", "showing", "date", "closing", "moment"] },
  { f: "calls", label: "Calls", kinds: ["call"] },
  { f: "showings", label: "Showings", kinds: ["showing"] },
  { f: "dates", label: "Contract dates", kinds: ["date", "closing"] },
];

function CalendarView({ openPerson }: { openPerson: (id: string) => void }) {
  const [f, setF] = useState("all");
  const kinds = CAL_FILTERS.find((x) => x.f === f)!.kinds;
  const items = CALENDAR.filter((c) => kinds.includes(c.kind));
  const days = [...new Set(items.map((c) => c.on))].sort();
  const order = (t: string) => (t === "All day" ? "00:00" : new Date(`2000-01-01 ${t.replace(" am", " AM").replace(" pm", " PM")}`).toTimeString().slice(0, 5));
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Calendar</h1><span className="ops-muted">Calls, showings and contract dates in one list. Cal.com bookings say so.</span></header>
      <div className="ops-toolbar">
        <div className="ops-seg" role="group" aria-label="Show">
          {CAL_FILTERS.map((x) => <button key={x.f} aria-pressed={x.f === f} onClick={() => setF(x.f)}>{x.label}</button>)}
        </div>
      </div>
      <div className="ops-card ops-card-tight">
        {days.map((d) => (
          <div key={d} className="ops-day">
            <h2 className="ops-day-head">{dayLabel(d)} <span className="ops-muted">· {inDays(d)}</span></h2>
            <ul className="ops-cal">
              {items.filter((c) => c.on === d).sort((a, b) => order(a.at).localeCompare(order(b.at))).map((c) => {
                const K = Ico[CAL_KIND[c.kind].icon];
                const who = PEOPLE.find((p) => p.name === c.who);
                return (
                  <li key={c.at + c.what}>
                    <span className="ops-agenda-time">{c.at}</span>
                    <span className="ops-kind-word"><K size={11} aria-hidden />{CAL_KIND[c.kind].word}</span>
                    <span className="ops-grow ops-strong">{c.what}</span>
                    {who ? <button className="ops-link" data-row onClick={() => openPerson(who.id)}>{who.name}</button> : null}
                    <span className={`ops-src ${c.source === "Cal.com" ? "ops-src-cal" : ""}`}>{c.source}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function SearchView({ marks, openJourney }: { marks: Marks; openJourney: (id: string) => void }) {
  const [pending, setPending] = useState(false);
  const rows = JOURNEYS.filter((j) => j.side === "buy").map((j) => {
    const waiting = Boolean(j.briefNote) && !marks[`brief-${j.id}`];
    const status = waiting ? { icon: "bell" as const, word: "Change waiting for you", tone: "c-warn" }
      : j.stage === "tour" || j.stage === "search" ? { icon: "refresh" as const, word: "Running in Matrix", tone: "c-2" }
      : { icon: "checkCircle" as const, word: "Stopped: under contract", tone: "c-4" };
    return { j, waiting, status };
  });
  const n = rows.filter((r) => r.waiting).length;
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Search</h1><span className="ops-muted">Every buyer&apos;s Matrix search, and which ones need you.</span></header>
      <div className="ops-toolbar">
        <div className="ops-seg" role="group" aria-label="Show">
          <button aria-pressed={!pending} onClick={() => setPending(false)}>All <span className="ops-seg-n">{rows.length}</span></button>
          <button aria-pressed={pending} onClick={() => setPending(true)}>Change waiting <span className="ops-seg-n">{n}</span></button>
        </div>
      </div>
      <div className="ops-table-wrap">
        <table className="ops-table ops-table-cards">
          <thead><tr><th>Buyer</th><th>Journey</th><th>Search</th><th>This week</th></tr></thead>
          <tbody>{rows.filter((r) => !pending || r.waiting).map((r) => {
            const Icon = Ico[r.status.icon];
            return (
              <tr key={r.j.id} onClick={() => openJourney(r.j.id)}>
                <td className="ops-strong"><button className="ops-rowlink" data-row onClick={(e) => { e.stopPropagation(); openJourney(r.j.id); }}>{person(r.j.personId)!.name}</button></td>
                <td data-label="Journey">{r.j.label}</td>
                <td data-label="Search" className={r.status.tone}><Icon size={11} aria-hidden /> {r.status.word}</td>
                <td data-label="This week" className="ops-muted">{r.j.matrix ? "4 new matches" : "None"}</td>
              </tr>
            );
          })}
          {pending && !n ? <tr><td colSpan={4} className="ops-muted">No changes waiting. Approved changes go to Matrix tonight.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdvocacyView({ setToast }: { setToast: (t: string) => void }) {
  const tone = { due: ["c-warn", "clock", "Due"], later: ["c-2", "cal", "Later"], quiet: ["c-4", "pause", "Stay quiet"] } as const;
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Advocacy</h1><span className="ops-muted">The moments after a deal that earn the next one. Nothing here sends by itself; the words are yours.</span></header>
      <div className="ops-table-wrap">
        <table className="ops-table ops-table-cards">
          <thead><tr><th>Who</th><th>Moment</th><th>When</th><th>What to do</th><th>State</th><th><span className="sr-only">Act</span></th></tr></thead>
          <tbody>{MOMENTS.map((m) => {
            const [c, icon, word] = tone[m.state];
            const Icon = Ico[icon];
            return (
              <tr key={m.who + m.moment} className="ops-static">
                <td className="ops-strong">{m.who}</td><td data-label="Moment">{m.moment}</td><td data-label="When">{m.when}</td>
                <td data-label="What to do">{m.ask}</td>
                <td data-label="State" className={c}><Icon size={11} aria-hidden /> {word}</td>
                <td>{m.state === "due" ? <button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen you write it here, and it is recorded against the moment.")}>Write to them</button> : null}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="ops-muted ops-note">&ldquo;Under contract&rdquo; is listed so the restraint reads as deliberate: thirty anxious days are not a window to ask for anything.</p>
    </>
  );
}

function ReportsView() {
  const top = REPORT.funnel[0].n;
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Reports</h1><span className="ops-muted">The pilot report, and how people move through the values. {REPORT.period}.</span></header>
      <p className="ops-callout"><Ico.info size={13} aria-hidden /> Made-up figures, to show the layout. The real ones come from first-party events, never a third-party tracker.</p>
      <div className="ops-grid2">
        <section className="ops-card">
          <h2 className="ops-h2">From first value to client</h2>
          <ul className="ops-funnel">
            {REPORT.funnel.map((s) => (
              <li key={s.step}>
                <span className="ops-funnel-label">{s.step}</span>
                <span className="ops-funnel-bar" aria-hidden><span style={{ width: `${Math.max(2, (s.n / top) * 100)}%` }} /></span>
                <span className="ops-funnel-n">{s.n}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ops-card">
          <h2 className="ops-h2">Reply within {REPORT.reply.target}</h2>
          <p className="ops-big">{REPORT.reply.within} <span className="ops-muted">of {REPORT.reply.of} new leads</span></p>
          <p className="ops-muted">The two that were late were both after 9 pm.</p>
        </section>
        <section className="ops-card ops-span2">
          <h2 className="ops-h2">Each value</h2>
          <div className="ops-table-wrap ops-flat">
            <table className="ops-table ops-table-cards">
              <thead><tr><th>Value</th><th>Started</th><th>Saved a plan</th><th>Share saved</th></tr></thead>
              <tbody>{REPORT.values.map((v) => (
                <tr key={v.name} className="ops-static"><td className="ops-strong">{v.name}</td><td data-label="Started" className="ops-num">{v.started}</td><td data-label="Saved" className="ops-num">{v.saved}</td><td data-label="Share" className="ops-num">{Math.round((v.saved / v.started) * 100)}%</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function QuestionsView() {
  const qs = [
    { q: "When would you like to move?", on: "Every buyer value", answered: 214 },
    { q: "Is anyone buying with you?", on: "Cost to buy, budget", answered: 158 },
    { q: "Anything Kaleb should know?", on: "Saved plans", answered: 47 },
  ];
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Questions</h1><span className="ops-muted">Your own questions on the public pages. Kept as it is, at this density.</span></header>
      <div className="ops-table-wrap">
        <table className="ops-table ops-table-cards">
          <thead><tr><th>Question</th><th>Asked on</th><th>Answers</th></tr></thead>
          <tbody>{qs.map((x) => <tr key={x.q} className="ops-static"><td className="ops-strong">{x.q}</td><td data-label="Asked on">{x.on}</td><td data-label="Answers" className="ops-num">{x.answered}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="ops-muted ops-note"><Ico.lock size={11} aria-hidden /> Your questions never change a figure anyone sees (rule 5).</p>
    </>
  );
}

function SettingsView() {
  const groups: { h: string; rows: { k: string; v: string; state?: "ok" | "off" | "warn" }[] }[] = [
    { h: "Leads", rows: [
      { k: "Reply target", v: "15 minutes" },
      { k: "New-lead alert", v: "Text and email to you, instantly", state: "ok" },
    ] },
    { h: "Emails", rows: [
      { k: "Sending domain", v: "Not verified with Brevo: morning summaries are held", state: "warn" },
      { k: "Follow-ups", v: "4 emails over 6 weeks; stop the moment they reply", state: "ok" },
    ] },
    { h: "Contract dates", rows: [
      { k: "Chase an outside party after", v: "7 days with no word" },
      { k: "Morning summary", v: "7:00, with the next 14 days" },
    ] },
    { h: "Privacy", rows: [
      { k: "How long records are kept", v: "The periods the privacy page promises, per kind of record" },
    ] },
    { h: "Connections", rows: [
      { k: "Brevo (email)", v: "Connected, domain not verified", state: "warn" },
      { k: "Cal.com (booked calls)", v: "Not connected: people see your phone number instead", state: "off" },
      { k: "Offer PDF reading", v: "Off: people type the terms in themselves", state: "off" },
    ] },
  ];
  const mark = { ok: ["c-pos", "checkCircle", "On"], off: ["c-4", "minus", "Off"], warn: ["c-warn", "alert", "Needs you"] } as const;
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Settings</h1><span className="ops-muted">Grouped by what they affect. A missing connection says what people see instead.</span></header>
      <div className="ops-grid2">
        {groups.map((g) => (
          <section key={g.h} className="ops-card">
            <h2 className="ops-h2">{g.h}</h2>
            <dl className="ops-settings">
              {g.rows.map((r) => {
                const m = r.state ? mark[r.state] : null;
                const Icon = m ? Ico[m[1]] : null;
                return (
                  <div key={r.k}>
                    <dt>{r.k}</dt>
                    <dd>{m && Icon ? <span className={m[0]}><Icon size={11} aria-hidden /> {m[2]}: </span> : null}{r.v}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}

/* --------------------------------------------------------- Quick switcher */

function Switcher({ close, go }: { close: () => void; go: (v: View, extra?: Record<string, string | undefined>) => void }) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const all = useMemo(() => [
    ...PEOPLE.map((p) => ({ label: p.name, hint: `Person · ${stageOf(p)}`, run: () => go("people", { p: p.id }) })),
    ...JOURNEYS.map((j) => ({ label: `${person(j.personId)!.name}: ${j.label}`, hint: "Journey", run: () => go("journey", { j: j.id }) })),
    ...JOURNEYS.filter((j) => j.property).map((j) => ({ label: j.property!, hint: "Property", run: () => go("journey", { j: j.id, tab: j.work ? "contract" : "overview" }) })),
    ...[...NAV, ...NAV_SMALL].map((n) => ({ label: n.label, hint: "Page", run: () => go(n.v) })),
  ], [go]);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = all.filter((x) => words.every((w) => x.label.toLowerCase().includes(w))).slice(0, 8);
  return (
    <Dialog title="Jump to" close={close}>
      <input className="ops-input ops-switch-input" placeholder="A person, property, journey or page" value={text}
        onChange={(e) => { setText(e.target.value); setI(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
          if (e.key === "Enter" && hits[i]) hits[i].run();
        }}
        role="combobox" aria-expanded="true" aria-controls="switch-list" aria-autocomplete="list"
        aria-activedescendant={hits[i] ? `sw-${i}` : undefined} aria-label="Jump to" />
      <ul id="switch-list" role="listbox" className="ops-switch-list" aria-label="Matches">
        {hits.map((h, k) => (
          <li key={h.hint + h.label} id={`sw-${k}`} role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={h.run}>
            <span>{h.label}</span><span className="ops-muted">{h.hint}</span>
          </li>
        ))}
        {!hits.length ? <li className="ops-muted" role="option" aria-selected={false}>Nothing matches &ldquo;{text}&rdquo;.</li> : null}
      </ul>
      <p className="ops-muted">↑ ↓ to move, Enter to open, Esc to close. <Link href="/prototype/operations" className="ops-link">Start over</Link></p>
    </Dialog>
  );
}
