import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { rulesOrDefaults } from "@/lib/db/settings";
import { readChecks } from "@/lib/db/program-checks";
import { alertSubscribers } from "@/lib/db/saved-plan";
import {
  ATL_AMI, ATL_AMI_SOURCE, FUNDING_TEXT, GEORGIA_PROGRAMS, reviewDue, type LoanType, type ProgramRecord,
} from "@/lib/core/assistance";
import { mayFit } from "@/lib/core/alerts";
import { applyChecks, openFlags } from "@/lib/core/program-check";
import {
  amountView, areaText, buyerStatus, checkLine, formText, historyFor, incomeText, jobsText, priceText,
  REVIEW_LABEL, statusWhy, STATUS_LABEL, type BuyerStatus, type HistoryEntry,
} from "@/lib/core/program-view";
import { money } from "@/lib/core/compute";
import { showDay, showTime } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../../Unavailable";
import { PageHead, Section, Notice, Empty, Facts } from "../../ui";
import { StatusChip, CheckLineText, ReadingWord } from "../parts";
import s from "../programs.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = GEORGIA_PROGRAMS.find((x) => x.slug === slug);
  return { title: p ? `${p.name} · Programs` : "Programs" };
}

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });
/* A quarter of weekly readings; older ones fold away rather than growing the page forever. */
const RECENT = 12;
const LOAN: Record<LoanType, string> = { fha: "FHA", conventional: "Conventional", va: "VA", usda: "USDA" };
const TONE: Record<BuyerStatus, "pos" | "warn" | "info" | "neg"> = { shown: "pos", overdue: "warn", unconfirmed: "info", withdrawn: "neg" };
const COMBINES: Record<ProgramRecord["combines"], string> = {
  yes: "Yes, with other assistance",
  no: "No, used on its own",
  unknown: "Not stated; ask the administrator",
};
const FIRST_TIME: Record<ProgramRecord["firstTime"], string> = {
  required: "Required",
  "not-required": "Not required",
  "not-stated": "Not stated on the program's page",
};

/**
 * One program (Blueprint v5 §6.2, §6.5): everything its record holds, whether
 * a buyer sees it and why, and every reading of its official page with the
 * review that answered it. Nothing here is estimated: a field the record does
 * not hold is said to be missing, never filled in.
 */
export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const { slug } = await params;
  const written = GEORGIA_PROGRAMS.find((p) => p.slug === slug);
  if (!written) notFound();

  const [{ rules }, read, subsRead] = await Promise.all([rulesOrDefaults(agent.agentId), readChecks(), alertSubscribers()]);
  const window = rules.registryDays.value;
  const today = new Date();
  const data = read.ok && "data" in read ? read.data : null;
  const checks = data?.checks ?? [];
  const reviews = data?.reviews ?? [];
  const p = applyChecks([written], checks, reviews)[0]!;
  const flag = openFlags([written], checks, reviews)[0] ?? null;
  const status = buyerStatus(p, today, window);
  const line = checkLine(p, today, window, flag?.check.outcome ?? null);
  const amt = amountView(p);
  const history = historyFor(p.sourceUrl, checks, reviews);
  const sharing = GEORGIA_PROGRAMS.filter((x) => x.sourceUrl === p.sourceUrl && x.slug !== p.slug);
  const alternatives = p.group ? GEORGIA_PROGRAMS.filter((x) => x.group === p.group && x.slug !== p.slug) : [];

  /* Only people who asked for program alerts have their answers saved in a
     form this can check; everyone else is not counted, and the panel says so. */
  const subs = subsRead.ok && "data" in subsRead ? subsRead.data : null;
  const fit = subs ? subs.filter((x) => mayFit(p, x.plan)) : [];
  /* A record nobody has confirmed holds almost no rules, so everyone "may
     fit" it; a count there would be a number that means nothing. Its form
     and funding are what it was found as, not what its administrator says. */
  const unconfirmed = status === "unconfirmed";
  const hasFigure = amt.counted > 0 || Boolean(p.amount.pctOfLoan);

  return (
    <main className="shell-w">
      <PageHead
        back={{ href: "/operations/programs", label: "Programs" }}
        title={p.name}
        lede={p.administrator}
        meta={<><StatusChip status={status} />{unconfirmed ? null : <><span className="chip">{formText(p)}</span><span className="chip chip-out">{FUNDING_TEXT[p.funding]}</span></>}</>}
        actions={<a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">Official page<Ico.arrowUpR size={12} /></a>}
      />

      {flag ? (
        <Notice tone="warn" title={flag.check.outcome === "changed" ? "Its official page changed" : "Its official page could not be read"}
          action={<Link href={`/operations/programs#flag-${flag.check.id}`} className="btn btn-p btn-sm">Review it</Link>}>
          Read {DAY(flag.check.checkedAt)}. The record is not renewed until you say whether it is still right.
        </Notice>
      ) : null}
      <Notice tone={TONE[status]} title={STATUS_LABEL[status]}>
        {statusWhy(p, today, window)}
        {/* With a flag open the notice above already says what the line would. */}
        {flag ? null : <> <CheckLineText text={line.text} tone={line.tone} /></>}
      </Notice>

      <div className={s.detail}>
        <div>
          <Section title="Amount">
            <div className={s.hero}>
              <div>
                {hasFigure ? <div className={s.upto}>Up to</div> : null}
                <div className={`${s.heroFigure}${hasFigure ? "" : ` ${s.figureNone}`}`}>{amt.headline}</div>
              </div>
              {amt.basis ? <div className={s.heroSide}>{amt.basis}</div> : null}
            </div>
            <div className={s.body}>
              <Facts cols={2} items={[
                ["Form", unconfirmed ? `${formText(p)}, as found; not confirmed` : formText(p)],
                ["Higher amount for some jobs", amt.higher
                  ? <>Up to {amt.higher.text}{amt.higher.counted ? null : <span className={s.higherNot}> (mentioned, not counted)</span>}</>
                  : "None on the record"],
              ]} />
              {p.amount.occupations ? <p className={`${s.small} mt-3`}>{p.amount.occupations.note}{p.amount.occupations.confirm ? " A buyer's estimate never uses the higher amount, because their answers cannot settle who counts." : ""}</p> : null}
              <div className="mt-3">
                <div className={s.panelTitle}>Terms</div>
                <p className={`${s.prose} mt-1`}>{p.terms}</p>
              </div>
            </div>
          </Section>

          <Section title="Who it is for">
            <div className={s.body}>
              <Facts cols={2} items={[
                ["Where", <>{areaText(p)}{p.area.within && p.area.counties.length ? <div className={s.small}>{p.area.counties.join(" and ")} {p.area.counties.length === 1 ? "County" : "counties"}</div> : null}</>],
                ["First-time buyer", <>{FIRST_TIME[p.firstTime]}{p.firstTimeNote ? <div className={s.small}>{p.firstTimeNote}</div> : null}</>],
                ["Income limit", <>{incomeText(p) ?? "Not stated on the program's page"}{p.income.kind !== "not-stated" && p.income.note ? <div className={s.small}>{p.income.note}</div> : null}</>],
                ["Price limit", <>{priceText(p) ?? "None stated"}{p.price?.note ? <div className={s.small}>{p.price.note}</div> : null}</>],
                ["Credit score", p.minCredit ? <>{p.minCredit.score} or higher{p.minCredit.note ? <div className={s.small}>{p.minCredit.note}</div> : null}</> : "Not stated"],
                ["Loan types", p.loanTypes ? p.loanTypes.map((l) => LOAN[l]).join(", ") : "Not stated"],
                ...(p.onlyFor ? [["Only for", <>{jobsText(p.onlyFor.who)}<div className={s.small}>{p.onlyFor.note}</div></>] as [React.ReactNode, React.ReactNode]] : []),
                ...(p.alsoCheck ? [["Also needs", p.alsoCheck] as [React.ReactNode, React.ReactNode]] : []),
              ]} />
              {p.income.kind === "ami" ? (
                <div className={s.scroll}>
                  <table className={s.amiTable}>
                    <caption className="sr-only">Income limit by household size</caption>
                    <thead><tr><th scope="col">Household</th>{ATL_AMI[p.income.pct].map((_, i) => <th key={i} scope="col">{i + 1} {i === 0 ? "person" : "people"}</th>)}</tr></thead>
                    <tbody><tr><td>{p.income.pct}% of median</td>{ATL_AMI[p.income.pct].map((n, i) => <td key={i}>{money(n)}</td>)}</tr></tbody>
                  </table>
                  <p className={`${s.small} mt-2`}>Atlanta-area limits as <a href={ATL_AMI_SOURCE} target="_blank" rel="noopener noreferrer" className="u">Invest Atlanta publishes them</a>. Six or more people is not on the table, so it needs checking.</p>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="How to use it">
            <div className={s.body}>
              {p.conditions.length ? (
                <ul className={s.list}>{p.conditions.map((c) => <li key={c}><Ico.check size={13} />{c}</li>)}</ul>
              ) : <p className={s.small}>No conditions on the record yet.</p>}
              <div className="mt-4">
                <Facts cols={2} items={[
                  ["Combines with other help", <>{COMBINES[p.combines]}{p.combinesNote ? <div className={s.small}>{p.combinesNote}</div> : null}</>],
                  ["Funding", <>{unconfirmed ? "Not confirmed" : FUNDING_TEXT[p.funding]}{p.fundingNote ? <div className={s.small}>{p.fundingNote}</div> : null}</>],
                  ["Who confirms eligibility", p.administrator],
                  ["Instead of", alternatives.length
                    ? <>{alternatives.map((x, i) => <span key={x.slug}>{i ? ", " : ""}<Link href={`/operations/programs/${x.slug}`} className="u">{x.name}</Link></span>)}<div className={s.small}>Only one of these can be used.</div></>
                    : "Nothing; it is not one of a set"],
                ]} />
              </div>
            </div>
          </Section>

          <Section title="Check history" hint={`Every weekly reading of the official page${sharing.length ? `, which it shares with ${sharing.map((x) => x.name).join(", ")}` : ""}, and the review that answered it.`}>
            {!read.ok ? (
              <Notice tone="neg" title="The readings did not load">{read.error}. That is not the same as there being none.</Notice>
            ) : "skipped" in read ? (
              <Notice tone="info" title="Nothing is recorded on this deployment">{read.reason}.</Notice>
            ) : data === null ? (
              <Notice tone="warn" title="Program checks are not recorded yet">Apply the migration 20260926030000_rift_program_checks.sql. Until then the record stands on the day it was written.</Notice>
            ) : history.length ? (
              <div className={s.body}>
                <ol className={s.history}>
                  {history.slice(0, RECENT).map(({ check, review }) => <Reading key={check.id} check={check} review={review} waiting={flag?.check.id === check.id} />)}
                </ol>
                {history.length > RECENT ? (
                  <details className={s.more}>
                    <summary>{history.length - RECENT} earlier {history.length - RECENT === 1 ? "reading" : "readings"}</summary>
                    <ol className={`${s.history} mt-3`}>
                      {history.slice(RECENT).map(({ check, review }) => <Reading key={check.id} check={check} review={review} waiting={flag?.check.id === check.id} />)}
                    </ol>
                  </details>
                ) : null}
              </div>
            ) : (
              <Empty title="Not read yet">The weekly check reads this page on Monday.</Empty>
            )}
          </Section>
        </div>

        <aside className={s.aside}>
          <div className={s.panel}>
            <div className={s.panelTitle}>People who may fit</div>
            {unconfirmed ? (
              <p className={s.panelText}>Not counted: nothing is confirmed about who this program is for.</p>
            ) : subs === null ? (
              <p className={s.panelText}>Could not be counted: {subsRead.ok ? ("reason" in subsRead ? subsRead.reason : "no data") : subsRead.error}.</p>
            ) : (
              <>
                <div className={s.panelBig}>{fit.length}</div>
                <p className={s.panelText}>
                  Of the {subs.length} {subs.length === 1 ? "person" : "people"} who asked for program alerts, going by their saved answers.
                  Leads who did not ask are not counted.
                </p>
                {fit.length ? (
                  <ul className={s.people}>{fit.slice(0, 12).map((x) => <li key={x.leadId}><Link href={`/operations/lead/${x.leadId}`} className="chip">{x.name ?? "Unnamed"}</Link></li>)}</ul>
                ) : null}
                {fit.length > 12 ? <p className={s.panelText}>And {fit.length - 12} more.</p> : null}
              </>
            )}
          </div>

          <div className={s.panel}>
            <div className={s.panelTitle}>Source</div>
            <p className="mt-2"><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="u t-sm">{p.sourceName}</a></p>
            <div className="mt-3">
              <Facts cols={1} items={[
                ["Record written from the page", DAY(written.checkedOn)],
                ...(p.sourceDated ? [["Dated on the source", DAY(p.sourceDated)] as [React.ReactNode, React.ReactNode]] : []),
                ...(p.status === "active" ? [
                  ["Last confirmed", DAY(p.checkedOn)] as [React.ReactNode, React.ReactNode],
                  ["Withheld if not confirmed by", DAY(reviewDue(p, window))] as [React.ReactNode, React.ReactNode],
                ] : []),
              ]} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Reading({ check, review, waiting }: HistoryEntry & { waiting: boolean }) {
  return (
    <li className={s.event}>
      <div className={s.when}>{DAY(check.checkedAt)}</div>
      <div>
        <ReadingWord outcome={check.outcome} />
        {check.detail ? <div className={s.small}>{check.detail}</div> : null}
        {review ? (
          <div className={s.review}>
            <span className="w6">{REVIEW_LABEL[review.outcome]}</span>, said {review.reviewedBy} on {showTime(review.reviewedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {review.note ? <div className="c-3 mt-1">&ldquo;{review.note}&rdquo;</div> : null}
          </div>
        ) : check.outcome === "changed" || check.outcome === "unreachable" ? (
          <div className={s.small}>Not reviewed{waiting ? "; waiting for you" : ""}</div>
        ) : null}
      </div>
    </li>
  );
}
