import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedRead, boundedWrite } from "./bounded";
import { journeyTablesMissing } from "./journeys";
import { sequenceFor, resolveChannel, programLines, touchCopy, skipReason, SAVE_EMAIL_STEP, type Audience, type Enrolment, type ProgramLine, type StopId, type TouchKind } from "@/lib/core/nurture";
import { BUY_FUNNEL, firstTimeFrom, ownershipOf } from "@/lib/core/funnel";
import { planFacts, planAssistance } from "@/lib/core/saved-plan";
import { georgiaDay, showDay } from "@/lib/core/day";
import { currentPrograms } from "./program-checks";
import { rulesOrDefaults } from "./settings";
import { matchAssistance, toLegacy, type Profile, type ProgramRecord } from "@/lib/core/assistance";
import type { Band } from "@/lib/core/lead";

/**
 * The cadence, running.
 *
 * The engine in lib/core/nurture.ts decides WHAT is owed. This decides what has
 * actually been sent, and the difference is where every duplicate-send bug
 * lives. The guarantee is a unique constraint on (enrolment, step): a retry, a
 * double cron fire, or two workers racing cannot send the same email twice, and
 * no amount of application-level care can promise that.
 *
 * A reply stops the sequence immediately, not after the current step. Software
 * that keeps sending once somebody has answered proves there was never a person
 * on this end, and in a referral business that is unrecoverable.
 */

export async function enrol(leadId: string, band: Band, phoneConsent: boolean): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_enrolments")
      .upsert({ agent_id, lead_id: leadId, band, phone_consent: phoneConsent }, { onConflict: "lead_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) return failed(error.message);
    if (data) return done({ id: data.id as string });

    const { data: existing } = await db.from("rift_enrolments").select("id").eq("lead_id", leadId).maybeSingle();
    return existing ? done({ id: existing.id as string }) : failed("enrolment could not be created or found");
  } catch (e) {
    return failed(e);
  }
}

/** Any stop condition. Immediate: the queue is recomputed, not drained. */
export async function stop(
  leadId: string, reason: StopId, agentId: string,
): Promise<DbResult<{ stopped: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  /* Scoped to the signed-in agent. Stopping a sequence is irreversible from
     the product's side (the cadence does not restart) so an unscoped id
     here lets one agent silence another's follow-ups permanently. */
  if (!agentId) return failed("no agent");
  try {
    /* The agent is watching this button, and it is the action behind contract
       4.11: a sequence that keeps sending because a stop hung is exactly the
       failure the contract exists to prevent. */
    const stopped = await boundedWrite(
      db.from("rift_enrolments")
        .update({ stopped_at: new Date().toISOString(), stop_reason: reason })
        .eq("lead_id", leadId)
        .eq("agent_id", agentId)
        .is("stopped_at", null),
      "the stop",
    );
    if (!stopped.ok) return stopped;
    return done({ stopped: true as const });
  } catch (e) {
    return failed(e);
  }
}

export interface DueTouch {
  enrolmentId: string;
  leadId: string;
  name: string;
  email: string | null;
  band: Band;
  stepId: string;
  /** The subject, already the plan variant's when the step has one and they saved a plan. */
  says: string;
  /** The agent-facing rationale, shown in Studio. Never emailed. */
  gives: string;
  /** The customer-facing opening line, chosen the same way as `says`. */
  body: string;
  auto: boolean;
  channel: "email" | "text" | "call" | "task";
  downgraded: string | null;
  daysLate: number;
  /**
   * The figures this person was actually shown, and the link to them.
   *
   * Carried because a touch without them cannot be written. The runner used to
   * send zeroes ("Buying in your County takes $0 at the table") which is
   * worse than sending nothing at all: it is a message that proves nobody is
   * paying attention, delivered to somebody deciding whether to trust us with
   * their finances.
   */
  figures: Record<string, string | number> | null;
  shareToken: string | null;
  /**
   * Which email this is: their readout, their saved plan, or an invitation
   * back. Decided here, from what is on file, so the dry run and the send
   * cannot disagree about it.
   */
  kind: TouchKind;
  /** The saved plan's private link token (Blueprint v5 §5.5), when that is what they have. */
  planToken: string | null;
  /** The Georgia day the plan was saved. */
  planSavedOn: string | null;
  /** A value's own page, for "start it again". Never carries their answers. */
  againPath: string | null;
  county: string | null;
  /** From the ownership answer on their readout or plan. What the programs step matches on, with the county. */
  firstTimeBuyer: boolean;
  /**
   * What the programs step matches against: the saved plan page's own profile
   * for a plan, the readout's inputs for a v4 lead. Null with `profileGap`
   * saying why when there is not enough to match on.
   */
  profile: Profile | null;
  profileGap: string | null;
  /** How far they got, for the recovery touch. Everything, for somebody who saved a plan. */
  answered: number;
  of: number;
  side: "buy" | "sell";
  /**
   * What they are doing, read from their saved plan before the lead's side:
   * the save route files a buyer from abroad as a buyer, and the plan is
   * where the difference is kept. Decides the copy.
   */
  audience: Audience;
  /**
   * Why this step is not sent to them, when it is not. The runner records the
   * touch as skipped with this, and sends nothing: the alternative is the
   * buyer's words, or silence nobody can see.
   */
  skip: string | null;
}

/**
 * What is owed right now.
 *
 * Computed from the sequence definition against what has been sent, rather than
 * stored as a schedule. A stored schedule goes stale the moment a sequence is
 * edited, and then somebody receives day-3 of a cadence that no longer exists.
 */
export async function due(now = new Date()): Promise<DbResult<DueTouch[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_enrolments")
      /* The plan columns ride on the same embed. Since D31 a new lead has no
         assessment at all, so without them every real lead read as somebody
         who had started and stopped, and was sent "pick up where you left
         off" about a plan they had finished and saved. */
      .select("id,lead_id,band,entered_at,phone_consent,rift_leads(name,email,assessment_id,side,plan,plan_token,plan_saved_at),rift_touches(step_id,outcome,sent_at)")
      .eq("agent_id", agent_id)
      .is("stopped_at", null);
    if (error) return failed(error.message);

    /* A lead the agent now works with in a journey is a client: the journey
       is the follow-up, and marketing touches would talk past it (AT37).
       createJourney stops the sequence; this also covers a journey whose stop
       did not land. */
    const clients = await journeyLeads(db, agent_id);
    if (!clients.ok) return clients;
    const isClient = "data" in clients ? clients.data : new Set<string>();

    const rows = ((data ?? []) as unknown as {
      id: string; lead_id: string; band: Band; entered_at: string; phone_consent: boolean;
      rift_leads: {
        name: string | null; email: string | null; assessment_id: string | null; side: "buy" | "sell";
        plan?: unknown; plan_token?: string | null; plan_saved_at?: string | null;
      } | null;
      rift_touches: { step_id: string; outcome?: string; sent_at?: string }[];
    }[]).filter((r) => !isClient.has(r.lead_id));

    /* One query for the whole queue rather than one per enrolment. */
    const assessmentIds = rows
      .map((r) => r.rift_leads?.assessment_id)
      .filter((x): x is string => Boolean(x));

    /* How many questions each person actually answered. The recovery touch is
       the only one that needs it, and it is the only touch that can reach the
       largest population in the funnel, so it is worth the query. */
    const progress = new Map<string, number>();
    if (assessmentIds.length) {
      const { data: ans, error: ansErr } = await db
        .from("rift_answers")
        .select("assessment_id")
        .in("assessment_id", assessmentIds);
      /* A failed read is a failed queue, not "answered nothing". */
      if (ansErr) return failed(ansErr.message);
      for (const a of (ans ?? []) as { assessment_id: string }[]) {
        progress.set(a.assessment_id, (progress.get(a.assessment_id) ?? 0) + 1);
      }
    }

    const snap = new Map<string, { figures: Record<string, string | number>; token: string; county: string | null; firstTimeBuyer: boolean; price: number | null }>();
    if (assessmentIds.length) {
      const { data: reads, error: readErr } = await db
        .from("rift_readouts")
        .select("assessment_id,figures,inputs,share_token,created_at,rift_assessments(county)")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: false });
      /* This one decides which email a person gets. Read as empty, everybody
         who finished would have been sent the "pick up where you left off"
         touch, telling them they had not finished what they had. */
      if (readErr) return failed(readErr.message);
      for (const r of (reads ?? []) as unknown as {
        assessment_id: string; figures: Record<string, string | number>; share_token: string;
        inputs: Record<string, unknown> | null;
        rift_assessments: { county: string | null } | null;
      }[]) {
        if (!snap.has(r.assessment_id)) {
          snap.set(r.assessment_id, {
            figures: r.figures,
            token: r.share_token,
            county: r.rift_assessments?.county ?? null,
            firstTimeBuyer: firstTimeFrom(ownershipOf(r.inputs?.ownership)),
            price: typeof r.inputs?.price === "number" && Number.isFinite(r.inputs.price) && r.inputs.price > 0 ? r.inputs.price : null,
          });
        }
      }
    }

    /* The buyer funnel's length. Read from the definition rather than
       hard-coded, so editing the funnel cannot make this sentence lie. */
    const of = BUY_FUNNEL.questions.filter((q) => q.enabled).length;

    const out: DueTouch[] = [];
    for (const row of rows) {
      const daysIn = Math.floor((now.getTime() - new Date(row.entered_at).getTime()) / 86_400_000);
      const sent = new Set(row.rift_touches?.map((t) => t.step_id) ?? []);

      const e: Enrolment = {
        leadId: row.lead_id,
        name: row.rift_leads?.name ?? row.rift_leads?.email ?? "Someone",
        band: row.band,
        daysIn,
        stopped: null,
        phoneConsent: row.phone_consent,
        done: [...sent],
      };

      const seq = sequenceFor(e.band);
      const pending = seq.steps.filter((s) => !sent.has(s.id) && s.day <= daysIn);
      if (!pending.length) continue;

      const step = pending[0];
      const { channel, downgraded } = resolveChannel(step, e.phoneConsent);
      const lead = row.rift_leads;
      const s = lead?.assessment_id ? snap.get(lead.assessment_id) : undefined;
      /* A readout wins over a plan: it is what the older lead was sent, and
         its figures are computed and stored. A plan counts only with its
         token, because the token is the only way back to it. */
      const saved = !s && lead?.plan_token ? planFacts(lead.plan) : null;
      const kind: TouchKind = s ? "readout" : saved ? "plan" : "resume";
      /* The plan's side even when a readout wins the kind: it is the person
         who is selling or abroad, not the email. Falls back to the lead's. */
      const audience: Audience = planFacts(lead?.plan)?.side ?? lead?.side ?? "buy";
      const copy = touchCopy(step, kind, audience);
      const forPrograms = programsProfile(s, saved ? lead!.plan : null);

      out.push({
        enrolmentId: row.id,
        leadId: row.lead_id,
        name: e.name,
        email: row.rift_leads?.email ?? null,
        band: e.band,
        stepId: step.id,
        says: copy.says,
        gives: step.gives,
        body: copy.body,
        auto: step.auto,
        channel,
        downgraded,
        daysLate: daysIn - step.day,
        figures: s?.figures ?? null,
        shareToken: s?.token ?? null,
        kind,
        planToken: saved ? lead!.plan_token! : null,
        planSavedOn: saved && lead?.plan_saved_at ? georgiaDay(new Date(lead.plan_saved_at)) : null,
        againPath: saved?.againPath ?? null,
        county: s?.county ?? saved?.county ?? null,
        firstTimeBuyer: s?.firstTimeBuyer ?? saved?.firstTimeBuyer ?? true,
        profile: forPrograms.profile,
        profileGap: forPrograms.gap,
        answered: saved ? of : lead?.assessment_id ? progress.get(lead.assessment_id) ?? 0 : 0,
        of,
        side: lead?.side ?? "buy",
        audience,
        skip: skipReason(step, audience) ?? (kind === "plan" && step.coveredBySaveEmail ? savedEmailCovers(row.rift_touches) : null),
      });
    }

    /* Most overdue first. A queue sorted by anything else is a to-do list. */
    return done(out.sort((a, b) => b.daysLate - a.daysLate));
  } catch (e) {
    return failed(e);
  }
}

/**
 * Why a day-zero touch is not sent: the save email already carried its link.
 *
 * Only on a RECORDED send. A failed save email, a switched-off sender, and a
 * plan saved before the outcome was recorded all leave the follow-up as the
 * one email with the link in it, and one duplicate is better than somebody
 * who never received it.
 */
function savedEmailCovers(touches: { step_id: string; outcome?: string; sent_at?: string }[] | undefined): string | null {
  const sent = touches?.find((t) => t.step_id === SAVE_EMAIL_STEP && t.outcome === "sent");
  if (!sent) return null;
  const day = sent.sent_at && Number.isFinite(Date.parse(sent.sent_at))
    ? ` on ${showDay(georgiaDay(new Date(sent.sent_at)), { month: "long", day: "numeric" })}`
    : "";
  return `Not sent: the plan's save email already went out${day} with the same link`;
}

/**
 * Records what became of the "Your Rift plan" save email, on the lead's
 * sequence, as a touch no sequence has a step for.
 *
 * The least invasive place that is also a fact: nothing here changes what the
 * cadence owes, and the unique (enrolment, step) key means a second record
 * for the same enrolment is `recorded: false`, not an error. A lead with no
 * sequence (it could not be enrolled) has nothing to record against, and says
 * so rather than inventing one.
 */
export async function recordSaveEmail(
  leadId: string,
  outcome: "sent" | "skipped" | "failed",
  detail?: string,
): Promise<DbResult<{ recorded: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const e = await boundedRead(db.from("rift_enrolments").select("id").eq("lead_id", leadId).maybeSingle(), "the sequence");
  if (!e.ok) return e;
  const row = ("data" in e ? e.data : null) as { id: string } | null;
  if (!row) return skipped("this lead has no follow-up sequence to record the save email against");
  try {
    const { error } = await db.from("rift_touches").insert({
      enrolment_id: row.id, step_id: SAVE_EMAIL_STEP, channel: "email", outcome, detail: detail ?? null,
    });
    if (error) {
      if (error.code === "23505") return done({ recorded: false });
      return failed(error.message);
    }
    return done({ recorded: true });
  } catch (err) {
    return failed(err);
  }
}

/**
 * What the programs step can be matched against, and when it cannot, why.
 *
 * A saved plan is matched on the page's own profile, which needs every answer
 * the programs check asks; one that lacks them gets no list on its page, so an
 * email listing programs would have nothing to agree with. A v4 readout has
 * only county, ownership and price, so those are all that is matched, and the
 * matcher treats what it was not told (income, household, work) as "needs
 * checking", not as a pass or a fail.
 */
function programsProfile(
  readout: { county: string | null; firstTimeBuyer: boolean; price: number | null } | undefined,
  savedPlan: unknown,
): { profile: Profile; gap: null } | { profile: null; gap: string } {
  if (readout) {
    if (!readout.county) return { profile: null, gap: "no county on their readout to check programs against" };
    if (!readout.price) return { profile: null, gap: "no price on their readout to check programs against" };
    return { profile: { county: readout.county, firstTime: readout.firstTimeBuyer, price: readout.price }, gap: null };
  }
  if (savedPlan) {
    const r = planAssistance(savedPlan);
    if (r.profile) return { profile: r.profile, gap: null };
    return { profile: null, gap: `their saved plan does not have what the programs check needs (missing: ${r.missing.join(", ")})` };
  }
  return { profile: null, gap: "nothing on record to check programs against" };
}

/**
 * The registry as the saved plan page reads it, once for a run: the programs
 * after the reviewers' withdrawals, and the window past which a record is
 * withheld. Most of a cohort is matched against the same book, and it does not
 * change between two people in the same minute.
 */
export interface ProgramBook { programs: ProgramRecord[]; windowDays: number }

export async function programBook(): Promise<ProgramBook> {
  const [{ rules }, programs] = await Promise.all([rulesOrDefaults(await currentAgentId()), currentPrograms()]);
  return { programs, windowDays: rules.registryDays.value };
}

/**
 * The programs this person matches today, for the step that lists them.
 *
 * Through `matchAssistance` with the same profile and the same registry the
 * saved plan page uses, so the email cannot list a program the page says they
 * do not fit. It used to match on county and first-time status alone, which
 * ignores income, household size, price and work: most of what decides it.
 *
 * A fresh match rather than anything stored: this email goes out days after
 * the plan was saved, and a program that has since closed or gone unverified
 * must not arrive in an inbox as something that fits them, for the same
 * reason the page stops showing it. No profile means nothing to match on,
 * which is an empty list, not a guess; the runner records why.
 */
export function matchedPrograms(t: Pick<DueTouch, "profile">, book: ProgramBook, today = new Date()): ProgramLine[] {
  if (!t.profile) return [];
  const r = matchAssistance(t.profile, { today, windowDays: book.windowDays, programs: book.programs });
  return programLines(r.matches.map((m) => toLegacy(m.program)));
}

async function journeyLeads(db: NonNullable<ReturnType<typeof serviceClient>>, agentId: string): Promise<DbResult<Set<string>>> {
  const r = await boundedRead(db.from("rift_journeys").select("origin_lead_id").eq("agent_id", agentId), "the journeys");
  if (!r.ok) return journeyTablesMissing(r.error) ? done(new Set<string>()) : r;
  const list = (("data" in r ? r.data : null) ?? []) as { origin_lead_id: string }[];
  return done(new Set(list.map((x) => x.origin_lead_id)));
}

/**
 * Whether a claimed touch is still owed, read again just before it is sent
 * (AT37).
 *
 * The queue is read once, at the start of a run that can take a minute. A
 * reply the agent records, an opt-out, a journey started or an address changed
 * in that minute must stop the send, not the one after it. The claim is taken
 * first, so this read and the send are milliseconds apart.
 */
export type Owed = { owed: true } | { owed: false; why: string };

export async function stillOwed(t: Pick<DueTouch, "enrolmentId" | "leadId" | "email">): Promise<DbResult<Owed>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const e = await boundedRead(
    db.from("rift_enrolments").select("stopped_at,stop_reason,rift_leads(email)").eq("id", t.enrolmentId).maybeSingle(),
    "the sequence",
  );
  if (!e.ok) return e;
  const row = ("data" in e ? e.data : null) as unknown as {
    stopped_at: string | null; stop_reason: string | null; rift_leads: { email: string | null } | null;
  } | null;
  if (!row) return done({ owed: false, why: "the sequence no longer exists" });
  if (row.stopped_at) return done({ owed: false, why: `the sequence was stopped (${row.stop_reason ?? "no reason given"})` });
  const now = row.rift_leads?.email?.trim().toLowerCase() ?? "";
  if (!now || now !== (t.email ?? "").trim().toLowerCase()) return done({ owed: false, why: "the address changed" });

  const j = await boundedRead(db.from("rift_journeys").select("id").eq("origin_lead_id", t.leadId).limit(1), "the journeys");
  if (!j.ok && !journeyTablesMissing(j.error)) return j;
  if (j.ok && "data" in j && ((j.data as unknown[] | null) ?? []).length) return done({ owed: false, why: "they are now a client with a journey" });
  return done({ owed: true });
}

/**
 * Records that a step went out.
 *
 * Written BEFORE the send, and treated as the lock. If the send then fails the
 * row is updated to `failed` and surfaces as an agent task: which is strictly
 * better than the reverse order, where a crash between sending and recording
 * sends the same message again on the next run.
 */
export async function claimStep(enrolmentId: string, stepId: string, channel: DueTouch["channel"], downgraded: string | null): Promise<DbResult<{ claimed: boolean }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db.from("rift_touches").insert({
      enrolment_id: enrolmentId, step_id: stepId, channel,
      downgraded_reason: downgraded, outcome: "sent",
    });
    if (error) {
      /* A unique violation means somebody else already claimed it. That is the
         constraint doing its job, not a failure. */
      if (error.code === "23505") return done({ claimed: false });
      return failed(error.message);
    }
    return done({ claimed: true });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Records a step as skipped, with why, so it is not owed again tomorrow and
 * the agent can read the reason in the touches table.
 *
 * The same claim-then-mark the send uses, so two workers cannot both record
 * it, and a step already claimed (by a send, or by the other worker) is left
 * as it is: `recorded: false` says nothing was written.
 */
export async function skipStep(
  t: Pick<DueTouch, "enrolmentId" | "stepId" | "channel" | "downgraded">,
  why: string,
): Promise<DbResult<{ recorded: boolean }>> {
  const claim = await claimStep(t.enrolmentId, t.stepId, t.channel, t.downgraded);
  if (!claim.ok || "skipped" in claim) return claim;
  if (!claim.data.claimed) return done({ recorded: false });
  const marked = await markTouch(t.enrolmentId, t.stepId, "skipped", why);
  if (!marked.ok) return marked;
  return done({ recorded: true });
}

export async function markTouch(enrolmentId: string, stepId: string, outcome: "sent" | "skipped" | "failed", detail?: string) {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  try {
    const { error } = await db
      .from("rift_touches")
      .update({ outcome, detail: detail ?? null })
      .eq("enrolment_id", enrolmentId)
      .eq("step_id", stepId);
    if (error) return failed(error.message);
    return done({ ok: true });
  } catch (e) {
    return failed(e);
  }
}
