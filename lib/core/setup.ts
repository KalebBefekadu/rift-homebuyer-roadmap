/**
 * What is left to set up, computed from what the product already knows.
 *
 * Kaleb's words on the settings page: it "should be organized based on what
 * needs to be done". The facts were all there, spread over /api/health, the
 * environment, the business rules and the agent row, and none of them was in
 * front of the one person who can act on them. /api/health is for a monitor
 * and deliberately says as little as it can; this says everything, to the
 * agent, behind his session.
 *
 * Each item is a state with an icon and a word (rule 10), one line on what it
 * affects, and what to do: a form on the settings page, or the exact steps
 * when the change lives in a provider's dashboard or an environment variable.
 * A secret's value never enters this module; only whether it is set.
 *
 * "Set" is not "working" and this keeps them apart, because the product's
 * most expensive bug was a health line that said "configured" for weeks while
 * every scheduled run returned 405. Where there is an outcome to read (a
 * job's last run, Brevo's answer about the sender) the item goes by the
 * outcome; where there is none it says "Not confirmed" rather than "Done".
 *
 * Pure. lib/db/setup.ts gathers the facts.
 */

import { DEFAULT_RULES, RULE_LABEL, RULE_REACH, type BusinessRules } from "./settings";
import { PROFILE, PROFILE_FIELDS, type AgentProfile } from "./profile";
import type { JobHealth } from "./jobs";

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

export type SetupState = "broken" | "todo" | "confirm" | "waiting" | "optional" | "done";

/**
 * The word for each state. The page adds the icon; the word is what makes
 * the state readable without colour.
 */
export const STATE_WORD: Record<SetupState, string> = {
  broken: "Not working",
  todo: "To do",
  confirm: "Not confirmed",
  waiting: "Waiting on someone",
  optional: "Optional, off",
  done: "Done",
};

/** Most urgent first. A broken thing outranks an unset one: it is failing people now. */
const ORDER: SetupState[] = ["broken", "todo", "confirm", "waiting", "optional", "done"];

export type SetupGroup = "decisions" | "profile" | "connections" | "language";

export const GROUP_LABEL: Record<SetupGroup, string> = {
  decisions: "Business rules",
  profile: "Profile",
  connections: "Connections",
  language: "Language",
};

export type SetupAction =
  /** Somewhere in Operations, usually a form further down this page. */
  | { kind: "link"; href: string; label: string }
  /** Done outside Rift: a provider's dashboard or an environment variable. */
  | { kind: "steps"; steps: string[] }
  /** A question Rift can ask on demand, never on page load. */
  | { kind: "check"; what: "email"; label: string };

export interface SetupItem {
  id: string;
  group: SetupGroup;
  title: string;
  state: SetupState;
  /** One line: what this changes for a person, or what is failing. */
  affects: string;
  action: SetupAction | null;
}

/* ------------------------------------------------------------------ *
 * Facts
 * ------------------------------------------------------------------ */

/**
 * Brevo's answer about the sending address. Classified here so the health
 * endpoint and the settings page cannot disagree about what an answer means.
 */
export type SenderVerdict = "ready" | "awaiting" | "unregistered" | "blocked" | "refused" | "unknown";

/** From Brevo's GET /v3/senders. Never sees the key; `from` is compared, not kept. */
export function senderVerdict(status: number, body: string, from: string): SenderVerdict {
  if (status === 401 && /unrecognised IP/i.test(body)) return "blocked";
  if (status < 200 || status >= 300) return "refused";
  let senders: { email?: string; active?: boolean }[];
  try {
    senders = (JSON.parse(body).senders ?? []) as { email?: string; active?: boolean }[];
  } catch {
    return "unknown";
  }
  const match = senders.find((s) => String(s.email).toLowerCase() === from.trim().toLowerCase());
  return !match ? "unregistered" : match.active ? "ready" : "awaiting";
}

export interface SetupFacts {
  /** Null when the rules could not be read: never taken as "all decided". */
  undecided: (keyof BusinessRules)[] | null;
  /** Null when the agent row could not be read. */
  profile: AgentProfile | null;
  email: {
    key: boolean;
    sender: boolean;
    /** Null when nobody has asked Brevo (recently, on this server). */
    verdict: SenderVerdict | null;
  };
  calendar: { key: boolean; eventType: boolean };
  ai: boolean;
  monitoring: boolean;
  cronSecret: boolean;
  /** Each job's last outcome; null when it could not be read or is not tracked. */
  jobs: JobHealth[] | null;
  /** NEXT_PUBLIC_SITE_URL set, and the address links are actually built from. */
  site: { explicit: boolean; resolved: string | null };
  amharic: { unreviewed: number; total: number; wrong: number };
}

/* ------------------------------------------------------------------ *
 * Items
 * ------------------------------------------------------------------ */

/**
 * The two rules the product itself says are not the agent's to decide.
 * Their action is to ask, and the page should say so before offering a field.
 */
const BROKER_OWNED: (keyof BusinessRules)[] = ["clientRetentionYears", "marketUnrepresented"];

/** The first sentence of a rule's `affects`: the list wants one line, the rule row has the rest. */
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

const VERCEL_ENV = "In Vercel, open the project, then Settings, then Environment Variables";
const REDEPLOY = "Redeploy production so the new value is read (Deployments, the latest one, Redeploy)";

function ruleItems(undecided: (keyof BusinessRules)[] | null): SetupItem[] {
  if (undecided === null) {
    return [{
      id: "rules", group: "decisions", title: "Business rules could not be read", state: "broken",
      affects: "The database did not answer, so this cannot tell a decision from a default. Nothing has changed.",
      action: { kind: "link", href: "/operations/settings", label: "Reload" },
    }];
  }
  return (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[]).map((k) => {
    const open = undecided.includes(k);
    const broker = BROKER_OWNED.includes(k);
    return {
      id: `rule:${k}`,
      group: "decisions" as const,
      title: open ? `Decide: ${RULE_LABEL[k]}` : RULE_LABEL[k],
      state: open ? "todo" as const : "done" as const,
      affects: open
        ? `${broker ? "Your broker's call. " : ""}${firstSentence(DEFAULT_RULES[k].affects)}${RULE_REACH[k].live ? "" : " Recorded only for now."}`
        : "Decided.",
      action: open ? { kind: "link" as const, href: `#rule-${k}`, label: broker ? "Record the broker's answer" : "Decide" } : null,
    };
  });
}

function profileItems(profile: AgentProfile | null): SetupItem[] {
  if (!profile) {
    return [{
      id: "profile", group: "profile", title: "Your profile could not be read", state: "broken",
      affects: "The agent record did not load. Nothing has changed.",
      action: { kind: "link", href: "/operations/settings", label: "Reload" },
    }];
  }
  return PROFILE_FIELDS.filter((f) => PROFILE[f].expected).map((f) => {
    const empty = !(profile[f] ?? "").trim();
    const spec = PROFILE[f];
    return {
      id: `profile:${f}`,
      group: "profile" as const,
      title: empty ? `Add your ${spec.label.toLowerCase()}` : spec.label,
      state: empty ? "todo" as const : "done" as const,
      affects: empty ? spec.reach.where : "Recorded.",
      action: empty ? { kind: "link" as const, href: "#profile", label: "Add it" } : null,
    };
  });
}

function emailItem(e: SetupFacts["email"]): SetupItem {
  const base = { id: "email", group: "connections" as const, title: "Email sending" };
  const affects = "Readouts on request, follow-ups, new-lead alerts and your morning summary.";
  if (!e.key) {
    return {
      ...base, state: "todo", affects: `Off. Nothing is emailed: ${affects.toLowerCase()}`,
      action: { kind: "steps", steps: [
        "In Brevo, open SMTP & API, then API keys, and create a key",
        `${VERCEL_ENV}, and add BREVO_API_KEY for Production`,
        "In Brevo's security settings keep IP blocking for API keys off: Vercel sends from changing addresses",
        REDEPLOY,
      ] },
    };
  }
  if (!e.sender) {
    return {
      ...base, state: "todo", affects: "No sending address, so Brevo refuses every message and nothing is sent.",
      action: { kind: "steps", steps: [
        "Register the address in Brevo: node --env-file=.env.local scripts/brevo-sender.mjs you@example.com, then click the link Brevo emails to it",
        `${VERCEL_ENV}, and add BREVO_FROM_EMAIL with that address`,
        REDEPLOY,
      ] },
    };
  }
  switch (e.verdict) {
    case "ready":
      return { ...base, state: "done", affects: "Brevo confirms the sending address is verified.", action: null };
    case "awaiting":
      return {
        ...base, state: "broken", affects: "Brevo has the sending address but it is not verified, so every send is refused.",
        action: { kind: "steps", steps: [
          "Open the verification email Brevo sent to the sending address and click its link (search the inbox for \"Brevo\")",
          "Or re-send it: node --env-file=.env.local scripts/brevo-sender.mjs <the address>",
          "Then ask Brevo again from here",
        ] },
      };
    case "unregistered":
      return {
        ...base, state: "broken", affects: "BREVO_FROM_EMAIL is not a sender in this Brevo account, so every send is refused.",
        action: { kind: "steps", steps: [
          "Register it: node --env-file=.env.local scripts/brevo-sender.mjs <the address in BREVO_FROM_EMAIL>",
          "Click the verification link Brevo emails to that address",
          "Or change BREVO_FROM_EMAIL in Vercel to an address already verified in Brevo, and redeploy",
        ] },
      };
    case "blocked":
      return {
        ...base, state: "broken", affects: "Brevo's IP allowlist refuses this server, so nothing is sent.",
        action: { kind: "steps", steps: [
          "In Brevo, open Security, then Authorised IPs, and turn off IP blocking for API keys",
          "Serverless functions have no fixed address, so an allowlist cannot be kept current",
          "Then ask Brevo again from here",
        ] },
      };
    case "refused":
      return {
        ...base, state: "broken", affects: "Brevo refused the key. It may have been revoked or mistyped.",
        action: { kind: "steps", steps: [
          "In Brevo, open SMTP & API, then API keys, and check the key is still listed",
          `${VERCEL_ENV}, and replace BREVO_API_KEY with a current key`,
          REDEPLOY,
        ] },
      };
    case "unknown":
      return { ...base, state: "confirm", affects: "Brevo did not answer just now. That is not a verdict; ask again.", action: { kind: "check", what: "email", label: "Ask Brevo again" } };
    default:
      return {
        ...base, state: "confirm", affects: "The key and the sending address are set. Brevo refuses an address it has not verified, so set is not the same as sending.",
        action: { kind: "check", what: "email", label: "Ask Brevo" },
      };
  }
}

function calendarItem(c: SetupFacts["calendar"]): SetupItem {
  const base = { id: "calendar", group: "connections" as const, title: "Calendar booking" };
  if (c.key && c.eventType) {
    return { ...base, state: "done", affects: "Visitors see real Cal.com openings. If Cal.com stops answering, the booking screen says so and asks for a rough time instead.", action: null };
  }
  const missing = [!c.key ? "CAL_API_KEY" : null, !c.eventType ? "CAL_EVENT_TYPE_ID" : null].filter(Boolean).join(" and ");
  return {
    ...base, state: "todo",
    affects: `Off (${missing} not set). The booking screen asks for a rough time instead of showing openings, so nobody can take a slot without you.`,
    action: { kind: "steps", steps: [
      "In Cal.com, open Settings, then Developer, then API keys, and create a key",
      "Open the event type visitors should book; its number is in the address bar (…/event-types/<number>)",
      `${VERCEL_ENV}, and add CAL_API_KEY and CAL_EVENT_TYPE_ID (optionally RIFT_TIMEZONE, default America/New_York)`,
      REDEPLOY,
    ] },
  };
}

function aiItem(on: boolean): SetupItem {
  return on
    ? { id: "ai", group: "connections", title: "AI assistance", state: "done", affects: "Reading offer PDFs, comparing changed program pages, drafting campaigns. Capped at $50 a month in code.", action: null }
    : {
      id: "ai", group: "connections", title: "AI assistance", state: "optional",
      affects: "Off. Offers are typed in by hand, program changes are compared line by line, campaigns are written from scratch. Nothing fails without it.",
      action: { kind: "steps", steps: [
        "In the Anthropic Console, open API keys and create a key",
        `${VERCEL_ENV}, and add ANTHROPIC_API_KEY for Production (never with a NEXT_PUBLIC_ prefix)`,
        REDEPLOY,
      ] },
    };
}

function monitoringItem(on: boolean): SetupItem {
  return on
    ? { id: "monitoring", group: "connections", title: "Error monitoring", state: "done", affects: "Errors and failed jobs are reported to Sentry.", action: null }
    : {
      id: "monitoring", group: "connections", title: "Error monitoring", state: "todo",
      affects: "Off. When something breaks for a visitor, nobody is told.",
      action: { kind: "steps", steps: [
        "In Sentry, open the project, then Settings, then Client Keys (DSN), and copy the DSN",
        `${VERCEL_ENV}, and add NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN with it`,
        "Redeploy with a fresh build: NEXT_PUBLIC_ values are fixed when the site is built",
      ] },
    };
}

function schedulerItem(secret: boolean, jobs: JobHealth[] | null): SetupItem {
  const base = { id: "scheduler", group: "connections" as const, title: "Scheduled jobs" };
  if (!secret) {
    return {
      ...base, state: "todo",
      affects: "CRON_SECRET is not set, so every scheduled job refuses to run: no follow-ups, no deletions the privacy page promises, no morning summary.",
      action: { kind: "steps", steps: [
        "Make a long random value: openssl rand -hex 32",
        `${VERCEL_ENV}, and add CRON_SECRET with it for Production`,
        `${REDEPLOY}. Vercel's scheduler sends it with every run by itself`,
      ] },
    };
  }
  if (!jobs) {
    return { ...base, state: "confirm", affects: "The secret is set, but the record of runs could not be read, so whether they run is not known.", action: { kind: "link", href: "/operations", label: "See Today" } };
  }
  const failing = jobs.filter((j) => j.state === "failed" || j.state === "missed");
  if (failing.length) {
    return {
      ...base, state: "broken",
      affects: `${failing.map((j) => `${j.label}: ${j.state === "failed" ? "the last run failed" : "missed its schedule"}`).join("; ")}.`,
      action: { kind: "link", href: "/operations", label: "See what failed on Today" },
    };
  }
  if (jobs.every((j) => j.state === "never")) {
    return { ...base, state: "confirm", affects: "The secret is set and no job has recorded a run yet.", action: { kind: "link", href: "/operations", label: "See Today" } };
  }
  return { ...base, state: "done", affects: "Every job's last run succeeded on schedule.", action: null };
}

function siteItem(site: SetupFacts["site"]): SetupItem {
  const base = { id: "site", group: "connections" as const, title: "Site address" };
  if (site.explicit && site.resolved) {
    return { ...base, state: "done", affects: `Links in emails, share cards and the sitemap use ${site.resolved}.`, action: null };
  }
  const steps = [
    "Add the domain in Vercel (Settings, then Domains) and point its DNS where Vercel says",
    `${VERCEL_ENV}, and add NEXT_PUBLIC_SITE_URL, for example https://yourdomain.com`,
    "Redeploy with a fresh build: NEXT_PUBLIC_ values are fixed when the site is built",
  ];
  if (!site.resolved) {
    return { ...base, state: "todo", affects: "No address is known, so emails carry no links back and the sitemap is empty.", action: { kind: "steps", steps } };
  }
  return {
    ...base, state: "optional",
    affects: `Links use Vercel's address, ${site.resolved}. Set your own domain when you have one, so links and search results carry it.`,
    action: { kind: "steps", steps },
  };
}

function amharicItem(a: SetupFacts["amharic"]): SetupItem {
  const base = { id: "amharic", group: "language" as const, title: "Amharic review" };
  if (a.unreviewed === 0 && a.wrong === 0) {
    return { ...base, state: "done", affects: "Every Amharic string has been approved by a native reader.", action: null };
  }
  return {
    ...base, state: "waiting",
    affects: `${a.unreviewed} of ${a.total} Amharic strings have not been checked by a native reader${a.wrong ? `; ${a.wrong} known to be wrong are shown in English until retranslated` : ""}.`,
    action: { kind: "steps", steps: [
      "A native Amharic reader goes through the buyers-abroad pages in Amharic (/abroad?lang=am) against the English",
      "Each approved string is added to REVIEWED_AM in lib/core/i18n.ts; a wrong one to WRONG_IN_AM until it is fixed",
    ] },
  };
}

/** Every item, most urgent first; within a state, in page order. */
export function setupItems(f: SetupFacts): SetupItem[] {
  const all = [
    ...ruleItems(f.undecided),
    ...profileItems(f.profile),
    emailItem(f.email),
    calendarItem(f.calendar),
    schedulerItem(f.cronSecret, f.jobs),
    monitoringItem(f.monitoring),
    siteItem(f.site),
    aiItem(f.ai),
    amharicItem(f.amharic),
  ];
  return all
    .map((item, i) => ({ item, i }))
    .sort((a, b) => ORDER.indexOf(a.item.state) - ORDER.indexOf(b.item.state) || a.i - b.i)
    .map((x) => x.item);
}

export type SetupCounts = Record<SetupState, number> & { open: number; total: number };

export function setupCounts(items: SetupItem[]): SetupCounts {
  const c = { broken: 0, todo: 0, confirm: 0, waiting: 0, optional: 0, done: 0 } as Record<SetupState, number>;
  for (const i of items) c[i.state]++;
  return { ...c, open: items.length - c.done, total: items.length };
}

/**
 * The sidebar's number: the "To do" items, which are decided by the rules,
 * the profile and the environment alone.
 *
 * Not "Not working" or "Not confirmed": those need Brevo's answer and the job
 * runs, and the layout that draws the sidebar runs on every Operations page.
 * A badge that cost a network call per page, or one that counted things it
 * had not checked, would both be worse than this narrower honest number. The
 * page shows the rest beside it.
 */
export function setupTodo(f: Pick<SetupFacts, "undecided" | "profile" | "email" | "calendar" | "ai" | "monitoring" | "cronSecret" | "site" | "amharic">): number {
  return setupCounts(setupItems({ ...f, email: { ...f.email, verdict: null }, jobs: null })).todo;
}
