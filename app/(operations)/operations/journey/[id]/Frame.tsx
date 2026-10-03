import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { PageHead } from "../../ui";
import { SIDE_LABEL } from "@/lib/core/journey";
import { STAGE_LABEL, STATUS_LABEL, stageStrip, visitedStages, type JourneyEvent, type JourneyStatus, type Progress, type Side } from "@/lib/core/progress";
import type { Attention } from "@/lib/core/journey-focus";
import { TAB_LABEL, tabsFor, type Tab } from "./tabs";
import s from "./journey.module.css";

const STATUS_ICON = { active: Ico.checkCircle, paused: Ico.pause, completed: Ico.check, cancelled: Ico.x } as const;
const STATUS_CHIP: Record<JourneyStatus, string> = { active: "chip chip-pos", paused: "chip chip-warn", completed: "chip chip-ink", cancelled: "chip chip-neg" };

/** The stage path. Only the current stage shows on a phone, with where it is in the path. */
function StageStrip({ progress, events, side }: { progress: Progress; events: JourneyEvent[]; side: Side }) {
  const steps = stageStrip(progress, visitedStages(events), side);
  const now = steps.findIndex((x) => x.state === "now");
  const GLYPH = { done: "✓", now: "●", skipped: "–", ahead: "○" } as const;
  const WORD = { done: "done", now: "current stage", skipped: "not recorded", ahead: "ahead" } as const;
  return (
    <div className={s.line} style={{ marginTop: 16 }}>
      <ol className={s.strip} aria-label="Stages">
        {steps.map((x) => (
          <li key={x.stage} data-state={x.state} aria-current={x.state === "now" ? "step" : undefined}>
            <span className={s.mark} aria-hidden>{GLYPH[x.state]}</span>
            {x.label}
            <span className="sr-only"> ({WORD[x.state]})</span>
          </li>
        ))}
      </ol>
      <span className={s.stripCount}>Stage {now + 1} of {steps.length}</span>
    </div>
  );
}

/**
 * The top of every journey tab: who and what, the status, where in the
 * path it is, the one thing to do next, and the tabs with how many things
 * wait inside each. It reads the same on every tab so the stage and the next
 * action never have to be hunted for.
 */
export function JourneyHead({ journey, household, progress, events, status, extra, attention, closed, focus, tab, counts, id }: {
  id: string;
  journey: { label: string; leadId: string; person: string; side: Side; createdAt: string };
  household: string | null;
  progress: Progress | null;
  events: JourneyEvent[];
  status: JourneyStatus | null;
  extra?: React.ReactNode;
  attention: Attention[];
  /** How a finished journey ended, said instead of a next action. */
  closed: string | null;
  focus: { text: string; tab: string } | null;
  tab: Tab;
  counts: Record<string, number>;
}) {
  const href = (t: string) => (t === "overview" ? `/operations/journey/${id}` : `/operations/journey/${id}?tab=${t}`);
  const StatusIcon = status ? STATUS_ICON[status] : Ico.alert;
  const top = attention[0] ?? null;
  const more = attention.length - 1;

  let tone: "neg" | "warn" | "info" = "info";
  let label = "Next";
  let text: string | null = null;
  let detail: string | null = null;
  let go: { tab: string } | null = null;
  if (closed) {
    label = "Closed"; text = closed;
  } else if (top) {
    tone = top.severity; text = top.text; detail = top.detail ?? null;
    label = top.severity === "neg" ? "Needs you now" : "Next";
    go = top.tab ? { tab: top.tab } : null;
  } else if (focus) {
    text = focus.text; detail = "Nothing is blocked or waiting on you."; go = { tab: focus.tab };
  }
  const NextIco = tone === "info" ? Ico.info : Ico.alert;

  return (
    <>
      <PageHead
        back={{ href: `/operations/lead/${journey.leadId}`, label: `${journey.person}'s record` }}
        title={journey.label}
        lede={household ? <>Started {journey.createdAt}. Household: {household}.</> : <>Started {journey.createdAt}.</>}
        meta={(
          <>
            <span className="chip">{SIDE_LABEL[journey.side]}</span>
            {status ? <span className={STATUS_CHIP[status]}><StatusIcon size={11} /> {STATUS_LABEL[status]}{progress ? ` at ${STAGE_LABEL[progress.stage]}` : ""}</span>
              : <span className="chip chip-warn"><Ico.alert size={11} /> Stage unknown: it did not load</span>}
            {extra}
          </>
        )}
      />
      {progress ? <StageStrip progress={progress} events={events} side={journey.side} /> : null}

      {text ? (
        <div className={s.next} data-tone={tone} role={tone === "neg" ? "alert" : undefined}>
          <NextIco size={15} className={s.nextIco} />
          <div className={s.nextBody}>
            <div className={s.nextLabel}>{label}</div>
            <div className={s.nextText}>{text}</div>
            {detail || more > 0 ? <div className={s.nextMore}>{detail}{detail && more > 0 ? " " : ""}{more > 0 ? `${more} more on the overview.` : ""}</div> : null}
          </div>
          {go && go.tab !== tab ? (
            <div className={s.nextAct}>
              <Link href={href(go.tab)} className="btn btn-s btn-sm">Open {TAB_LABEL[go.tab as Tab]?.toLowerCase() ?? go.tab} <Ico.arrowR size={12} /></Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <nav className={s.tabs} aria-label="Journey">
        {tabsFor(journey.side === "buy").map((t) => (
          <Link key={t} href={href(t)} className={s.tab} aria-current={t === tab ? "page" : undefined}>
            {TAB_LABEL[t]}
            {counts[t] ? <span className={s.badge} aria-label={`${counts[t]} need${counts[t] === 1 ? "s" : ""} you`}>{counts[t]}</span> : null}
          </Link>
        ))}
      </nav>
    </>
  );
}
