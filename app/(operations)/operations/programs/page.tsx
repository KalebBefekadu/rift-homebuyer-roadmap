import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { rulesOrDefaults } from "@/lib/db/settings";
import { readChecks } from "@/lib/db/program-checks";
import { jobsHealth } from "@/lib/db/jobs";
import { GEORGIA_PROGRAMS, type ProgramRecord } from "@/lib/core/assistance";
import { mayFit } from "@/lib/core/alerts";
import { alertSubscribers } from "@/lib/db/saved-plan";
import { applyChecks, openFlags, textDiff, type CheckOutcome, type Flag } from "@/lib/core/program-check";
import {
  amountView, areaText, buyerStatus, changeView, checkLine, formText, groupByArea, keyRules, largestShown,
  STATUS_ORDER, type BuyerStatus,
} from "@/lib/core/program-view";
import { money } from "@/lib/core/compute";
import { showDay } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { PageHead, Section, Notice, Empty, Stat, Stats, Tabs } from "../ui";
import { ReviewForm, PrepareAlerts } from "./Review";
import { StatusChip, CheckLineText } from "./parts";
import s from "./programs.module.css";

export const metadata: Metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });

/* Withheld is one view for two causes: aged out, or stopped by a person. Both
   mean a buyer does not see it and the agent has something to do. */
const SHOW = [
  { id: "all", label: "All", has: (): boolean => true },
  { id: "shown", label: "Shown", has: (x: BuyerStatus) => x === "shown" },
  { id: "withheld", label: "Withheld", has: (x: BuyerStatus) => x === "overdue" || x === "withdrawn" },
  { id: "unconfirmed", label: "Not confirmed", has: (x: BuyerStatus) => x === "unconfirmed" },
] as const;

/**
 * Programs (Blueprint v5 §6.5, §8.4): the Georgia assistance records, whether
 * buyers see each one, and the official pages that changed and need a person.
 *
 * What needs doing is at the top; below it every program as a card with the
 * amount, the rules that decide most cases, one status and one line about
 * checking. The dates behind that line are on the program's own page.
 */
export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const show = (await searchParams).show;
  const view = SHOW.find((x) => x.id === show) ?? SHOW[0];

  const [{ rules }, read, jobs, subsRead] = await Promise.all([rulesOrDefaults(agent.agentId), readChecks({ withText: true }), jobsHealth(), alertSubscribers()]);
  const subs = subsRead.ok && "data" in subsRead ? subsRead.data : [];
  const window = rules.registryDays.value;
  const today = new Date();
  const data = read.ok && "data" in read ? read.data : null;
  const tracked = data !== null;
  const checks = data?.checks ?? [];
  const reviews = data?.reviews ?? [];
  const records = applyChecks(GEORGIA_PROGRAMS, checks, reviews);
  const flags = openFlags(GEORGIA_PROGRAMS, checks, reviews);
  const job = jobs.ok && "data" in jobs && jobs.data ? jobs.data.find((j) => j.job === "program-check") : null;

  const flagOf = new Map<string, CheckOutcome>();
  for (const f of flags) for (const p of f.programs) flagOf.set(p.slug, f.check.outcome);
  const status = new Map(records.map((p) => [p.slug, buyerStatus(p, today, window)]));
  const count = (st: BuyerStatus) => records.filter((p) => status.get(p.slug) === st).length;
  const shown = count("shown");
  const overdue = count("overdue");
  const withdrawn = count("withdrawn");
  const best = largestShown(records, today, window);

  const visible = records
    .filter((p) => view.has(status.get(p.slug)!))
    .sort((a, b) => STATUS_ORDER[status.get(a.slug)!] - STATUS_ORDER[status.get(b.slug)!] || amountView(b).counted - amountView(a).counted);

  return (
    <main className="shell-w">
      <PageHead
        title="Programs"
        lede={<>Georgia down payment programs, whether buyers see each one, and the official pages that changed. Rift reads every page each Monday; a program not confirmed within {window} days is withheld from buyers.</>}
      />

      {!tracked ? (
        <Notice tone="warn" title="Program checks are not recorded yet">
          {read.ok ? "The tables for them do not exist on this database. Apply the migration 20260926030000_rift_program_checks.sql." : `The checks did not load: ${read.error}.`}
          {" "}Until then each program stands on the date it was written, and ages out on schedule.
        </Notice>
      ) : job?.problem ? (
        <Notice tone="neg" title="The weekly check needs you">{job.problem}</Notice>
      ) : null}

      <Stats>
        <Stat label="Shown to buyers" value={`${shown} of ${records.length}`} hint={shown === records.length ? "Every program" : `${records.length - shown} not shown`} href="/operations/programs?show=shown" />
        <Stat label="Needs your review" value={tracked ? flags.length : "Not tracked"} tone={flags.length ? "warn" : undefined}
          hint={!tracked ? "Checks are not recorded" : flags.length ? flagHint(flags) : "Nothing waiting"}
          href={flags.length ? "#review" : undefined} />
        <Stat label="Withheld" value={overdue + withdrawn} tone={overdue + withdrawn ? "warn" : undefined}
          hint={overdue + withdrawn ? [overdue ? `${overdue} overdue` : "", withdrawn ? `${withdrawn} withdrawn` : ""].filter(Boolean).join(", ") : "None"}
          href={overdue + withdrawn ? "/operations/programs?show=withheld" : undefined} />
        <Stat label="Largest available" value={best ? money(best.amount) : "None"} hint={best ? best.program.name : "No program is shown to buyers"}
          href={best ? `/operations/programs/${best.program.slug}` : undefined} />
      </Stats>

      {flags.length ? (
        <Section id="review" title="Needs your review" hint="The weekly check found these official pages changed or unreachable. Each program stays unrenewed until you answer.">
          <div className={s.flags}>{flags.map((f) => <FlagCard key={f.check.id} f={f} subs={subs.filter((x) => f.programs.some((p) => mayFit(p, x.plan)))} agentName={agent.name} />)}</div>
        </Section>
      ) : tracked ? (
        <Notice tone="pos" title="Nothing needs your review">Every page read so far matches its last reading, or has been reviewed.</Notice>
      ) : null}

      {/* The wrapper lets the view tabs scroll inside a phone's width instead
          of pushing the page sideways; the kit's actions never shrink. */}
      <div className={s.fit}>
        <Section
          title="Every program"
          hint={<>Open one for its rules, terms and every reading of its page. The re-check window is a <Link href="/operations/settings" className="u">setting</Link>.</>}
          actions={<Tabs label="Which programs" current={view.id} items={SHOW.map((x) => ({
            id: x.id, label: x.label, href: x.id === "all" ? "/operations/programs" : `/operations/programs?show=${x.id}`,
            count: records.filter((p) => x.has(status.get(p.slug)!)).length,
          }))} />}
        >
          {visible.length ? groupByArea(visible).map((g) => (
            <div key={g.key} className={s.group}>
              <div className={s.groupHead}><h3 className={s.groupTitle}>{g.label}</h3><span className={s.groupCount}>{g.programs.length}</span></div>
              <div className={s.grid}>
                {g.programs.map((p) => <ProgramCard key={p.slug} p={p} status={status.get(p.slug)!} line={checkLine(p, today, window, flagOf.get(p.slug) ?? null)} />)}
              </div>
            </div>
          )) : (
            <Empty title="No programs in this view">
              <Link href="/operations/programs" className="u">Show every program</Link>
            </Empty>
          )}
        </Section>
      </div>

      <p className={s.footnote}>
        Records are kept in <span className="mono">lib/core/assistance.ts</span>, written from each program&apos;s own page.
        Editing one and deploying it clears a withdrawal.
      </p>
    </main>
  );
}

function ProgramCard({ p, status, line }: { p: ProgramRecord; status: BuyerStatus; line: ReturnType<typeof checkLine> }) {
  const amt = amountView(p);
  const rules = keyRules(p);
  const hasFigure = amt.counted > 0 || Boolean(p.amount.pctOfLoan);
  return (
    <Link href={`/operations/programs/${p.slug}`} className={`${s.card}${status === "unconfirmed" ? ` ${s.cardMuted}` : ""}`}>
      <div>
        <div className={s.name}>{p.name}</div>
        <div className={s.who}>{p.administrator}</div>
      </div>

      <div>
        <div className={s.money}>
          <div>
            {hasFigure ? <div className={s.upto}>Up to</div> : null}
            <div className={`${s.figure}${hasFigure ? "" : ` ${s.figureNone}`}`}>{amt.headline}</div>
          </div>
          {/* An unconfirmed record's form is what it was found as, not what the administrator says. */}
          {status === "unconfirmed" ? null : <span className={s.form}>{formText(p)}</span>}
        </div>
        {amt.basis ? <div className={s.basis}>{amt.basis}</div> : null}
        {amt.higher ? (
          <div className={s.higher}>
            {amt.higher.counted ? <>Up to {amt.higher.text}</> : <>Up to {amt.higher.text} <span className={s.higherNot}>(mentioned, not counted)</span></>}
          </div>
        ) : null}
      </div>

      <div className={s.area}><Ico.pin size={13} /><span className={s.clamp} title={p.area.within}>{areaText(p)}</span></div>

      {rules.length ? <ul className={s.rules}>{rules.map((r) => <li key={r}>{r}</li>)}</ul> : null}

      <div className={s.cardFoot}>
        <div className={s.footStates}>
          <StatusChip status={status} />
          <CheckLineText text={line.text} tone={line.tone} />
        </div>
        <Ico.chevR size={15} className={s.go} />
      </div>
    </Link>
  );
}

/** "1 page changed, 1 could not be read": an unreachable page is not a change, and the two ask different things of the agent. */
function flagHint(flags: Flag[]): string {
  const changed = flags.filter((f) => f.check.outcome === "changed").length;
  const unread = flags.length - changed;
  const page = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  return [changed ? `${page(changed)} changed` : "", unread ? `${page(unread)} could not be read` : ""].filter(Boolean).join(", ");
}

function DiffColumns({ removed, added }: { removed: string[]; added: string[] }) {
  return (
    <div className={s.diff}>
      <div className={`${s.diffCol} ${s.removed}`}>
        <div className={s.boxTitle}>No longer on the page</div>
        <ul>{removed.length ? removed.map((l, i) => <li key={i}>− {l}</li>) : <li className="c-4">Nothing removed</li>}</ul>
      </div>
      <div className={`${s.diffCol} ${s.added}`}>
        <div className={s.boxTitle}>New on the page</div>
        <ul>{added.length ? added.map((l, i) => <li key={i}>+ {l}</li>) : <li className="c-4">Nothing added</li>}</ul>
      </div>
    </div>
  );
}

type Sub = { leadId: string; name: string | null };

function FlagCard({ f, subs, agentName }: { f: Flag; subs: Sub[]; agentName: string }) {
  /* A generous limit: the filter below needs every changed line to find the
     one that matters, and "show all" should mean all. */
  const change = changeView(textDiff(f.before?.text ?? null, f.check.text, 400));
  return (
    <article className={s.flag} id={`flag-${f.check.id}`}>
      <div className={s.flagHead}>
        <div>
          <div className={s.flagNames}>
            {f.programs.map((p) => <Link key={p.slug} href={`/operations/programs/${p.slug}`}>{p.name}</Link>)}
          </div>
          <div className={s.flagWhen}>
            <CheckLineText tone="warn" text={f.check.outcome === "unreachable"
              ? `Could not be read on ${DAY(f.check.checkedAt)}: ${f.check.detail ?? "no reason given"}`
              : `Changed since ${f.before ? DAY(f.before.checkedAt) : "the last reading"}; read ${DAY(f.check.checkedAt)}`} />
          </div>
        </div>
        <a href={f.check.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">Open the official page<Ico.arrowUpR size={12} /></a>
      </div>

      {f.check.summary ? (
        <div className={s.box}>
          <div className={s.boxTitle}>What the automatic comparison found (check it on the page)</div>
          <p className={s.boxText}>{f.check.summary}</p>
        </div>
      ) : null}

      {f.check.outcome === "changed" ? (
        f.check.text === null ? (
          <p className={`${s.small} mt-3`}>This source is a PDF, so there is no text to compare. Open it and check the amounts, limits and dates against the record.</p>
        ) : change.total ? (
          <>
            {change.removed.length || change.added.length ? (
              <>
                <div className={`${s.boxTitle} mt-3`}>Changed lines that mention an amount, a date, a limit, who can apply or funding</div>
                <DiffColumns removed={change.removed} added={change.added} />
              </>
            ) : (
              <p className={`${s.small} mt-3`}>None of the {change.total} changed lines mention an amount, a date, a limit, who can apply or funding. It is most likely the site&apos;s menu or layout; the full list is below.</p>
            )}
            {/* Everything else stays one click away: the filter decides what is
                read first, never what can be seen. */}
            <details className={s.more}>
              <summary>Show all {change.total} changed {change.total === 1 ? "line" : "lines"}</summary>
              <DiffColumns removed={change.all.removed} added={change.all.added} />
            </details>
          </>
        ) : (
          <p className={`${s.small} mt-3`}>Only the order or spacing of the text changed.</p>
        )
      ) : null}

      {subs.length ? (
        <div className={s.box}>
          <div className={s.boxTitle}>{subs.length === 1 ? "One person asked" : `${subs.length} people asked`} to hear when a program they may fit changes</div>
          <p className={s.small}>Rift can prepare an email to each; every one waits in your Outbox until you approve it (D04).</p>
          <ul className={s.people}>
            {subs.map((x) => <li key={x.leadId}><Link href={`/operations/lead/${x.leadId}`} className="chip">{x.name ?? "Unnamed"}</Link></li>)}
          </ul>
          <PrepareAlerts checkId={f.check.id} />
        </div>
      ) : null}

      <ReviewForm checkId={f.check.id} agentName={agentName} />
    </article>
  );
}
