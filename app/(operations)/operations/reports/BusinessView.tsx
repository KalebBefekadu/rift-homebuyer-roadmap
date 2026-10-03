import Link from "next/link";
import { money } from "@/lib/core/compute";
import { showDay, showTime } from "@/lib/core/day";
import { valueLadder } from "@/lib/core/ladder";
import { valueById } from "@/lib/core/values";
import { outcomesFrom, type Basis } from "@/lib/core/pipeline";
import { businessFunnel, bySource, liveOf, pipelineOf, type Period } from "@/lib/core/business-report";
import { businessRead } from "@/lib/db/business-report";
import { conversionCounts, ladderEvents } from "@/lib/db/events";
import { finishedRelationships } from "@/lib/db/clients";
import { rulesOrDefaults } from "@/lib/db/settings";
import { Notice, Empty, Section, Stats, Stat } from "../ui";
import { Tag, type TagTone } from "../_business/Tag";
import k from "../_business/kit.module.css";
import { say } from "../_business/say";
import s from "./reports.module.css";

const BASIS: Record<Basis, { word: string; tone: TagTone; title: string }> = {
  assumed: { word: "Assumed", tone: "warn", title: "A starting figure: too few of your own closed or lost outcomes at this stage to use yours." },
  blended: { word: "Part observed", tone: "none", title: "Your own history pulled toward the starting figure until there are twelve outcomes." },
  observed: { word: "From your history", tone: "pos", title: "Twelve or more of your own outcomes at this stage." },
};

const pct = (n: number) => `${n}%`;

/**
 * The business: how many people arrived, where from, how far they got, and
 * what the people in play are worth. Every figure says its period and what it
 * counts (lib/core/business-report.ts has the rules); a read that fails says
 * which one, never an empty table.
 */
export async function BusinessView({ days, agentId, now }: { days: Period; agentId: string; now: Date }) {
  const [read, ladderRead, convRead, finished, rules] = await Promise.all([
    businessRead(), ladderEvents(days), conversionCounts(days), finishedRelationships(), rulesOrDefaults(agentId),
  ]);

  if (!read.ok) {
    return <Notice tone="neg" title="The business figures did not load">{say(read.error)} That is not the same as there being no leads.</Notice>;
  }
  if (!("data" in read)) return <Notice tone="info" title="Nothing to read from">{read.reason}.</Notice>;

  const { leads, attributions, truncated } = read.data;
  const ladder = ladderRead.ok && "data" in ladderRead ? valueLadder(ladderRead.data) : null;
  const conv = convRead.ok && "data" in convRead ? convRead.data : null;
  const history = finished.ok && "data" in finished ? outcomesFrom(finished.data) : [];

  const funnel = businessFunnel({ leads, attributions, finishedOne: ladder ? ladder.finishedOne : null, days, now });
  const sources = bySource({ leads, attributions, days, now });
  const commissionPct = rules.rules.commissionPct.value;
  const assumed = rules.undecided.includes("commissionPct");
  const pipe = pipelineOf(liveOf(leads), history, commissionPct);
  const top = Math.max(1, ...funnel.steps.map((st) => st.count ?? 0));
  const since = showDay(funnel.sinceDay, { month: "short", day: "numeric", year: "numeric" });
  const period = `${days === 365 ? "12 months" : `${days} days`}, since ${since}`;

  return (
    <>
      {truncated ? <Notice tone="warn" title="Some records reached the report's reading limit">The counts below may be short.</Notice> : null}

      <Section
        title="From visitor to closed"
        hint={`Period: ${period}. Visitors and "finished a value" are browser sessions in the period; the rest follow the people who arrived as leads in it, as far as they have got so far.`}
      >
        <div className={k.tableCard}>
          <table className={`${k.table} ${k.stack}`}>
            <thead><tr><th>Step</th><th className="num">Count</th><th className="num">Share of the step before</th><th>What it counts</th></tr></thead>
            <tbody>
              {funnel.steps.map((st) => (
                <tr key={st.id}>
                  <td data-label="Step" className={k.strong}>{st.label}</td>
                  <td data-label="Count" className="num">
                    {st.count === null ? <span className={s.unknown}>Did not load</span> : (
                      <>
                        <span className={s.stepCount}>{st.count.toLocaleString("en-US")}</span>
                        <span className={s.bar} aria-hidden><span className={s.barFill} style={{ width: `${Math.round(((st.count ?? 0) / top) * 100)}%` }} /></span>
                      </>
                    )}
                  </td>
                  <td data-label="Share" className="num">
                    {st.rate ? `${pct(st.rate.pct)} of ${st.rate.of}` : <span className={k.muted}>{st.id === "visitors" ? "Where it starts" : "Not enough to say"}</span>}
                  </td>
                  <td data-label="Counts" className={s.stepWhat}>{st.counts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.foot}>
          <p>
            {funnel.addedByHand
              ? `${funnel.addedByHand} ${funnel.addedByHand === 1 ? "person was" : "people were"} added by hand in the same period. They did not arrive as visitors, so they are not in these steps; they are in the next table. `
              : ""}
            Someone who arrived last week has had little time to be taken on, so a recent period reads lower than it will.
          </p>
          {ladder && ladder.finishedOne > (funnel.steps[0]?.count ?? 0) ? (
            <p>
              More sessions finished a value ({ladder.finishedOne}) than have a recorded first visit ({funnel.steps[0]?.count}), so visit
              tracking missed some. Read visitors as a floor, and the shares that depend on it as not enough to say.
            </p>
          ) : null}
          <p>
            Closings in this period, counted by the day they closed: {funnel.closings.count}
            {funnel.closings.count ? ` (${funnel.closings.priced} with a recorded price, ${money(funnel.closings.volume)} in volume)` : ""}.
            {conv ? ` Of the visitors who finished a value, ${conv.savedPlans} saved a plan and ${conv.callRequests} asked for a call (a call asked for is not a call confirmed).` : ""}
          </p>
        </div>
      </Section>

      <Section title="Where leads come from" hint={`Period: ${period}. A lead is counted under the visit that first brought its browser in; leads with no recorded visit are "Direct or unknown", not left out.`}>
        {sources.length ? (
          <div className={k.tableCard}>
            <table className={`${k.table} ${k.stack}`}>
              <thead><tr><th>Source</th><th className="num">Visitors</th><th className="num">Leads</th><th className="num">Taken on</th><th className="num">Closed</th><th className="num">Visitors who became leads</th></tr></thead>
              <tbody>
                {sources.map((r) => (
                  <tr key={r.channel}>
                    <td data-label="Source" className={k.strong}>{r.channel}</td>
                    <td data-label="Visitors" className="num">{r.visitors}</td>
                    <td data-label="Leads" className="num">{r.leads}</td>
                    <td data-label="Taken on" className="num">{r.clients}</td>
                    <td data-label="Closed" className="num">{r.closed}</td>
                    <td data-label="Became leads" className="num">{r.rate === null ? <span className={k.muted}>{r.visitors === 0 ? "No visitors counted" : "Not enough to say"}</span> : pct(r.rate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td data-label="Source">All</td>
                  <td data-label="Visitors" className="num">{sources.reduce((a, r) => a + r.visitors, 0)}</td>
                  <td data-label="Leads" className="num">{sources.reduce((a, r) => a + r.leads, 0)}</td>
                  <td data-label="Taken on" className="num">{sources.reduce((a, r) => a + r.clients, 0)}</td>
                  <td data-label="Closed" className="num">{sources.reduce((a, r) => a + r.closed, 0)}</td>
                  <td data-label="" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty title="No visits or leads in this period">Visits are counted from the first page a browser opens; leads when someone leaves a way to reach them.</Empty>
        )}
      </Section>

      <Section
        title="What the pipeline is worth"
        hint={`Now, not a period: ${pipe.people} ${pipe.people === 1 ? "person" : "people"} you are working with who have not closed or been lost. Expected commission is a planning figure: each stage's deal volume weighted by how often that stage closes, at your commission setting.`}
      >
        {!finished.ok ? <Notice tone="warn" title="Your closed history did not load">Every stage is shown with its starting odds, labelled Assumed, until it does.</Notice> : null}
        {assumed ? (
          <Notice tone="warn" title={`Commission is ${commissionPct}%, the default`} action={<Link href="/operations/settings" className="btn btn-g btn-sm">Set it</Link>}>
            You have not decided this yet. It is the only number that turns the pipeline into money, so the dollar figures below are only as good as it is.
          </Notice>
        ) : null}
        {pipe.people === 0 ? (
          <Empty title="Nobody is in play">A person appears here once you give them a stage on their record, and leaves it when they close or are lost.</Empty>
        ) : (
          <>
            <Stats>
              <Stat label="Expected commission" value={money(Math.round(pipe.commission))} hint={`Weighted by stage, at ${commissionPct}%${assumed ? " (default)" : ""}`} />
              <Stat label="Deal volume" value={money(pipe.value)} hint={`${pipe.priced} of ${pipe.people} have a recorded price`} />
              <Stat label="Weighted volume" value={money(Math.round(pipe.weighted))} hint="Volume times each stage's chance to close" />
              <Stat label="Closed in this period" value={funnel.closings.count} hint={funnel.closings.priced ? `${money(Math.round((funnel.closings.volume * commissionPct) / 100))} at ${commissionPct}%` : "No recorded price to value"} />
            </Stats>
            <div className={k.tableCard}>
              <table className={`${k.table} ${k.stack}`}>
                <thead><tr><th>Stage</th><th className="num">People</th><th className="num">Priced</th><th className="num">Deal volume</th><th>Chance to close</th><th className="num">Weighted volume</th><th className="num">Expected commission</th></tr></thead>
                <tbody>
                  {pipe.stages.map((st) => (
                    <tr key={st.stage}>
                      <td data-label="Stage" className={k.strong}>{st.stage}</td>
                      <td data-label="People" className="num">{st.people}</td>
                      <td data-label="Priced" className="num">{st.priced}</td>
                      <td data-label="Volume" className="num">{st.priced ? money(st.value) : <span className={k.muted}>None priced</span>}</td>
                      <td data-label="Chance"><span title={BASIS[st.basis].title}>{Math.round(st.weight * 100)}% </span><Tag tone={BASIS[st.basis].tone} title={BASIS[st.basis].title}>{BASIS[st.basis].word}</Tag></td>
                      <td data-label="Weighted" className="num">{money(Math.round(st.weighted))}</td>
                      <td data-label="Commission" className="num">{money(Math.round(st.commission))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Stage">All stages</td>
                    <td data-label="People" className="num">{pipe.people}</td>
                    <td data-label="Priced" className="num">{pipe.priced}</td>
                    <td data-label="Volume" className="num">{money(pipe.value)}</td>
                    <td data-label="" />
                    <td data-label="Weighted" className="num">{money(Math.round(pipe.weighted))}</td>
                    <td data-label="Commission" className="num">{money(Math.round(pipe.commission))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className={s.foot}>
              {pipe.unpriced ? <p>{pipe.unpriced} {pipe.unpriced === 1 ? "person has" : "people have"} no price on record, so they are counted as people and add nothing to the money.</p> : null}
              <p>A planning figure, not a receivable: commission varies by agreement.</p>
            </div>
          </>
        )}
      </Section>

      <Section title="What visitors do on the site" hint={`Period: ${days === 365 ? "12 months" : `${days} days`}. A visitor is a browser session; this counts what was opened and answered, never what was answered with.`}>
        {!ladder ? (
          <Notice tone="neg" title="The value counts did not load">{ladderRead.ok ? ("reason" in ladderRead ? ladderRead.reason : "") : `${say(ladderRead.error)} That is not the same as nobody visiting.`}</Notice>
        ) : (
          <>
            <p className={s.kv}>
              {ladder.finishedOne
                ? `${ladder.finishedOne} ${ladder.finishedOne === 1 ? "visitor" : "visitors"} finished a value; ${ladder.finishedTwo} of them went on to a second (${Math.round((ladder.rate ?? 0) * 100)}%).`
                : "Nobody has finished a value in this period."}
            </p>
            {ladder.byValue.length ? (
              <div className={k.tableCard} style={{ marginTop: 10 }}>
                <table className={k.table}>
                  <thead><tr><th>Value</th><th className="num">Opened</th><th className="num">Answered</th></tr></thead>
                  <tbody>
                    {ladder.byValue.map((v) => (
                      <tr key={v.tool}><td>{valueById(v.tool)?.name ?? v.tool}</td><td className="num">{v.opened}</td><td className="num">{v.finished}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Section>

      <p className={s.foot}>Counted {showTime(now.toISOString(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} (Georgia time). Nothing here is estimated except the expected commission.</p>
    </>
  );
}
