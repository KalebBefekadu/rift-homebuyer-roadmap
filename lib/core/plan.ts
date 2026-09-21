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
