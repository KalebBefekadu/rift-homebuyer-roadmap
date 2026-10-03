import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { questionVersion, questionVersions, type VersionSummary } from "@/lib/db/questions";
import { CODE_WORDING, QUESTION_SIDES, diffWording, type Wording } from "@/lib/core/question-wording";
import type { ValueSide } from "@/lib/core/values";
import { showTime } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { PageHead, Section, Notice } from "../ui";
import { Editor, Diff } from "./Editor";
import s from "./questions.module.css";

export const metadata: Metadata = { title: "Questions", robots: { index: false } };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined) => (v && /^\d{1,6}$/.test(v) ? Number(v) : null);

/**
 * What a visitor is asked, and the agent's own words for it (D37).
 *
 * D31 retired the v4 editor because it published words no visitor read. This
 * one edits the words the values actually ask (lib/core/asks.ts), and the
 * public pages read what is published here, falling back to the code's words
 * when the read is slow. Each publish is a version that is never edited, with
 * who and when; each lead records the version its page was rendered with; an
 * earlier version can be read, and restored by publishing it again.
 *
 * Words only. What an answer feeds, its choices' values and its limits stay in
 * code, and the page says so beside every question. The agent's own questions
 * are asked after a plan is saved and feed nothing (rule 5).
 */
export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await agentSession();
  /* A blip is not an expired session: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const sp = await searchParams;
  const rawSide = one(sp.side);
  const side: ValueSide = QUESTION_SIDES.some((x) => x.id === rawSide) ? (rawSide as ValueSide) : "buy";
  const viewing = num(one(sp.v));
  const restoring = num(one(sp.from));
  const justPublished = num(one(sp.published));

  const list = await questionVersions();
  const versions: VersionSummary[] = list.ok && "data" in list && list.data ? list.data : [];
  const live = versions[0] ?? null;

  /* Anything that stops publishing says why, and the words shown are then the
     built-in ones, labelled as possibly not what visitors read. */
  let blocked: React.ReactNode = null;
  if (!list.ok) {
    blocked = <Notice tone="neg" title="The published questions did not load">That is not the same as there being none. The words below are the built-in ones and may not be what visitors read; reload before changing anything.</Notice>;
  } else if ("skipped" in list) {
    blocked = <Notice tone="info" title="Nothing can be published on this deployment">{list.reason}. Visitors read the built-in words below.</Notice>;
  } else if (list.data === null) {
    blocked = <Notice tone="warn" title="Editing questions needs a database update">Migration 20260929400000 has not been applied here. Visitors read the built-in words below.</Notice>;
  }

  let published: Wording = CODE_WORDING;
  if (live && !blocked) {
    const r = await questionVersion(live.version);
    if (r.ok && "data" in r && r.data) published = r.data.wording;
    else blocked = <Notice tone="neg" title={`Version ${live.version} did not load`}>Reload in a moment. Nothing can be published until it has, or the next version would be built on the wrong words.</Notice>;
  }

  /* An earlier version: its words, read only, and what it changed. */
  let view: { summary: VersionSummary; wording: Wording; changed: ReturnType<typeof diffWording> } | null = null;
  let viewMissing = false;
  if (viewing !== null && viewing !== live?.version && !blocked) {
    const [r, before] = await Promise.all([questionVersion(viewing), viewing > 1 ? questionVersion(viewing - 1) : Promise.resolve(null)]);
    const got = r.ok && "data" in r ? r.data : null;
    const prior = before && before.ok && "data" in before && before.data ? before.data.wording : CODE_WORDING;
    if (got) view = { summary: got, wording: got.wording, changed: diffWording(prior, got.wording) };
    else viewMissing = true;
  }

  /* Restoring starts the draft from an earlier version's words; publishing it makes a new version. */
  let start = published;
  if (restoring !== null && !blocked && restoring !== live?.version) {
    const r = await questionVersion(restoring);
    if (r.ok && "data" in r && r.data) start = r.data.wording;
  }

  const liveLine = live
    ? <>Live: version {live.version}, published {showTime(live.at)} by {live.by}</>
    : <>Live: the built-in words</>;

  return (
    <main className="shell-w">
      <PageHead
        title="Questions"
        lede="Exactly what a visitor is asked, in words you can change. Publish and the values ask in your words within a minute; what each answer feeds stays fixed."
        meta={<span className={`chip t-xs ${s.liveChip}`}><Ico.checkCircle size={12} className="c-pos" />{liveLine}</span>}
      />

      {blocked}
      {justPublished !== null && live?.version === justPublished && !view ? (
        <Notice tone="pos" title={`Version ${justPublished} is live`}>
          Value pages ask in these words within a minute. Everyone who saved a plan before keeps a record of the words they were shown.
        </Notice>
      ) : null}
      {viewMissing ? <Notice tone="warn" title={`There is no version ${viewing}`}>Showing the live words.</Notice> : null}
      {restoring !== null && start !== published ? (
        <Notice tone="info" title={`Starting from version ${restoring}'s words`}>
          Nothing has changed for visitors yet. Review below and publish to make them live again as a new version.
        </Notice>
      ) : null}

      {view ? (
        <>
          <Notice tone="info" title={`Version ${view.summary.version}, published ${showTime(view.summary.at)} by ${view.summary.by}. Not live.`}
            action={<div className="row gap-2 wrap">
              <Link className="btn btn-s btn-sm" href={`/operations/questions?side=${side}&from=${view.summary.version}`}><Ico.refresh size={12} />Restore these words</Link>
              <Link className="btn btn-g btn-sm" href={`/operations/questions?side=${side}`}>Back to the live words</Link>
            </div>}>
            {view.summary.note ? <>Note: {view.summary.note}</> : "Read only. Restoring starts a new version from these words; nothing is overwritten."}
          </Notice>
          <Section title={`What version ${view.summary.version} changed`}>
            <div className="card">{view.changed.length ? <Diff changes={view.changed} /> : <p className="t-sm c-3 p-4">No visible change.</p>}</div>
          </Section>
          <div style={{ marginTop: 24 }}>
            <Editor key={`view-${view.summary.version}`} side={side} published={view.wording} start={view.wording} version={view.summary.version} readOnly />
          </div>
        </>
      ) : (
        <Editor key={`${live?.version ?? 0}-${restoring ?? ""}`} side={side} published={published} start={start} version={live?.version ?? 0} readOnly={Boolean(blocked)} />
      )}

      <Section title="Versions" hint="Every publish, never edited. A lead's record names the version its page showed.">
        <div className={`card ${s.tableCard}`}>
          <table className="ops-table">
            <thead><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {versions.map((v, i) => (
                <tr key={v.id} aria-selected={view?.summary.version === v.version}>
                  <td className="w6">
                    {v.version}
                    {i === 0 ? <span className="chip chip-pos t-2xs" style={{ marginLeft: 6 }}><Ico.check size={10} />Live</span> : null}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{showTime(v.at)}</td>
                  <td>{v.by}</td>
                  <td className="c-3">{v.note ?? <span className="c-4">No note</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="u t-xs" href={i === 0 ? `/operations/questions?side=${side}` : `/operations/questions?side=${side}&v=${v.version}`}>
                      {i === 0 ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="w6">0{!live ? <span className="chip chip-pos t-2xs" style={{ marginLeft: 6 }}><Ico.check size={10} />Live</span> : null}</td>
                <td className="c-4">With each release</td>
                <td className="c-4">Built in</td>
                <td className="c-3">The words in the code, used whenever nothing is published or the published words cannot be read in time</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
