"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ico, Mark } from "@/components/rift/icons";
import { STAGES, STAGE_LABEL, WORKSTREAMS, WORKSTREAM_LABEL, type Stage, type WorkState } from "@/lib/core/progress";
import {
  ACTIVITY, AUTOMATION, CALENDAR, JOURNEYS, MOMENTS, NOW, PEOPLE, REPORT, SELL_STAGE_LABEL, STAGE_ABOUT,
  STATE_WORD, TODAY, WORKSTREAM_SHORT, daysFromNow, inDays,
  type MockJourney, type MockPerson, type TodayItem,
} from "@/lib/prototype/ops-mock";
import {
  BUY_PLAYBOOK, COORDINATOR, SELL_PLAYBOOK, STEP_WORD, isOpen, stepsFor,
  type Step, type StepMark, type StepState,
} from "@/lib/prototype/ops-playbook";

/**
 * The Operations mock-up (Blueprint v5 §8, decision D15), third version.
 *
 * Kaleb clicks through this before any real Operations screen is rebuilt, and
 * says what to keep or change. Made-up data, nothing saved: ticking a step,
 * approving and changing a setting change this page only.
 *
 * Where you are lives in the address (?v=, ?p=, ?j=, ?tab=, ?f=, ?s=), so the
 * back button and a returned-to list keep their place, filter and sort: one
 * of §8's acceptance checks, and the thing the live pages do not do.
 *
 * The third version answers Kaleb's review of the second: Today and Offers
 * were overwhelming, the journey read like notes where it should be a process
 * that gets executed, Settings did not look like settings, and Questions and
 * Advocacy did not say what they were for. CHANGES below lists each change
 * behind the "What changed" button, so the review can take them one by one.
 */

type View = "today" | "people" | "person" | "journey" | "transactions" | "search" | "offers" | "calendar"
  | "advocacy" | "reports" | "questions" | "settings";
type Tab = "overview" | "search" | "homes" | "offers" | "contract" | "history";
type Marks = Record<string, string>;
type SetMarks = React.Dispatch<React.SetStateAction<Marks>>;
/** Steps ticked, confirmed or approved in this session, by `${journey}:${step}`. */
type StepMarks = Record<string, StepMark>;
type SetStepMarks = React.Dispatch<React.SetStateAction<StepMarks>>;
/** Who a step is given to in Settings: Rift on its own, Rift preparing it for you, you, or the coordinator. */
type Assign = "auto" | "approve" | "you" | "tc";
type Assigns = Record<string, Assign>;

const NAV: { v: View; label: string; icon: keyof typeof Ico; key: string }[] = [
  { v: "today", label: "Today", icon: "home", key: "t" },
  { v: "people", label: "Relationships", icon: "users", key: "r" },
  { v: "search", label: "Search", icon: "search", key: "s" },
  { v: "transactions", label: "Transactions", icon: "doc", key: "x" },
  { v: "offers", label: "Offers", icon: "scale", key: "o" },
  { v: "calendar", label: "Calendar", icon: "cal", key: "c" },
];
/* Kaleb could not tell what "Questions" and "Advocacy" were. The names now
   say what is on the page; §8.3's list is updated to match. */
const NAV_SMALL: { v: View; label: string }[] = [
  { v: "advocacy", label: "Reviews and referrals" },
  { v: "reports", label: "Reports" },
  { v: "questions", label: "Lead-form questions" },
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
const STEP_ICON: Record<StepState, keyof typeof Ico> = {
  todo: "minus", doing: "clock", ready: "bell", waiting: "pause", reported: "info", blocked: "alert", done: "checkCircle", skip: "x",
};
const STEP_TONE: Record<StepState, string> = {
  todo: "c-4", doing: "c-2", ready: "c-warn", waiting: "c-warn", reported: "c-warn", blocked: "c-neg", done: "c-pos", skip: "c-4",
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
  moment: { icon: "gift", word: "Review or referral" },
};
const CAL_KIND: Record<(typeof CALENDAR)[number]["kind"], { icon: keyof typeof Ico; word: string }> = {
  call: { icon: "clock", word: "Call" },
  showing: { icon: "home", word: "Showing" },
  date: { icon: "cal", word: "Date" },
  closing: { icon: "key", word: "Closing" },
  moment: { icon: "gift", word: "Moment" },
};

/** The coordinator in the made-up business, so delegation has somebody to wait for. */
const DELEGATE = `${COORDINATOR} (transaction coordinator)`;

const without = <T,>(o: Record<string, T>, key: string) => {
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
const firstNames = (j: MockJourney) => j.household.map((h) => h.name.split(" ")[0]).join(" and ");

/** A step as Settings has assigned it. Protected steps, and the client's and outside professionals', cannot be reassigned. */
function assigned(s: Step, a?: Assign): Step {
  if (!a || s.protected || s.doer === "client" || s.doer === "pro") return s;
  if (a === "auto" && s.external) return s;
  if (a === "auto" || a === "approve") return { ...s, doer: "rift", mode: a };
  return { ...s, doer: a, mode: undefined };
}
const assignOf = (s: Step): Assign | null =>
  s.doer === "rift" ? (s.mode ?? "approve") : s.doer === "you" ? "you" : s.doer === "tc" ? "tc" : null;

/** A journey's checklist with this session's ticks and Settings' assignments applied. */
function checklist(j: MockJourney, stepMarks: StepMarks, assigns: Assigns) {
  return stepsFor(j).map(({ step, mark }) => {
    const key = `${j.id}:${step.id}`;
    return { step: assigned(step, assigns[step.id]), mark: stepMarks[key] ?? mark, key, session: Boolean(stepMarks[key]) };
  });
}

/** What the third version changed, shown on the page so Kaleb can check each one. */
const CHANGES: string[] = [
  "The journey is a checklist that gets executed. Each stage lists its steps from the journey contracts, and each step says who does it: Rift on its own, Rift preparing it for you to approve, you, Meron (the coordinator), the client, or an outside professional.",
  "Ticking a step records who and when. A step that someone else has to confirm (the lender, the closing attorney, the listing agent) asks who confirmed it before it counts as done (rule 9). Something Rift prepared waits for your Approve.",
  "Some steps are always yours whatever the settings: sending an agreement, presenting an offer, a price opinion. They carry a lock.",
  "The journey page is shorter: the checklist, then closed sections for the brief, homes, offers, dates and what happened. Contact details, the team and notes sit in the header.",
  "Relationships: Full page now opens the person's journey. Someone with no journey yet still gets a person page.",
  "Today is one list instead of three columns: Needs you (attention and approvals), with the day's schedule and Meron's list beside it. Waiting on others, the next two weeks and what changed are closed until you open them. The line at the top still answers the seven questions.",
  "Offers: one card per offer, leading with what reaches the seller, when it expires, and one action (present it). Your buyers' accepted offers are folded away.",
  "Settings looks like settings: sections down the side, switches and menus, and a save bar. New sections: Team (what Meron can do), Automation (the three modes and each workflow), and Checklists (who does each step, which changes the journeys).",
  "Questions is now Lead-form questions and Advocacy is Reviews and referrals, each with a line saying what it is for.",
];

export function OpsMock() {
  const router = useRouter();
  const q = useSearchParams();
  const view = (q.get("v") as View) || "today";
  const panel = q.get("p") ?? undefined;
  const jid = q.get("j") ?? undefined;
  const tab = q.get("tab") ?? "";
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
  /* What Kaleb did in this session: items done, snoozed, delegated, pinned or
     approved; steps ticked; settings changed. The mock-up shows the
     consequence; nothing is stored. */
  const [marks, setMarks] = useState<Marks>({});
  const [stepMarks, setStepMarks] = useState<StepMarks>({});
  const [assigns, setAssigns] = useState<Assigns>({});

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
    offers: { n: marks["offer-j3-1"] ? 0 : 1 },
    transactions: { n: 1, tone: "neg" },
  };
  const current = view === "journey" || view === "person" ? "people" : view;
  /* Full page is the person's journey: that is where everything about them
     is. Someone with no journey yet gets a page of their own. */
  const openFull = (id: string) => {
    const p = person(id);
    if (p?.journeyIds[0]) open("journey", { j: p.journeyIds[0] });
    else open("person", { p: id });
  };

  return (
    <div className={`ops ${collapsed ? "ops-collapsed" : ""}`}>
      <div className="ops-mockbar" role="note">
        <Ico.info size={13} aria-hidden />
        <span className="ops-grow">Mock-up with made-up data, for Kaleb to click through before Operations is rebuilt (D15). Nothing here is saved.</span>
        <button className="ops-mockbar-btn" onClick={() => setDialog("changes")}>What changed in version 3</button>
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
            <TodayView marks={marks} setMarks={setMarks} setToast={setToast} stepMarks={stepMarks} assigns={assigns}
              openPerson={(id) => open("people", { p: id })}
              openJourney={(id, t) => open("journey", { j: id, tab: t })}
              openDraft={(id) => setDialog({ draft: id })}
              openView={(v, extra) => open(v, extra)} />
          ) : null}
          {view === "people" ? (
            <PeopleView filter={filter} sort={sort} panel={panel}
              setFilter={(f) => go({ f }, true)} setSort={(s) => go({ s }, true)}
              openPanel={(id) => go({ p: id }, true)}
              openFull={openFull}
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
              stepMarks={stepMarks} setStepMarks={setStepMarks} assigns={assigns}
              back={() => open("people")} openPerson={(id) => open("people", { p: id })} />
          ) : null}
          {view === "transactions" ? <TransactionsView openJourney={(id) => open("journey", { j: id, tab: journey(id)!.stage })} /> : null}
          {view === "offers" ? <OffersView marks={marks} setMarks={setMarks} openJourney={(id) => open("journey", { j: id, tab: "offer" })} /> : null}
          {view === "calendar" ? <CalendarView openPerson={(id) => open("people", { p: id })} /> : null}
          {view === "search" ? <SearchView marks={marks} openJourney={(id) => open("journey", { j: id, tab: "search" })} /> : null}
          {view === "advocacy" ? <AdvocacyView setToast={setToast} /> : null}
          {view === "reports" ? <ReportsView /> : null}
          {view === "questions" ? <QuestionsView setToast={setToast} /> : null}
          {view === "settings" ? (
            <SettingsView section={tab || "profile"} setSection={(t) => go({ tab: t }, true)} assigns={assigns} setAssigns={setAssigns} setToast={setToast} />
          ) : null}
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
        <Dialog title="What changed in version 3" close={() => setDialog(null)} wide>
          <p className="ops-muted">From Kaleb&apos;s review of version 2. Say which of these to keep.</p>
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

/** A section that opens and closes, for detail that should not crowd the page. */
function Fold({ id, title, count, open, setOpen, children, note }: {
  id: string; title: ReactNode; count?: number; open: boolean; setOpen: (o: boolean) => void; children: ReactNode; note?: ReactNode;
}) {
  return (
    <section className={`ops-fold ${open ? "is-open" : ""}`} aria-labelledby={`${id}-h`}>
      <h2 className="ops-fold-h" id={`${id}-h`}>
        <button className="ops-fold-btn" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
          <Ico.chevR size={12} aria-hidden className="ops-fold-chev" />
          <span className="ops-grow">{title}{count !== undefined ? <span className="ops-muted"> {count}</span> : null}</span>
          {note ? <span className="ops-fold-note">{note}</span> : null}
        </button>
      </h2>
      {open ? <div className="ops-fold-body" id={`${id}-body`}>{children}</div> : null}
    </section>
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

/* Version 2 put five groups in three columns and Kaleb found it
   overwhelming. Now there is one list of what needs him, the day's schedule
   and the coordinator's list beside it, and everything that is only worth
   knowing (waiting, coming up, what changed) closed until he opens it. The
   first line still answers §8.2's seven questions, and each number opens its
   section. */
function TodayView({ marks, setMarks, setToast, stepMarks, assigns, openPerson, openJourney, openDraft, openView }: {
  marks: Marks; setMarks: SetMarks; setToast: (t: string) => void;
  stepMarks: StepMarks; assigns: Assigns;
  openPerson: (id: string) => void;
  openJourney: (id: string, tab?: Tab | string) => void;
  openDraft: (id: string) => void;
  openView: (v: View, extra?: Record<string, string | undefined>) => void;
}) {
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const lead = PEOPLE.find((p) => p.stage === "New lead")!;
  const live = (g: TodayItem["group"]) => TODAY.filter((t) => t.group === g && !marks[t.id]);
  const needs = TODAY.filter((t) => t.group === "attention" || t.group === "approval");
  const nNeeds = needs.filter((t) => !marks[t.id]).length + (marks.lead ? 0 : 1);
  const nApprove = live("approval").length;
  const openItem = (t: TodayItem) => (t.journeyId ? openJourney(t.journeyId, t.tab) : t.personId ? openPerson(t.personId) : undefined);
  const act = (t: TodayItem) => {
    if (t.kind === "search") return setMarks((x) => ({ ...x, [t.id]: "Approved: the Matrix search updates tonight", "brief-j2": "approved" }));
    if (t.kind === "draft") return openDraft(t.id);
    if (t.kind === "failed") return openView("settings", { tab: "connections" });
    if (t.kind === "program") return setToast("In the real screen this opens the official page beside the change, with Approve and Reject.");
    if (t.kind === "moment") return openView("advocacy");
    return openItem(t);
  };
  const jump = (id: string) => {
    setFolds((f) => ({ ...f, [id]: true }));
    requestAnimationFrame(() => {
      const h = document.getElementById(`${id}-h`);
      h?.scrollIntoView({ block: "start", behavior: "smooth" });
      h?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    });
  };

  /* The coordinator's open steps across every journey, where the client has
     reached that stage: what Meron is doing, so the agent does not. */
  const coordinator = JOURNEYS.flatMap((j) => checklist(j, stepMarks, assigns)
    .filter((r) => r.step.doer === "tc" && isOpen(r.mark.state) && STAGES.indexOf(r.step.stage) <= STAGES.indexOf(j.stage))
    .map((r) => ({ ...r, j })));
  const agenda = TODAY.filter((t) => t.group === "today");
  const waiting = live("waiting");
  const upcoming = live("upcoming");

  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Today</h1>
        <span className="ops-muted">Friday 25 September, {NOW.time}</span>
      </header>

      {/* §8.2's seven questions, answered in one sentence. */}
      <p className="ops-brief">
        <button className="ops-brief-n is-neg" onClick={() => jump("f-needs")}><strong>{nNeeds - nApprove}</strong> need attention</button>,{" "}
        <button className="ops-brief-n" onClick={() => jump("f-needs")}><strong>{nApprove}</strong> to approve</button>,{" "}
        <button className="ops-brief-n" onClick={() => jump("f-day")}><strong>{agenda.length}</strong> on your calendar</button>,{" "}
        <button className="ops-brief-n" onClick={() => jump("f-waiting")}><strong>{waiting.length}</strong> waiting on others</button>,{" "}
        <button className="ops-brief-n" onClick={() => jump("f-upcoming")}><strong>{upcoming.length}</strong> in the next two weeks</button>.{" "}
        <button className={`ops-brief-n ${AUTOMATION.failed ? "is-neg" : ""}`} onClick={() => jump("f-changed")}>
          Rift overnight: {AUTOMATION.failed ? <><strong>{AUTOMATION.failed}</strong> job failing</> : "nothing failing"}
        </button>
        , <button className="ops-brief-n" onClick={() => jump("f-changed")}><strong>{ACTIVITY.length}</strong> changes</button>.
      </p>

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
            <button className="ops-btn" onClick={() => setMarks((m) => ({ ...m, lead: "called, logged at 9:33" }))}>Log the call</button>
            <button className="ops-btn ops-btn-quiet" onClick={() => openPerson(lead.id)}>Open</button>
          </span>
        </div>
      )}

      <div className="ops-today2">
        <div className="ops-stack">
          <section className="ops-card ops-card-list" aria-labelledby="f-needs-h">
            <h2 className="ops-h2" id="f-needs-h" tabIndex={-1}><Ico.alert size={12} aria-hidden /> Needs you <span className="ops-muted">{nNeeds - (marks.lead ? 0 : 1)}</span></h2>
            <ul className="ops-todos">
              {needs.map((t) => (
                <Todo key={t.id} t={t} mark={marks[t.id]} urgent={t.group === "attention"}
                  onMark={(m) => setMarks((x) => ({ ...x, [t.id]: m }))}
                  onUndo={() => setMarks((x) => without(x, t.id))}
                  onOpen={() => openItem(t)} onAct={() => act(t)}
                  actLabel={t.kind === "search" ? "Approve" : t.next} />
              ))}
            </ul>
            {!needs.some((t) => !marks[t.id]) ? <p className="ops-empty"><Ico.checkCircle size={13} aria-hidden /> Nothing left that needs you.</p> : null}
          </section>

          <Fold id="f-waiting" title={<><Ico.pause size={12} aria-hidden /> Waiting on others</>} count={waiting.length}
            note={waiting.length ? `next chase ${waiting[0].checkIn}` : undefined}
            open={Boolean(folds["f-waiting"])} setOpen={(o) => setFolds((f) => ({ ...f, "f-waiting": o }))}>
            <ul className="ops-todos">
              {TODAY.filter((t) => t.group === "waiting").map((t) => marks[t.id] ? (
                <DoneRow key={t.id} t={t} mark={marks[t.id]} undo={() => setMarks((x) => without(x, t.id))} />
              ) : (
                <li key={t.id} className="ops-todo" data-item={t.id}>
                  <span className="ops-todo-icon" aria-hidden><Ico.pause size={12} /></span>
                  <div className="ops-todo-body">
                    <button className="ops-item-title" data-row onClick={() => openItem(t)}>{t.title}</button>
                    <span className="ops-todo-why">With <strong>{t.owner}</strong> · last heard {t.lastHeard} · chase {t.checkIn}</span>
                  </div>
                  <span className="ops-todo-actions">
                    <button className="ops-btn ops-btn-sm" onClick={() => setMarks((x) => ({ ...x, [t.id]: `Chased at ${NOW.time}; the next check-in moves to Tuesday` }))}>Chase now</button>
                    <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => setMarks((x) => ({ ...x, [t.id]: "Arrived" }))}><Ico.check size={11} aria-hidden />Arrived</button>
                  </span>
                </li>
              ))}
            </ul>
          </Fold>

          <Fold id="f-upcoming" title={<><Ico.cal size={12} aria-hidden /> Next two weeks</>} count={upcoming.length}
            note={upcoming.length ? `${upcoming[0].title}, ${upcoming[0].due}` : undefined}
            open={Boolean(folds["f-upcoming"])} setOpen={(o) => setFolds((f) => ({ ...f, "f-upcoming": o }))}>
            {[...new Set(upcoming.map((t) => t.on))].map((d) => (
              <div key={d} className="ops-day">
                <h3 className="ops-day-head">{dayLabel(d)} <span className="ops-muted">· {inDays(d)}</span></h3>
                <ul className="ops-day-list">
                  {upcoming.filter((t) => t.on === d).map((t) => {
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
          </Fold>

          <Fold id="f-changed" title={<><Ico.refresh size={12} aria-hidden /> What changed since yesterday</>} count={ACTIVITY.length}
            note={AUTOMATION.failed ? <span className="c-neg"><Ico.alert size={11} aria-hidden /> {AUTOMATION.failed} job failing</span> : undefined}
            open={Boolean(folds["f-changed"])} setOpen={(o) => setFolds((f) => ({ ...f, "f-changed": o }))}>
            <p className="ops-rift-line">
              <Ico.bolt size={12} aria-hidden /> Rift on its own: {AUTOMATION.sent} emails sent, {AUTOMATION.stopped} stopped by a reply, {AUTOMATION.checked} program pages checked,{" "}
              {AUTOMATION.failed ? <strong className="c-neg">{AUTOMATION.failed} job failing</strong> : "nothing failing"}.
            </p>
            <ul className="ops-activity">
              {ACTIVITY.map((a) => (
                <li key={a.at + a.what}><span className="ops-time">{a.at}</span><span className={`ops-by ops-by-${a.by.toLowerCase()}`}>{a.by}</span><span>{a.what}</span></li>
              ))}
            </ul>
          </Fold>
        </div>

        <aside className="ops-stack" aria-label="Your day">
          <section className="ops-card ops-card-list" aria-labelledby="f-day-h">
            <h2 className="ops-h2" id="f-day-h" tabIndex={-1}><Ico.clock size={12} aria-hidden /> Your day</h2>
            <ul className="ops-agenda2">
              {agenda.map((t) => {
                const K = Ico[KIND[t.kind].icon];
                return (
                  <li key={t.id} className={marks[t.id] ? "is-done" : ""}>
                    <span className="ops-agenda-time">{t.due}</span>
                    <button className="ops-item-title" data-row onClick={() => openItem(t)}><K size={12} aria-hidden /> {t.title}</button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="ops-card ops-card-list" aria-labelledby="f-tc-h">
            <h2 className="ops-h2" id="f-tc-h"><Ico.layers size={12} aria-hidden /> {COORDINATOR}&apos;s list <span className="ops-muted">{coordinator.length}</span></h2>
            <p className="ops-muted ops-small">Steps your coordinator does and ticks off. You only hear about them if they stall.</p>
            <ul className="ops-agenda2">
              {coordinator.map((r) => (
                <li key={r.key}>
                  <span className={`ops-agenda-time ${STEP_TONE[r.mark.state]}`}>{STEP_WORD[r.mark.state]}</span>
                  <button className="ops-item-title" data-row onClick={() => openJourney(r.j.id, r.step.stage)}>
                    {r.step.title}<span className="ops-sub">{person(r.j.personId)!.name}{r.mark.due ? ` · ${r.mark.due}` : ""}</span>
                  </button>
                </li>
              ))}
              {!coordinator.length ? <li className="ops-muted">Nothing open.</li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </>
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
    <li className="ops-todo ops-todo-done" data-item={t.id}>
      <span className="ops-todo-icon c-pos" aria-hidden><Ico.checkCircle size={13} /></span>
      <span className="ops-todo-body"><span className="ops-muted">{t.title}:</span> {mark}</span>
      <button className="ops-link" data-row onClick={undo}>Undo</button>
    </li>
  );
}

/** One line of Today: tick it off, open it, or do the one thing it asks. */
function Todo({ t, mark, urgent, onMark, onUndo, onOpen, onAct, actLabel }: {
  t: TodayItem; mark?: string; urgent?: boolean;
  onMark: (m: string) => void; onUndo: () => void; onOpen: () => void; onAct: () => void; actLabel: string;
}) {
  const [more, setMore] = useState(false);
  const p = person(t.personId);
  const K = Ico[KIND[t.kind].icon];
  if (mark) return <DoneRow t={t} mark={mark} undo={onUndo} />;
  return (
    <li className={`ops-todo ${urgent ? "ops-todo-urgent" : ""}`} data-item={t.id}>
      <button className="ops-tick" aria-label={`Mark done: ${t.title}`} title="Mark done" onClick={() => onMark("Done")}><Ico.check size={11} aria-hidden /></button>
      <div className="ops-todo-body">
        <span className="ops-todo-line">
          <span className="ops-kind" title={KIND[t.kind].word}><K size={12} aria-hidden /></span>
          <button className="ops-item-title" data-row onClick={onOpen}><span className="sr-only">{KIND[t.kind].word}: </span>{t.title}</button>
        </span>
        <span className="ops-todo-why" title={t.why}>
          {t.group === "approval" ? <span className="ops-tag">To approve</span> : null}
          {p ? <>{p.name} · </> : null}{t.why}
        </span>
      </div>
      <span className={`ops-due ${urgent ? "ops-due-now" : ""}`}>{t.due}</span>
      <span className="ops-todo-actions">
        <button className={`ops-btn ops-btn-sm ${urgent ? "ops-btn-strong" : ""}`} onClick={onAct}>{actLabel}</button>
        <button className="ops-icon-btn ops-icon-quiet" aria-expanded={more} aria-label={`More: snooze, delegate or pin ${t.title}`} title="Snooze, delegate or pin" onClick={() => setMore((m) => !m)}><Ico.more size={15} /></button>
      </span>
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
          <button className="ops-link" onClick={() => onMark(`Offered to ${DELEGATE}; yours until they accept`)}>Give to {COORDINATOR}</button>
          <button className="ops-link" onClick={() => onMark("Pinned to the top until Fri 2 Oct: “watch this one”")}>Pin with a reason</button>
        </div>
      ) : null}
    </li>
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
                <button className="ops-btn ops-btn-sm ops-btn-p" onClick={() => openFull(open.id)}>
                  {open.journeyIds.length ? "Open the journey" : "Full page"}<Ico.arrowUpR size={11} aria-hidden />
                </button>
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
  return (
    <div className={wide ? "ops-person ops-person-wide" : "ops-person"}>
      <div>
        <p className="ops-summary"><span className="ops-summary-label">What they did</span>{p.summary}</p>
        <ContactList p={p} />
        <div className="ops-row">
          {!js.length ? <button className="ops-btn ops-btn-p" onClick={() => setToast("In the real screen this starts a journey from their saved plan and invites the household.")}>Start a journey</button> : null}
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
                  <span className="ops-stage">{stageLabel(j, j.stage)}</span>
                  {j.closing ? <span className="ops-muted">closing {j.closing.label}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3 className="ops-h3">History</h3>
        <Notes p={p} />
      </div>
    </div>
  );
}

function ContactList({ p }: { p: MockPerson }) {
  const AgreementIcon = Ico[p.agreement.state === "signed" ? "checkCircle" : "alert"];
  return (
    <dl className="ops-dl">
      <dt>Next</dt><dd><strong>{p.next}</strong> · <span className={p.overdue ? "c-neg" : ""}>{p.overdue ? "overdue, " : ""}{p.due}</span></dd>
      <dt>Phone</dt><dd>{p.phone ? <span className="ops-copy">{p.phone}</span> : <span className="ops-muted">None given</span>}</dd>
      <dt>Email</dt><dd><span className="ops-copy">{p.email}</span></dd>
      <dt>Source</dt><dd>{p.source}</dd>
      <dt>Plan</dt><dd>{p.plan ?? <span className="ops-muted">No saved plan</span>}</dd>
      <dt>Agreement</dt><dd className={p.agreement.state === "signed" ? "c-pos" : "c-warn"}><AgreementIcon size={11} aria-hidden /> {p.agreement.text}</dd>
    </dl>
  );
}

function Notes({ p }: { p: MockPerson }) {
  if (!p.notes.length) return <p className="ops-muted">Nothing yet.</p>;
  return (
    <ul className="ops-activity">
      {p.notes.map((n) => <li key={n.at + n.body}><span className="ops-time ops-time-wide">{n.at}</span><span className="ops-by">{n.kind}</span><span>{n.body}</span></li>)}
    </ul>
  );
}

/* ------------------------------------------------------------ The journey */

/* The stage track is the journey page's navigation, and each stage opens its
   checklist: the steps from the journey contracts, who does each, and where
   it stands (ops-playbook.ts). Version 2 opened each stage onto cards of
   notes, and Kaleb's answer was that the process is not a note, it is a
   system that gets executed. Old ?tab= values (from Today, Offers,
   Transactions) still land on the stage that holds that thing. */
const TAB_STAGE: Partial<Record<Tab, Stage>> = { search: "search", homes: "tour", offers: "offer" };

function stageLabel(j: MockJourney, s: Stage) {
  return j.side === "sell" ? SELL_STAGE_LABEL[s] : STAGE_LABEL[s];
}

type Row = ReturnType<typeof checklist>[number];

function JourneyView({ j, tab, setTab, marks, setMarks, setToast, stepMarks, setStepMarks, assigns, back, openPerson }: {
  j: MockJourney; tab: string; setTab: (t: string) => void;
  marks: Marks; setMarks: SetMarks; setToast: (t: string) => void;
  stepMarks: StepMarks; setStepMarks: SetStepMarks; assigns: Assigns;
  back: () => void; openPerson: (id: string) => void;
}) {
  const p = person(j.personId)!;
  const now = STAGES.indexOf(j.stage);
  const picked: Stage = (STAGES as string[]).includes(tab) ? (tab as Stage) : TAB_STAGE[tab as Tab] ?? j.stage;
  const rows = checklist(j, stepMarks, assigns);
  const [contact, setContact] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = Math.max(0, Math.min(STAGES.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
    setTab(STAGES[n]);
    refs.current[n]?.focus();
  };
  return (
    <>
      <nav className="ops-crumbs" aria-label="Breadcrumb">
        <button className="ops-link" onClick={back}>Relationships</button><Ico.chevR size={11} aria-hidden />
        <button className="ops-link" onClick={() => openPerson(p.id)}>{p.name}</button><Ico.chevR size={11} aria-hidden />
        <span aria-current="page">{j.label}</span>
      </nav>

      <header className="ops-jhead">
        <div className="ops-jtitle">
          <h1 className="ops-h1">{j.label}</h1>
          <span className="ops-muted">
            {j.side === "buy" ? "Buying" : "Selling"}{j.property ? ` · ${j.property}` : ""}{j.price ? ` · ${j.price}` : ""}
          </span>
          {j.closing ? <span className="ops-chip"><Ico.key size={10} aria-hidden />Closing {j.closing.label}, {inDays(j.closing.iso)}</span> : null}
        </div>
        <div className="ops-jfacts">
          <span className="ops-muted">{j.household.map((h) => h.name).join(" and ")}</span>
          {p.phone ? <span className="ops-copy">{p.phone}</span> : null}
          <span className={p.agreement.state === "signed" ? "c-pos" : "c-warn"}>
            {p.agreement.state === "signed" ? <Ico.checkCircle size={11} aria-hidden /> : <Ico.alert size={11} aria-hidden />} {p.agreement.text}
          </span>
          <button className="ops-link" aria-expanded={contact} aria-controls="j-contact" onClick={() => setContact((c) => !c)}>
            {contact ? "Hide" : "Contact, team and notes"}
          </button>
        </div>
        {contact ? (
          <div id="j-contact" className="ops-card ops-contact">
            <div><h3 className="ops-h3 ops-h3-first">Contact</h3><ContactList p={p} /></div>
            <div>
              <h3 className="ops-h3 ops-h3-first">Who else is on it</h3>
              {j.team ? (
                <dl className="ops-dl ops-dl-wide">{j.team.map((t) => <div key={t.role} className="ops-dl-row"><dt>{t.role}</dt><dd>{t.name} · <span className="ops-copy">{t.reach}</span></dd></div>)}</dl>
              ) : <p className="ops-muted">Nobody outside the household yet.</p>}
              <div className="ops-dl-row"><dt className="ops-muted">Household</dt><dd>{j.household.map((h) => `${h.name} (${h.role.toLowerCase()})`).join(", ")}</dd></div>
            </div>
            <div><h3 className="ops-h3 ops-h3-first">Notes</h3><Notes p={p} /></div>
          </div>
        ) : null}
      </header>

      <div className="ops-trackbar">
        <div className="ops-track" role="tablist" aria-label="The journey, stage by stage">
          {STAGES.map((s, i) => {
            const state = i < now ? "done" : i === now ? "now" : "next";
            const inStage = rows.filter((r) => r.step.stage === s);
            const open = inStage.filter((r) => isOpen(r.mark.state)).length;
            const sub = state === "next" ? `${inStage.length} steps` : state === "now" ? `Now · ${open} open` : open ? `${open} open` : "Done";
            return (
              <button key={s} ref={(el) => { refs.current[i] = el; }} role="tab" id={`stage-${s}`} aria-controls="stagepanel"
                aria-selected={picked === s} tabIndex={picked === s ? 0 : -1}
                className={`is-${state}`} onClick={() => setTab(s)} onKeyDown={(e) => onKey(e, i)}>
                <span className="ops-track-name">{state === "done" ? <Ico.check size={10} aria-hidden /> : null}{stageLabel(j, s)}</span>
                <span className="ops-track-sub">{sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id="stagepanel" aria-labelledby={`stage-${picked}`}>
        <StageChecklist key={picked} j={j} s={picked} now={now} rows={rows} marks={marks} setMarks={setMarks}
          setStepMarks={setStepMarks} setToast={setToast} />
      </div>
    </>
  );
}

type Who = "all" | "you" | "tc" | "rift" | "others";
const WHO: { w: Who; label: string }[] = [
  { w: "all", label: "Everything" }, { w: "you", label: "You" }, { w: "tc", label: COORDINATOR },
  { w: "rift", label: "Rift" }, { w: "others", label: "Client and pros" },
];
const whoOf = (s: Step): Who => (s.doer === "you" ? "you" : s.doer === "tc" ? "tc" : s.doer === "rift" ? "rift" : "others");

function StageChecklist({ j, s, now, rows, marks, setMarks, setStepMarks, setToast }: {
  j: MockJourney; s: Stage; now: number; rows: Row[];
  marks: Marks; setMarks: SetMarks; setStepMarks: SetStepMarks; setToast: (t: string) => void;
}) {
  const at = STAGES.indexOf(s);
  const state = at < now ? "done" : at === now ? "now" : "next";
  const list = rows.filter((r) => r.step.stage === s);
  const [who, setWho] = useState<Who>("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const pendingBrief = s === "search" && Boolean(j.briefNote) && !marks[`brief-${j.id}`];
  const [folds, setFolds] = useState<Record<string, boolean>>({
    detail: pendingBrief || (s === "offer" && j.side === "sell" && state === "now"),
  });
  const fold = (k: string) => ({ open: Boolean(folds[k]), setOpen: (o: boolean) => setFolds((f) => ({ ...f, [k]: o })) });
  const shown = list.filter((r) => who === "all" || whoOf(r.step) === who);
  const done = list.filter((r) => !isOpen(r.mark.state)).length;
  const blocked = list.filter((r) => r.mark.state === "blocked").length;
  const items = j.story.filter((x) => x.stage === s);
  const record = (key: string, mark: StepMark) => { setStepMarks((m) => ({ ...m, [key]: mark })); setConfirming(null); };
  const undo = (key: string) => setStepMarks((m) => without(m, key));

  /* What each stage holds beyond its checklist, if this journey has it. */
  const detail =
    s === "search" && j.brief ? { title: "Search brief and Matrix", n: j.brief.length, body: <SearchDetail j={j} marks={marks} setMarks={setMarks} setToast={setToast} /> }
    : s === "tour" && j.homes?.length && j.side === "buy" && at <= now ? { title: "Homes and reactions", n: j.homes.length, body: <HomesDetail j={j} /> }
    : s === "offer" && j.offers?.length ? { title: j.side === "sell" ? "The offers, side by side" : "Offers", n: j.offers.length, body: <OffersDetail j={j} marks={marks} setMarks={setMarks} /> }
    : (s === "under-contract" || s === "close") && at <= now && j.keyDates.length ? { title: "Contract dates", n: j.keyDates.length, body: <DatesDetail j={j} /> }
    : null;

  return (
    <div className="ops-stage-panel">
      <section className="ops-card ops-card-list" aria-labelledby="checklist-h">
        <div className="ops-check-head">
          <h2 className="ops-h2" id="checklist-h">
            {stageLabel(j, s)}
            <span className={`ops-check-count ${state === "done" && !blocked ? "c-pos" : ""}`}>
              {done} of {list.length} done{blocked ? <span className="c-neg"> · <Ico.alert size={11} aria-hidden /> {blocked} blocked</span> : null}
            </span>
          </h2>
          <div className="ops-seg ops-seg-sm" role="group" aria-label="Show steps done by">
            {WHO.map((x) => {
              const n = x.w === "all" ? list.length : list.filter((r) => whoOf(r.step) === x.w).length;
              return <button key={x.w} aria-pressed={who === x.w} onClick={() => setWho(x.w)} disabled={!n}>{x.label} <span className="ops-seg-n">{n}</span></button>;
            })}
          </div>
        </div>
        <p className="ops-muted ops-small ops-check-about">
          {state === "next" ? <>Not reached yet. {STAGE_ABOUT[s][j.side]} These steps start when {firstNames(j)} get{j.household.length > 1 ? "" : "s"} here.</>
            : state === "done" ? <>Done. {STAGE_ABOUT[s][j.side]}</>
            : STAGE_ABOUT[s][j.side]}
        </p>
        <ol className="ops-checklist">
          {shown.map((r) => (
            <StepRow key={r.key} j={j} r={r} reached={at <= now} record={record} undo={undo} setToast={setToast}
              confirming={confirming === r.key} setConfirming={(o) => setConfirming(o ? r.key : null)} />
          ))}
        </ol>
        <button className="ops-link ops-add-step" onClick={() => setToast("In the real screen: a step of your own, who does it and when, for this client only or for everyone's checklist (Settings, Checklists).")}>
          <Ico.plus size={11} aria-hidden /> Add a step
        </button>
      </section>

      {detail ? <Fold id="j-detail" title={detail.title} count={detail.n} {...fold("detail")}>{detail.body}</Fold> : null}
      {items.length ? (
        <Fold id="j-story" title="What happened in this stage" count={items.length} {...fold("story")}>
          <Story items={items} />
        </Fold>
      ) : null}
    </div>
  );
}

/** Who does a step, as an icon and a word. */
function DoerBadge({ step, j }: { step: Step; j: MockJourney }) {
  const map: Record<Step["doer"], { icon: keyof typeof Ico; text: string }> = {
    rift: { icon: "bolt", text: step.mode === "auto" ? "Rift, on its own" : "Rift prepares, you approve" },
    you: { icon: "pin", text: "You" },
    tc: { icon: "layers", text: `${COORDINATOR}, coordinator` },
    client: { icon: "home", text: firstNames(j) },
    pro: { icon: "shield", text: step.pro ?? "Outside pro" },
  };
  const m = map[step.doer];
  const Icon = Ico[m.icon];
  return <span className={`ops-doer ops-doer-${step.doer}`}><Icon size={11} aria-hidden />{m.text}</span>;
}

/** The named party who confirms a step, from the deal's team when there is one (rule 9). */
function confirmer(j: MockJourney, role: string) {
  const t = j.team?.find((x) => x.role === role);
  return t ? `${role} (${t.name.split(",")[0]})` : role;
}

function StepRow({ j, r, reached, record, undo, setToast, confirming, setConfirming }: {
  j: MockJourney; r: Row; reached: boolean;
  record: (key: string, mark: StepMark) => void; undo: (key: string) => void; setToast: (t: string) => void;
  confirming: boolean; setConfirming: (o: boolean) => void;
}) {
  const { step, mark, key } = r;
  const open = isOpen(mark.state);
  const today = `Today ${NOW.time}`;
  const human = step.doer === "you" || step.doer === "tc";
  /* Ticking records who did it. A step someone else has to confirm asks who
     confirmed it first, and a client saying so is a report (UX-02). */
  const canTick = reached && open && human && !step.confirms;
  const needsWord = reached && open && Boolean(step.confirms) && step.doer !== "rift";
  const canApprove = reached && mark.state === "ready";
  const StateIcon = Ico[STEP_ICON[mark.state]];
  return (
    <li className={`ops-step is-${mark.state} ${reached ? "" : "is-later"}`}>
      <span className="ops-step-mark">
        {canTick || needsWord ? (
          <button className="ops-tick" aria-label={`${needsWord ? "Record who confirmed" : "Mark done"}: ${step.title}`}
            onClick={() => (needsWord ? setConfirming(!confirming) : record(key, { state: "done", by: step.doer === "tc" ? `You, for ${COORDINATOR}` : "You", on: today }))}>
            <Ico.check size={11} aria-hidden />
          </button>
        ) : <span className={STEP_TONE[mark.state]} title={STEP_WORD[mark.state]}><StateIcon size={15} aria-hidden /></span>}
      </span>
      <div className="ops-step-body">
        <span className="ops-step-title">
          {step.title}
          {step.protected ? <span className="ops-lock" title="Always yours, whatever the automation settings"><Ico.lock size={10} aria-hidden /><span className="sr-only"> (always yours)</span></span> : null}
        </span>
        <span className="ops-step-sub">
          {mark.state === "done" ? <span className="c-pos">Done{mark.by ? ` · ${mark.by}` : ""}{mark.on ? `, ${mark.on}` : ""}</span>
            : mark.state !== "todo" ? <span className={STEP_TONE[mark.state]}>{STEP_WORD[mark.state]}</span>
            : reached ? <span className="ops-muted">To do</span> : null}
          {mark.due && open ? <span> · due {mark.due}</span> : null}
          {mark.note ? <span className="ops-muted"> · {mark.note}</span> : null}
          {r.session ? <> · <button className="ops-link" onClick={() => undo(key)}>Undo</button></> : null}
        </span>
        {confirming ? (
          <div className="ops-confirm" role="group" aria-label="Who confirmed it?">
            <span className="ops-more-label">Who confirmed it? Done needs a named party.</span>
            <button className="ops-btn ops-btn-sm" onClick={() => record(key, { state: "done", by: confirmer(j, step.confirms!), on: today })}>{confirmer(j, step.confirms!)}</button>
            {step.doer === "client" ? (
              <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => record(key, { state: "reported", note: `${firstNames(j)} say${j.household.length > 1 ? "" : "s"} it is done; not confirmed by the ${step.confirms!.toLowerCase()} yet` })}>
                Only {firstNames(j)} say{j.household.length > 1 ? "" : "s"} so
              </button>
            ) : null}
            <button className="ops-link" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        ) : null}
      </div>
      <DoerBadge step={step} j={j} />
      <span className="ops-step-act">
        {canApprove ? (
          <>
            <button className="ops-btn ops-btn-sm ops-btn-p" onClick={() => record(key, { state: "done", by: "You", on: today, note: "Approved; Rift sent it" })}>Approve</button>
            <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => setToast("In the real screen: the exact message, who it goes to and on which channel. Changing it voids the approval (AUTO-01).")}>Read it</button>
          </>
        ) : needsWord ? (
          <button className="ops-btn ops-btn-sm" onClick={() => setConfirming(!confirming)}>{step.doer === "client" || step.doer === "pro" ? "Record their word" : "Mark done"}</button>
        ) : reached && open && step.doer === "client" ? (
          <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => setToast(`Rift drafts a short reminder to ${firstNames(j)} for you to approve. Nothing sends by itself.`)}>Remind</button>
        ) : null}
      </span>
    </li>
  );
}

function Story({ items }: { items: MockJourney["story"] }) {
  return (
    <ol className="ops-story">
      {items.map((x) => (
        <li key={x.at + x.what}><span className="ops-time ops-time-wide">{x.at}</span><span>{x.what}</span></li>
      ))}
    </ol>
  );
}

function SearchDetail({ j, marks, setMarks, setToast }: { j: MockJourney; marks: Marks; setMarks: SetMarks; setToast: (t: string) => void }) {
  return (
    <>
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
        <table className="ops-table ops-table-cards">
          <thead><tr><th>Criterion</th><th>Value</th><th>Strength</th><th>Who said it</th></tr></thead>
          <tbody>{(j.brief ?? []).map((b) => (
            <tr key={b.field} className="ops-static">
              <td className="ops-strong">{b.field}</td><td data-label="Value">{b.value}</td>
              <td data-label="Strength">{b.strength === "Not decided" ? <span className="c-warn"><Ico.alert size={10} aria-hidden /> Not decided</span> : b.strength}</td>
              <td data-label="Who" className="ops-muted">{b.by}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {j.matrix ? <p className="ops-muted ops-note"><Ico.layers size={11} aria-hidden /> Matrix: {j.matrix}</p> : null}
    </>
  );
}

function HomesDetail({ j }: { j: MockJourney }) {
  return (
    <div className="ops-table-wrap ops-flat">
      <table className="ops-table ops-table-cards">
        <thead><tr><th>Home</th><th>Price</th><th>Reactions</th><th>Showing</th></tr></thead>
        <tbody>{(j.homes ?? []).map((h) => {
          const says = new Set(h.reactions.map((r) => r.says.split(":")[0]));
          const split = h.reactions.length > 1 && says.size > 1;
          return (
            <tr key={h.address} className="ops-static">
              <td className="ops-strong">{h.address}</td><td data-label="Price">{h.price}</td>
              <td data-label="Reactions">
                {h.reactions.map((r) => <span key={r.who} className="ops-react">{r.who}: {r.says}</span>)}
                {split ? <span className="ops-chip ops-chip-warn"><Ico.alert size={10} aria-hidden />They disagree</span> : null}
              </td>
              <td data-label="Showing" className="ops-muted">{h.showing ?? "Not booked"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** "Not shared", "From Hannah" (she uploaded it), or who it is shared with. */
const sharedWord = (s: string) => (s === "Not shared" ? "not shared with anyone yet" : s.startsWith("From ") ? `uploaded by ${s.slice(5)}` : `shared with ${s}`);

function OffersDetail({ j, marks, setMarks }: { j: MockJourney; marks: Marks; setMarks: SetMarks }) {
  return (
    <>
      {j.side === "sell" ? <OfferCards j={j} marks={marks} setMarks={setMarks} /> : <OfferTable j={j} />}
      {j.documents?.length ? (
        <>
          <h3 className="ops-h3">Documents</h3>
          <ul className="ops-list">{j.documents.map((d) => (
            <li key={d.name}><Ico.doc size={11} aria-hidden /><strong>{d.name}</strong><span className="ops-muted">· added {d.added} · {sharedWord(d.shared)}</span></li>
          ))}</ul>
        </>
      ) : null}
    </>
  );
}

function DatesDetail({ j }: { j: MockJourney }) {
  return (
    <ul className="ops-list">{j.keyDates.map((d) => (
      <li key={d.label}><DateMark s={d.state} /><strong>{d.label}</strong><span className="ops-muted"> · {d.on}{d.state !== "done" ? `, ${inDays(d.iso)}` : ""}</span></li>
    ))}</ul>
  );
}

function OfferTable({ j }: { j: MockJourney }) {
  const offers = j.offers ?? [];
  if (!offers.length) return <p className="ops-muted">No offers yet.</p>;
  return (
    <div className="ops-table-wrap ops-flat">
      <table className="ops-table ops-table-cards">
        <thead><tr><th>Offer</th><th>Price</th><th>Terms</th><th>Status</th></tr></thead>
        <tbody>{offers.map((o) => (
          <tr key={o.from} className="ops-static">
            <td className="ops-strong">{o.from}</td>
            <td data-label="Price">{o.price}</td>
            <td data-label="Terms">{o.terms}</td>
            <td data-label="Status">{o.status}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** A seller's offers, ranked by what reaches the seller after costs: the headline price is not the answer. */
const reachOf = (o: { reaches?: string }) => Number((o.reaches ?? "").replace(/\D/g, ""));
function rankOffers(j: MockJourney) {
  return [...(j.offers ?? [])].sort((a, b) => reachOf(b) - reachOf(a));
}

function OfferCards({ j, marks, setMarks }: { j: MockJourney; marks?: Marks; setMarks?: SetMarks }) {
  const ranked = rankOffers(j);
  const first = firstNames(j);
  return (
    <>
      <div className="ops-offers">
        {ranked.map((o, i) => {
          const key = `offer-${j.id}-${j.offers!.indexOf(o)}`;
          const presented = o.status.startsWith("Presented") || Boolean(marks?.[key]);
          const today = o.expires?.startsWith("Today");
          return (
            <article key={o.from} className={`ops-offer ${i === 0 ? "is-best" : ""}`} aria-label={o.from}>
              <div className="ops-offer-top">
                <strong>{o.from.split(" · ")[0]}</strong>
                <span className="ops-muted">{o.from.split(" · ")[1]}</span>
                {o.expires ? <span className={`ops-chip ${today ? "ops-chip-neg" : ""}`}><Ico.clock size={10} aria-hidden />Expires {o.expires}</span> : null}
              </div>
              <p className="ops-offer-reach">
                <span className="ops-offer-big">{o.reaches}</span>
                <span className="ops-muted">reaches {first} after costs</span>
                {i === 0 ? <span className="ops-chip ops-chip-pos"><Ico.check size={10} aria-hidden />Leaves the most</span> : null}
              </p>
              <p className="ops-offer-terms"><strong>{o.price}</strong> · {o.terms}{o.earnest ? ` · ${o.earnest} earnest` : ""}</p>
              <div className="ops-offer-foot">
                <span className={presented ? "c-pos" : "c-warn"}>
                  {presented ? <Ico.checkCircle size={11} aria-hidden /> : <Ico.bell size={11} aria-hidden />} {marks?.[key] ?? (presented ? o.status : `${o.status} · not yet presented`)}
                </span>
                {!presented && setMarks ? (
                  <span className="ops-row">
                    <button className="ops-btn ops-btn-sm ops-btn-p" onClick={() => setMarks((m) => ({ ...m, [key]: `Presented to ${first} at ${NOW.time}` }))}>
                      <Ico.lock size={10} aria-hidden /> Present to {first}
                    </button>
                    <button className="ops-btn ops-btn-sm ops-btn-quiet" onClick={() => setMarks((m) => ({ ...m, [key]: "Held, with your reason recorded. It is not discarded" }))}>Hold</button>
                  </span>
                ) : null}
              </div>
              <p className="ops-sub">{o.received} · {o.source}</p>
            </article>
          );
        })}
      </div>
      <p className="ops-muted ops-note">Ranked by what reaches {first} after costs, not by the headline price. Presenting an offer is always yours.</p>
    </>
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
        <span className="ops-muted">Every contract, sorted by closing. A row opens that deal&apos;s checklist.</span>
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

/* Version 2 showed every offer as a seven-column table, and Kaleb found it
   overwhelming. An offer comes down to a few things: what reaches the
   seller, when it expires, and whether the agent has presented it (the
   agent's, in every mode). Everything else is one click away. */
function OffersView({ marks, setMarks, openJourney }: { marks: Marks; setMarks: SetMarks; openJourney: (id: string) => void }) {
  const [made, setMade] = useState(false);
  const listing = JOURNEYS.filter((j) => j.side === "sell" && j.offers?.length);
  const buyers = JOURNEYS.filter((j) => j.side === "buy" && j.offers?.length);
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Offers</h1>
        <span className="ops-muted">Every offer on your listings reaches you first. You decide when to present it; none is ever discarded.</span>
      </header>
      {listing.map((j) => {
        const call = TODAY.find((t) => t.journeyId === j.id && t.group === "today" && t.kind === "offer");
        return (
          <section key={j.id} className="ops-card ops-section">
            <div className="ops-section-head">
              <h2 className="ops-h2">{j.property} <span className="ops-muted">· {person(j.personId)!.name} · {j.price}{call ? ` · talking at ${call.due}` : ""}</span></h2>
              <button className="ops-btn ops-btn-sm" onClick={() => openJourney(j.id)}>The offer checklist<Ico.arrowR size={11} aria-hidden /></button>
            </div>
            <OfferCards j={j} marks={marks} setMarks={setMarks} />
          </section>
        );
      })}
      <Fold id="o-made" title="Your buyers' offers" count={buyers.length} note="all accepted" open={made} setOpen={setMade}>
        <ul className="ops-list">
          {buyers.map((j) => j.offers!.map((o) => (
            <li key={j.id + o.from}>
              <button className="ops-link ops-strong" data-row onClick={() => openJourney(j.id)}>{person(j.personId)!.name}</button>
              <span>{j.property}</span><span className="ops-muted">· {o.price}</span>
              <span className="c-pos"><Ico.check size={10} aria-hidden /> {o.status}</span>
            </li>
          )))}
        </ul>
      </Fold>
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

/* Was "Advocacy", which Kaleb did not recognise. It is the referral and
   review engine (product.md): the four moments to ask, the one follow-up,
   and thanking whoever sends a client. */
function AdvocacyView({ setToast }: { setToast: (t: string) => void }) {
  const tone = { due: ["c-warn", "clock", "Due"], later: ["c-2", "cal", "Later"], quiet: ["c-4", "pause", "Stay quiet"] } as const;
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Reviews and referrals</h1>
        <span className="ops-muted">When to ask a client for a review or an introduction, and thanking the people who send you clients.</span>
      </header>
      <p className="ops-callout">
        <Ico.info size={13} aria-hidden />
        <span className="ops-grow">Rift watches for four moments: a hard step won mid-deal, closing day, two weeks after move-in, and one year in the home. It drafts the ask; nothing sends until you approve, and nobody unhappy is asked for a public review.</span>
      </p>
      <div className="ops-grid2">
        <section className="ops-card ops-card-list">
          <h2 className="ops-h2"><Ico.gift size={12} aria-hidden /> Moments</h2>
          <ul className="ops-checklist">
            {MOMENTS.map((m) => {
              const [c, icon, word] = tone[m.state];
              const Icon = Ico[icon];
              return (
                <li key={m.who + m.moment} className="ops-step">
                  <span className={`ops-step-mark ${c}`}><Icon size={14} aria-hidden /></span>
                  <div className="ops-step-body">
                    <span className="ops-step-title">{m.who}: {m.moment.toLowerCase()}</span>
                    <span className="ops-step-sub"><span className={c}>{word}</span> · {m.when} · <span className="ops-muted">{m.ask}</span></span>
                  </div>
                  <span />
                  <span className="ops-step-act">{m.state === "due" ? <button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen Rift's draft opens here for you to edit and approve.")}>Read the draft</button> : null}</span>
                </li>
              );
            })}
          </ul>
          <p className="ops-muted ops-note">Under contract is listed so the restraint reads as deliberate: those weeks are not the time to ask for anything.</p>
        </section>
        <section className="ops-card">
          <h2 className="ops-h2"><Ico.users size={12} aria-hidden /> Referrals</h2>
          <ul className="ops-list">
            <li><Ico.checkCircle size={11} aria-hidden className="c-pos" /><strong>The Abebes sent the Okafors</strong><span className="ops-muted">· thanked 12 Aug · a second thank-you is due when the Okafors close, Fri 16 Oct</span></li>
            <li><Ico.checkCircle size={11} aria-hidden className="c-pos" /><strong>The Parks sent Hannah Lee</strong><span className="ops-muted">· thanked 3 Jul · second thank-you due at closing, Wed 30 Sep</span></li>
          </ul>
          <p className="ops-muted ops-note">Every past client has a personal link; whoever arrives through it is credited to them on their record.</p>
        </section>
      </div>
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

/* Was "Questions", which said nothing about what it was. These are the
   agent's own questions on the public tools (the funnel question editor);
   rule 5 keeps every one of them away from the numbers. */
function QuestionsView({ setToast }: { setToast: (t: string) => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({ q1: true, q2: true, q3: true });
  const qs = [
    { id: "q1", q: "When would you like to move?", on: "Every buyer tool", answered: 214 },
    { id: "q2", q: "Is anyone buying with you?", on: "Cost to buy, budget", answered: 158 },
    { id: "q3", q: "Anything Kaleb should know?", on: "When they save a plan", answered: 47 },
  ];
  return (
    <>
      <header className="ops-head">
        <h1 className="ops-h1">Lead-form questions</h1>
        <span className="ops-muted">Your own extra questions on the free tools on your website. The answers go on the person&apos;s record, for you.</span>
      </header>
      <p className="ops-callout"><Ico.lock size={13} aria-hidden /><span className="ops-grow">They never change a figure anyone sees (rule 5): the numbers come only from the tool&apos;s own questions.</span></p>
      <div className="ops-grid2">
        <section className="ops-card ops-card-list">
          <div className="ops-section-head">
            <h2 className="ops-h2">Your questions</h2>
            <button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen: the question, which tools show it, and whether it is optional.")}><Ico.plus size={11} aria-hidden />Add a question</button>
          </div>
          <ul className="ops-checklist">
            {qs.map((x) => (
              <li key={x.id} className="ops-step">
                <span className="ops-step-mark"><Ico.info size={14} aria-hidden className="c-4" /></span>
                <div className="ops-step-body">
                  <span className="ops-step-title">{x.q}</span>
                  <span className="ops-step-sub ops-muted">Shown on: {x.on} · answered {x.answered} times</span>
                </div>
                <span />
                <span className="ops-step-act"><Switch id={`qs-${x.id}`} on={on[x.id]} set={(v) => setOn((o) => ({ ...o, [x.id]: v }))} label={`Ask “${x.q}”`} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ops-card">
          <h2 className="ops-h2">What a visitor sees</h2>
          <p className="ops-muted ops-small">After their numbers, one short optional step:</p>
          <div className="ops-preview">
            <label htmlFor="pv-move">When would you like to move? <span className="ops-muted">(optional)</span></label>
            <select id="pv-move" className="ops-input" defaultValue="">
              <option value="" disabled>Choose one</option><option>Within 3 months</option><option>3 to 6 months</option><option>6 to 12 months</option><option>Just looking</option>
            </select>
            <p className="ops-muted ops-small">This does not change your numbers.</p>
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Settings */

function Switch({ id, on, set, label, disabled }: { id?: string; on: boolean; set: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <span className="ops-switch-wrap">
      <button id={id} type="button" role="switch" aria-checked={on} aria-label={label} className="ops-switch" disabled={disabled} onClick={() => set(!on)}><span aria-hidden /></button>
      <span className={on ? "ops-strong" : "ops-muted"}>{on ? "On" : "Off"}</span>
    </span>
  );
}

function SetRow({ id, label, help, children }: { id?: string; label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="ops-set-row">
      <div className="ops-set-label">
        {id ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
        {help ? <p>{help}</p> : null}
      </div>
      <div className="ops-set-ctl">{children}</div>
    </div>
  );
}

const SECTIONS: { s: string; label: string; icon: keyof typeof Ico }[] = [
  { s: "profile", label: "Profile and hours", icon: "pin" },
  { s: "team", label: "Team", icon: "users" },
  { s: "automation", label: "Automation", icon: "bolt" },
  { s: "checklists", label: "Checklists", icon: "check" },
  { s: "leads", label: "Leads and emails", icon: "mail" },
  { s: "connections", label: "Connections", icon: "layers" },
  { s: "privacy", label: "Privacy and records", icon: "lock" },
];

const WORKFLOWS: { id: string; name: string; help: string; external: boolean; consented?: boolean; value: Assign | "manual" }[] = [
  { id: "summary", name: "Morning summary to you", help: "7:00, with the next 14 days.", external: false, value: "auto" },
  { id: "alert", name: "New-lead alert to you", help: "Text and email, the moment someone asks for a review.", external: false, value: "auto" },
  { id: "chase", name: "Chase an outside party gone quiet", help: "Tells you or Meron after 7 days with no word.", external: false, value: "auto" },
  { id: "programs", name: "Check assistance program pages", help: "Every morning. A change waits for you before anyone sees it.", external: false, value: "auto" },
  { id: "nurture", name: "Follow-up emails to leads", help: "4 emails over 6 weeks, only to people who asked, stopping the moment they reply.", external: true, consented: true, value: "auto" },
  { id: "tour", name: "Tour plans and reminders to clients", help: "Sent once the showings are confirmed.", external: true, value: "approve" },
  { id: "kickoff", name: "Under-contract kickoff", help: "To the clients and the lender, with the verified dates.", external: true, value: "approve" },
  { id: "closing", name: "Closing instructions and the wire-fraud warning", help: "From the closing attorney's instructions.", external: true, value: "approve" },
  { id: "asks", name: "Review and referral asks", help: "At the four moments on Reviews and referrals.", external: true, value: "approve" },
];

function SettingsView({ section, setSection, assigns, setAssigns, setToast }: {
  section: string; setSection: (s: string) => void;
  assigns: Assigns; setAssigns: React.Dispatch<React.SetStateAction<Assigns>>; setToast: (t: string) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"review" | "balanced" | "high">("balanced");
  const [flows, setFlows] = useState<Record<string, string>>(() => Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.value])));
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    alertText: true, alertEmail: true, nurture: true, tcTick: true, tcBook: true, tcDraft: true, tcMoney: false, tcApprove: false,
  });
  const [pending, setPending] = useState<Assigns>(assigns);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const touch = () => setDirty(true);
  const toggle = (k: string) => (v: boolean) => { setToggles((t) => ({ ...t, [k]: v })); touch(); };
  const pickMode = (m: typeof mode) => {
    setMode(m);
    /* Review everything: Rift prepares, you approve, apart from what only
       ever reaches you. The other two keep today's settings. */
    if (m === "review") setFlows((f) => Object.fromEntries(Object.keys(f).map((k) => [k, k === "summary" || k === "alert" ? "auto" : "approve"])));
    else setFlows(Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.value])));
    touch();
  };
  const sec = SECTIONS.find((x) => x.s === section) ?? SECTIONS[0];
  const save = () => { setAssigns(pending); setDirty(false); setToast("Saved for this session only: this is a mock-up. Checklist changes now show on the journeys and on Meron's list."); };
  const discard = () => { setPending(assigns); setFlows(Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.value]))); setMode("balanced"); setDirty(false); };
  return (
    <>
      <header className="ops-head"><h1 className="ops-h1">Settings</h1></header>
      <div className="ops-settings-frame">
        <nav className="ops-set-nav" aria-label="Settings sections">
          {SECTIONS.map((x) => {
            const Icon = Ico[x.icon];
            return (
              <button key={x.s} className="ops-nav" aria-current={sec.s === x.s ? "page" : undefined} onClick={() => setSection(x.s)}>
                <Icon size={14} aria-hidden />{x.label}
                {x.s === "connections" ? <span className="ops-count ops-count-neg">1<span className="sr-only"> needs you</span></span> : null}
              </button>
            );
          })}
        </nav>

        <div className="ops-set-body">
          {sec.s === "profile" ? (
            <section className="ops-card ops-set-card" aria-label="Profile and hours">
              <h2 className="ops-h2">Profile and hours</h2>
              <SetRow id="st-name" label="Your name" help="On emails, the booking page and every client page."><input id="st-name" className="ops-input" defaultValue="Kaleb" onChange={touch} /></SetRow>
              <SetRow id="st-broker" label="Brokerage" help="Shown beside your name, as your broker requires."><input id="st-broker" className="ops-input" placeholder="Your brokerage's name" onChange={touch} /></SetRow>
              <SetRow id="st-phone" label="Phone"><input id="st-phone" className="ops-input" defaultValue="(404) 555-0100" onChange={touch} /></SetRow>
              <SetRow id="st-email" label="Email"><input id="st-email" className="ops-input" defaultValue="kaleb@example.com" onChange={touch} /></SetRow>
              <SetRow id="st-from" label="Working hours" help="Outside them, a new lead is told when you will reply, and the 15-minute clock waits.">
                <span className="ops-row">
                  <select id="st-from" className="ops-input ops-input-auto" defaultValue="8:00 am" onChange={touch}><option>7:00 am</option><option>8:00 am</option><option>9:00 am</option></select>
                  <span className="ops-muted">to</span>
                  <select aria-label="Working hours end" className="ops-input ops-input-auto" defaultValue="7:00 pm" onChange={touch}><option>6:00 pm</option><option>7:00 pm</option><option>9:00 pm</option></select>
                </span>
              </SetRow>
              <SetRow id="st-tz" label="Time zone"><select id="st-tz" className="ops-input ops-input-auto" defaultValue="Eastern (Atlanta)" onChange={touch}><option>Eastern (Atlanta)</option></select></SetRow>
            </section>
          ) : null}

          {sec.s === "team" ? (
            <section className="ops-card ops-set-card" aria-label="Team">
              <div className="ops-section-head">
                <h2 className="ops-h2">Team</h2>
                <button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen: their name, email and role. They get their own sign-in.")}><Ico.plus size={11} aria-hidden />Invite someone</button>
              </div>
              <ul className="ops-team">
                <li><span className="ops-avatar" aria-hidden>K</span><span className="ops-grow"><strong>Kaleb</strong> <span className="ops-muted">(you)</span><span className="ops-sub">Agent · owns every client and every decision</span></span></li>
                <li><span className="ops-avatar" aria-hidden>M</span><span className="ops-grow"><strong>{COORDINATOR}</strong><span className="ops-sub">Transaction coordinator · since August</span></span><span className="c-pos"><Ico.checkCircle size={11} aria-hidden /> Active</span></li>
              </ul>
              <h3 className="ops-h3">What {COORDINATOR} can do</h3>
              <SetRow id="st-tc1" label="Tick off coordinator steps" help="Their steps on each checklist, and Meron's list on Today."><Switch id="st-tc1" on={toggles.tcTick} set={toggle("tcTick")} /></SetRow>
              <SetRow id="st-tc2" label="Book showings and inspections"><Switch id="st-tc2" on={toggles.tcBook} set={toggle("tcBook")} /></SetRow>
              <SetRow id="st-tc3" label="Write to clients" help="As drafts you approve, like Rift's."><Switch id="st-tc3" on={toggles.tcDraft} set={toggle("tcDraft")} /></SetRow>
              <SetRow id="st-tc4" label="See clients' money" help="Budgets, savings and lender figures."><Switch id="st-tc4" on={toggles.tcMoney} set={toggle("tcMoney")} /></SetRow>
              <SetRow id="st-tc5" label="Approve what Rift prepared" help="Off: approvals stay with you."><Switch id="st-tc5" on={toggles.tcApprove} set={toggle("tcApprove")} /></SetRow>
              <SetRow label={<><Ico.lock size={11} aria-hidden /> Always yours</>} help="No setting gives these to anyone else.">
                <span className="ops-muted">Sending agreements, presenting offers, price opinions</span>
              </SetRow>
            </section>
          ) : null}

          {sec.s === "automation" ? (
            <section className="ops-card ops-set-card" aria-label="Automation">
              <h2 className="ops-h2">Automation</h2>
              <p className="ops-muted ops-small">How much Rift does without asking. You can change it any time, and per workflow below.</p>
              <fieldset className="ops-modes">
                <legend className="sr-only">Mode</legend>
                {([
                  ["review", "Review everything", "Rift prepares; you approve every step."],
                  ["balanced", "Balanced", "Rift does the routine work on its own and asks you about anything a client or outside party sees."],
                  ["high", "High automation", "Rift runs trusted workflows on its own, within your limits."],
                ] as const).map(([m, t, d]) => (
                  <label key={m} className={`ops-mode ${mode === m ? "is-on" : ""}`}>
                    <input type="radio" name="st-mode" checked={mode === m} onChange={() => pickMode(m)} />
                    <span><strong>{t}</strong><span className="ops-sub">{d}</span></span>
                  </label>
                ))}
              </fieldset>
              {mode === "high" ? <p className="ops-note c-warn"><Ico.info size={11} aria-hidden /> For now, anything a client sees still waits for you: sending on its own needs the approvals record (v5 §10.2) built first.</p> : null}
              <h3 className="ops-h3">Each workflow</h3>
              {WORKFLOWS.map((w) => (
                <SetRow key={w.id} id={`wf-${w.id}`} label={w.name} help={<>{w.help}{w.external && !w.consented ? " A client sees it, so it waits for you." : ""}</>}>
                  <select id={`wf-${w.id}`} className="ops-input ops-input-auto" value={flows[w.id]} onChange={(e) => { setFlows((f) => ({ ...f, [w.id]: e.target.value })); touch(); }}>
                    <option value="manual">You do it</option>
                    <option value="approve">Rift prepares, you approve</option>
                    <option value="auto" disabled={w.external && !w.consented}>Rift does it on its own</option>
                  </select>
                </SetRow>
              ))}
              <SetRow label={<><Ico.lock size={11} aria-hidden /> Always yours</>} help="In every mode.">
                <ul className="ops-plain">
                  <li>Presenting an offer, or deciding not to</li><li>Sending or signing an agreement</li><li>A price opinion</li><li>Anything that states a legal or lending conclusion</li>
                </ul>
              </SetRow>
              <p className="ops-rift-line"><Ico.bolt size={12} aria-hidden /> This week under these settings: Rift ran 38 steps on its own and 1 failed (the morning summary); you approved 6 it prepared.</p>
            </section>
          ) : null}

          {sec.s === "checklists" ? (
            <section className="ops-card ops-set-card" aria-label="Checklists">
              <div className="ops-section-head">
                <h2 className="ops-h2">Checklists</h2>
                <div className="ops-seg ops-seg-sm" role="group" aria-label="Which checklist">
                  <button aria-pressed={side === "buy"} onClick={() => setSide("buy")}>Buying</button>
                  <button aria-pressed={side === "sell"} onClick={() => setSide("sell")}>Selling</button>
                </div>
              </div>
              <p className="ops-muted ops-small">Who does each step, for every client. A step given to {COORDINATOR} goes on {COORDINATOR}&apos;s list; one given to Rift runs on its own or waits for you. The client&apos;s and outside professionals&apos; steps are theirs.</p>
              {STAGES.map((s) => (
                <div key={s} className="ops-set-group">
                  <h3 className="ops-h3">{side === "sell" ? SELL_STAGE_LABEL[s] : STAGE_LABEL[s]}</h3>
                  {(side === "buy" ? BUY_PLAYBOOK : SELL_PLAYBOOK).filter((x) => x.stage === s).map((step) => {
                    const a = assignOf(step);
                    return (
                      <SetRow key={step.id} id={a && !step.protected ? `ck-${step.id}` : undefined}
                        label={<>{step.title}{step.protected ? <span className="ops-lock" title="Always yours"><Ico.lock size={10} aria-hidden /></span> : null}</>}>
                        {step.protected ? <span className="ops-muted">You, always</span>
                          : a ? (
                            <select id={`ck-${step.id}`} className="ops-input ops-input-auto" value={pending[step.id] ?? a}
                              onChange={(e) => { setPending((p) => ({ ...p, [step.id]: e.target.value as Assign })); touch(); }}>
                              <option value="you">You</option>
                              <option value="tc">{COORDINATOR} (coordinator)</option>
                              <option value="approve">Rift prepares, you approve</option>
                              <option value="auto" disabled={step.external}>Rift, on its own</option>
                            </select>
                          ) : <span className="ops-muted">{step.doer === "client" ? "The client" : step.pro}</span>}
                      </SetRow>
                    );
                  })}
                </div>
              ))}
            </section>
          ) : null}

          {sec.s === "leads" ? (
            <section className="ops-card ops-set-card" aria-label="Leads and emails">
              <h2 className="ops-h2">Leads and emails</h2>
              <SetRow id="st-reply" label="Reply target" help="Today counts down from when a lead asks for a review.">
                <select id="st-reply" className="ops-input ops-input-auto" defaultValue="15 minutes" onChange={touch}><option>5 minutes</option><option>15 minutes</option><option>30 minutes</option><option>1 hour</option></select>
              </SetRow>
              <SetRow id="st-a1" label="New-lead alert by text"><Switch id="st-a1" on={toggles.alertText} set={toggle("alertText")} /></SetRow>
              <SetRow id="st-a2" label="New-lead alert by email"><Switch id="st-a2" on={toggles.alertEmail} set={toggle("alertEmail")} /></SetRow>
              <SetRow id="st-n" label="Follow-up emails" help="4 emails over 6 weeks, to people who asked for them. They stop the moment someone replies."><Switch id="st-n" on={toggles.nurture} set={toggle("nurture")} /></SetRow>
              <SetRow id="st-sum" label="Morning summary">
                <select id="st-sum" className="ops-input ops-input-auto" defaultValue="7:00 am" onChange={touch}><option>6:00 am</option><option>7:00 am</option><option>8:00 am</option><option>Off</option></select>
              </SetRow>
              <SetRow id="st-stale" label="Flag an outside party after" help="Days with no word from a lender, attorney or other agent.">
                <span className="ops-row"><input id="st-stale" className="ops-input ops-input-num" type="number" min={1} max={30} defaultValue={7} onChange={touch} /><span className="ops-muted">days</span></span>
              </SetRow>
            </section>
          ) : null}

          {sec.s === "connections" ? (
            <section className="ops-card ops-set-card" aria-label="Connections">
              <h2 className="ops-h2">Connections</h2>
              <p className="ops-muted ops-small">A missing connection says what people see instead. Nothing fails quietly.</p>
              {([
                ["Brevo (email)", "warn", "Connected, but the sending domain is not verified: morning summaries are held.", "Fix"],
                ["Cal.com (booked calls)", "off", "Not connected: people see your phone number instead.", "Connect"],
                ["Offer PDF reading", "off", "Off: people type an offer's terms in themselves.", "Turn on"],
                ["Matrix", "manual", "No write access: Meron sets up saved searches by hand.", ""],
                ["ShowingTime", "manual", "No write access: showings are booked there, and recorded here.", ""],
                ["Remine", "manual", "Agreements and offers are prepared there; Rift records where they stand.", ""],
              ] as const).map(([name, st, text, btn]) => {
                const m = { warn: ["c-warn", "alert", "Needs you"], off: ["c-4", "minus", "Off"], manual: ["c-2", "pin", "By hand"] }[st];
                const Icon = Ico[m[1] as keyof typeof Ico];
                return (
                  <SetRow key={name} label={name} help={text}>
                    <span className="ops-row"><span className={m[0]}><Icon size={11} aria-hidden /> {m[2]}</span>
                      {btn ? <button className="ops-btn ops-btn-sm" onClick={() => setToast(`In the real screen: ${btn.toLowerCase()} ${name}.`)}>{btn}</button> : null}</span>
                  </SetRow>
                );
              })}
            </section>
          ) : null}

          {sec.s === "privacy" ? (
            <section className="ops-card ops-set-card" aria-label="Privacy and records">
              <h2 className="ops-h2">Privacy and records</h2>
              <SetRow label="How long records are kept" help="Set by the privacy page's promises, per kind of record. Not changed here."><span className="ops-muted">As promised on the privacy page</span></SetRow>
              <SetRow label="What leads' answers are used for" help="Their numbers only. Your own questions never reach a figure (rule 5)."><span className="ops-muted">Fixed</span></SetRow>
              <SetRow label="Export a client's records" help="Everything on their journey, for them."><button className="ops-btn ops-btn-sm" onClick={() => setToast("In the real screen: pick a client, and Rift prepares their export.")}>Export</button></SetRow>
            </section>
          ) : null}
        </div>
      </div>
      {dirty ? (
        <div className="ops-savebar" role="region" aria-label="Unsaved changes">
          <span className="ops-grow">You have unsaved changes.</span>
          <button className="ops-btn ops-btn-sm" onClick={discard}>Discard</button>
          <button className="ops-btn ops-btn-sm ops-btn-p" onClick={save}>Save changes</button>
        </div>
      ) : null}
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
