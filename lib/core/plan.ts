/**
 * A client's plan — the shape of it, and the rules about what it may say.
 *
 * Pure, so the rules can be tested without a database, and because the rules
 * are the interesting part. Two of them decide whether this surface is worth
 * having at all.
 *
 * EVERY ITEM HAS AN OWNER. A plan where nobody owes anything is a list of
 * hopes, and "waiting on the lender" and "waiting on you" are completely
 * different sentences to the person reading it. There is no default owner and
 * there is no "unassigned".
 *
 * NOTHING IS OVERDUE UNTIL IT IS. A plan that marks things late by guessing is
 * a plan the client stops opening. An item with no date cannot be late —
 * saying otherwise would punish the agent for not inventing a deadline, which
 * is the behaviour worth encouraging.
 */

export type Owner = "client" | "agent" | "other";

export interface PlanItem {
  id: string;
  title: string;
  owner: Owner;
  /** Required when owner is "other", meaningless otherwise. */
  ownerName: string | null;
  /** ISO date, or null when nobody has committed to one. */
  dueOn: string | null;
  doneAt: string | null;
  sort: number;
}

/**
 * How an owner reads, to whoever is reading it.
 *
 * `reader` is required and has no default, because this renders in the SECOND
 * PERSON and the second person is a different human on each of the two pages
 * that call it. Written with only the agent's name to work from, it labelled
 * a step owed by the client as "You" — correct on their page, and on the
 * agent's panel a line telling him he owes something he does not.
 *
 * The same family as the readout that once printed "You'm a U.S. citizen
 * living abroad": a pronoun produced without knowing who is being addressed.
 * Making the caller say is the only fix that does not rot.
 */
export function ownerLabel(
  item: Pick<PlanItem, "owner" | "ownerName">,
  names: { agent: string; client?: string | null },
  reader: "client" | "agent",
): string {
  if (item.owner === "client") {
    return reader === "client" ? "You" : (names.client ?? "").trim() || "Them";
  }
  if (item.owner === "agent") {
    return reader === "agent" ? "You" : names.agent;
  }
  return (item.ownerName ?? "").trim() || "Someone else";
}

export type Bucket = "overdue" | "now" | "soon" | "later" | "someday" | "done";

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Past its date",
  now: "This week",
  soon: "The next two weeks",
  later: "This month",
  /* Everything with a date far out, and everything with no date at all. They
     belong together on the client's page: both mean "not yet", and separating
     them would make the agent's failure to set a date look like a stage. */
  someday: "After that",
  /* Not "Completed". This reads back to somebody as a record of what has
     actually happened, and "Done" is how a person says it. */
  done: "Done",
};

/** The order they appear. Overdue first because that is the point of saying it. */
export const BUCKET_ORDER: Bucket[] = ["overdue", "now", "soon", "later", "someday", "done"];

const DAY = 86_400_000;

/** Whole days from today to a date, negative when it has passed. */
export function daysUntil(dueOn: string, today: Date): number {
  const due = new Date(`${dueOn}T00:00:00Z`).getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((due - now) / DAY);
}

export function bucketFor(item: PlanItem, today = new Date()): Bucket {
  if (item.doneAt) return "done";
  /* No date, no judgement. */
  if (!item.dueOn) return "someday";

  const days = daysUntil(item.dueOn, today);
  if (days < 0) return "overdue";
  if (days <= 7) return "now";
  if (days <= 14) return "soon";
  if (days <= 31) return "later";
  return "someday";
}

export interface PlanSection {
  bucket: Bucket;
  label: string;
  items: PlanItem[];
}

/**
 * The plan, grouped the way it is read.
 *
 * Empty buckets are dropped. A client's plan that renders five headings with
 * nothing under them looks like a product that has not started.
 */
export function groupPlan(items: PlanItem[], today = new Date()): PlanSection[] {
  const by = new Map<Bucket, PlanItem[]>();
  for (const item of items) {
    const b = bucketFor(item, today);
    (by.get(b) ?? by.set(b, []).get(b)!).push(item);
  }

  return BUCKET_ORDER.flatMap((bucket) => {
    const list = by.get(bucket);
    if (!list?.length) return [];
    /* Within a bucket: the agent's order, then the date, then arrival. Done
       items run newest first — the most recent thing achieved is the one worth
       seeing. */
    const sorted = [...list].sort((a, b2) =>
      bucket === "done"
        ? (b2.doneAt ?? "").localeCompare(a.doneAt ?? "")
        : a.sort - b2.sort || (a.dueOn ?? "9999").localeCompare(b2.dueOn ?? "9999"));
    return [{ bucket, label: BUCKET_LABEL[bucket], items: sorted }];
  });
}

export interface PlanSummary {
  total: number;
  done: number;
  /** Waiting on the client specifically. The only number they can act on. */
  onYou: number;
  overdue: number;
}

export function summarise(items: PlanItem[], today = new Date()): PlanSummary {
  const open = items.filter((i) => !i.doneAt);
  return {
    total: items.length,
    done: items.length - open.length,
    onYou: open.filter((i) => i.owner === "client").length,
    overdue: open.filter((i) => bucketFor(i, today) === "overdue").length,
  };
}

/**
 * The one line at the top, in the client's own terms.
 *
 * Deliberately not a percentage. "You are 40% complete" is a number about the
 * plan; "two things are waiting on you" is a number about them, and only one
 * of those causes anybody to do anything.
 */
export function headline(s: PlanSummary): string {
  if (s.total === 0) return "Your plan is being written.";
  if (s.done === s.total) return "Everything on your plan is done.";

  const late = s.overdue === 1 ? "one is past its date" : `${s.overdue} are past its date`;

  /* Nothing on them. Said without mentioning a count of zero — "0 things are
     waiting on you" is how a page tells somebody it is generated rather than
     written. Overdue items owned by the agent still get named, because the
     client is entitled to know the hold-up is at this end. */
  if (s.onYou === 0) {
    return s.overdue === 0
      ? "Nothing is waiting on you right now."
      : `Nothing is waiting on you — but ${late}.`;
  }

  const you = s.onYou === 1 ? "One thing is waiting on you" : `${s.onYou} things are waiting on you`;
  return s.overdue === 0 ? `${you}.` : `${you}, and ${late}.`;
}

/* ------------------------------------------------------------------ *
 * The five questions
 * ------------------------------------------------------------------ */

/**
 * docs/vision.md asks that every customer be able to answer five questions
 * immediately: where am I, what do I do next, what is somebody else doing for
 * me, what is approaching, and where do I ask for help.
 *
 * This page answered the first and the last. The middle three are below, and
 * they are derived rather than stored — there is no appointments table and no
 * documents table, so inventing a surface for either would mean a heading that
 * is permanently empty. What can honestly be answered from plan items is
 * answered from plan items, and the rest is not claimed.
 *
 * The rule holding all three together: NEVER MANUFACTURE ACTIVITY. A client
 * who is told their agent is working on something, on a page that in fact
 * knows of nothing, has been lied to by a product whose only asset is that its
 * statements are true.
 */

/** Why a particular item is the one being pointed at. */
export type NextReason = "overdue" | "dated" | "undated";

export interface NextUp {
  item: PlanItem;
  reason: NextReason;
  /** Negative when past. Null when nobody set a date. */
  days: number | null;
}

/**
 * The single most important thing the client owes.
 *
 * One, not a list. The plan below already shows everything; a person opening
 * this on a phone between other things needs the answer to "is anything
 * waiting on me", and five bullet points is a different, worse answer than one
 * sentence. Returns null when nothing is owed by them, which is a real and
 * common state and must read as one.
 *
 * Order: the latest overdue item first — not the most recently overdue, the
 * one that has been late longest, because that is the one quietly holding
 * everything else up. Then the soonest dated. Then the agent's own ordering
 * among items nobody has dated.
 */
export function nextForClient(items: PlanItem[], today = new Date()): NextUp | null {
  const mine = items.filter((i) => i.owner === "client" && !i.doneAt);
  if (!mine.length) return null;

  const dated = mine.filter((i) => i.dueOn);
  const overdue = dated
    .filter((i) => daysUntil(i.dueOn!, today) < 0)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  if (overdue.length) {
    const item = overdue[0]!;
    return { item, reason: "overdue", days: daysUntil(item.dueOn!, today) };
  }

  const upcoming = [...dated].sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  if (upcoming.length) {
    const item = upcoming[0]!;
    return { item, reason: "dated", days: daysUntil(item.dueOn!, today) };
  }

  const undated = [...mine].sort((a, b) => a.sort - b.sort);
  return { item: undated[0]!, reason: "undated", days: null };
}

/** How long a completed item still counts as evidence that work is happening. */
export const RECENT_DAYS = 21;

export interface Elsewhere {
  /** Open, owed by the agent or a named third party. Soonest date first. */
  open: PlanItem[];
  /** Finished inside RECENT_DAYS, newest first. */
  recentlyDone: PlanItem[];
}

/**
 * What is being done for them, by anybody who is not them.
 *
 * Two halves, because "what is your agent doing" has two honest answers and
 * they are different: what is outstanding at his end, and what has actually
 * been finished lately. The second is the one that builds trust — a client who
 * can see three things completed in the last fortnight stops asking whether
 * anything is happening, which is the entire mechanism behind the "inbound
 * status questions under one per month" target in docs/benchmark.md.
 *
 * Completed items age out deliberately. A plan whose only evidence of life is
 * something finished in March should not read, in September, as though work is
 * under way.
 */
export function notOnYou(items: PlanItem[], today = new Date(), sinceDays = RECENT_DAYS): Elsewhere {
  const theirs = items.filter((i) => i.owner !== "client");

  const open = theirs
    .filter((i) => !i.doneAt)
    /* Dated first and soonest first; undated last in the agent's own order.
       An item with no date is not less important, but it is less answerable,
       and leading with it pushes the thing that has a deadline out of sight. */
    .sort((a, b) =>
      (a.dueOn ? 0 : 1) - (b.dueOn ? 0 : 1)
      || (a.dueOn ?? "").localeCompare(b.dueOn ?? "")
      || a.sort - b.sort);

  const cutoff = today.getTime() - sinceDays * DAY;
  const recentlyDone = theirs
    .filter((i) => {
      if (!i.doneAt) return false;
      const at = new Date(i.doneAt).getTime();
      /* An unparseable timestamp is not a recent completion. Number.isNaN on
         the comparison would silently answer false anyway, but saying so here
         is the difference between a rule and an accident. */
      return Number.isFinite(at) && at >= cutoff;
    })
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  return { open, recentlyDone };
}

export interface Approaching {
  item: PlanItem;
  /** Whole days from today. Negative when already past. */
  days: number;
}

/**
 * Everything with a date coming up, whoever owns it.
 *
 * Deliberately not filtered to the client's own items. "What is approaching"
 * is a question about the transaction, not about their homework — a client
 * whose appraisal is on Thursday needs to know that even though there is
 * nothing for them to do about it.
 *
 * Overdue items are included and sort first. A deadline that has passed is
 * the most approaching thing there is.
 */
export function approaching(
  items: PlanItem[],
  today = new Date(),
  withinDays = 30,
  limit = 5,
): Approaching[] {
  return items
    .filter((i) => !i.doneAt && i.dueOn)
    .map((i) => ({ item: i, days: daysUntil(i.dueOn!, today) }))
    .filter((a) => a.days <= withinDays)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

/** How a date reads to somebody checking their phone. */
export function whenPhrase(days: number): string {
  if (days < -1) return `${Math.abs(days)} days ago`;
  if (days === -1) return "yesterday";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "next week";
  return `in ${Math.round(days / 7)} weeks`;
}
