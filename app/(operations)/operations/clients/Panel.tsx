import Link from "next/link";
import { readLead, lastContacts } from "@/lib/db/clients";
import { journeysFor } from "@/lib/db/journeys";
import { savedPlanFor } from "@/lib/db/saved-plan";
import { SIDE_LABEL } from "@/lib/core/journey";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { planSummary } from "@/lib/core/saved-plan";
import { ago, dueView, bandIsLive, sourceLabel } from "@/lib/core/people";
import { BAND_LABEL } from "@/lib/core/lead";
import { Ico } from "@/components/rift/icons";
import { showDay } from "@/lib/core/day";
import { Notice } from "../ui";
import { PanelFocus } from "./PanelFocus";
import css from "./clients.module.css";

const KIND = { call: "Call", text: "Text", email: "Email", meeting: "Met", note: "Note", stage: "Moved" } as const;

/**
 * One person beside the list (Blueprint v5 §8.5), so the agent keeps his
 * place: who they are, what is owed next, what they worked out, their
 * journeys and the latest notes. The full record is one click further.
 *
 * Every part reads on its own and says so when it could not: a panel that
 * drew "No journeys" over a failed read would be telling him to start a
 * second one.
 */
export async function Panel({ id, closeHref }: { id: string; closeHref: string }) {
  const [lead, journeys, saved, contact] = await Promise.all([readLead(id), journeysFor(id), savedPlanFor(id), lastContacts([id])]);

  const frame = (children: React.ReactNode) => <PanelFocus id={id} className={css.panel}>{children}</PanelFocus>;
  if (!lead.ok) return frame(<Notice tone="neg" title="This record did not load">{lead.error}. Reload, or open the full record.</Notice>);
  if ("skipped" in lead) return frame(<Notice tone="info" title="Nothing is recorded here">{lead.reason}.</Notice>);
  const rec = lead.data;
  if (!rec) return frame(
    <Notice tone="warn" title="Not found" action={<Link className="btn btn-s btn-sm" href={closeHref}>Close</Link>}>
      It may have been deleted.
    </Notice>,
  );

  const p = rec.lead;
  const js = journeys.ok && "data" in journeys ? journeys.data : null;
  const plan = saved.ok && "data" in saved ? saved.data : undefined;
  const last = contact.ok && "data" in contact ? (contact.data.get(id) ?? null) : undefined;
  const name = p.name?.trim() || p.email || "Someone who left no name";
  const due = p.nextAction && p.nextDue ? dueView(p.nextDue) : null;

  return frame(
    <aside className="card p-4" aria-labelledby="panel-name">
      <div className={css.panelHead}>
        <h2 id="panel-name" className={css.panelName}>{name}</h2>
        <Link href={closeHref} className="btn btn-g btn-sm" aria-label="Close the panel"><Ico.x size={13} />Close</Link>
      </div>

      <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
        <span className="chip">{p.side === "buy" ? "Buying" : "Selling"}</span>
        <span className="chip">{p.stage ?? "Not picked up"}</span>
        {p.stall && p.stall.level !== "moving" ? <span className={`chip ${STALL_CHIP[p.stall.level].c}`}><Ico.alert size={11} />{STALL_CHIP[p.stall.level].l}</span> : null}
        {bandIsLive(p) ? <span className="chip chip-acc"><Ico.bolt size={11} />{BAND_LABEL[p.band]}</span> : null}
        {p.archivedAt ? <span className="chip"><Ico.pause size={11} />Archived</span> : null}
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelList}>
          {p.phone ? <a className="u" href={`tel:${p.phone}`}>{p.phone}</a> : null}
          {p.email ? <a className="u" href={`mailto:${p.email}`} style={{ overflowWrap: "anywhere" }}>{p.email}</a> : null}
          {!p.phone && !p.email ? <span className="c-4">No way to reach them is recorded.</span> : null}
        </div>
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelH}>Next step</div>
        {p.nextAction ? (
          <>
            <div className="t-sm">{p.nextAction}</div>
            {due ? <div className={`${css.due} ${css[due.state]}`}>{due.state === "overdue" ? <Ico.alert size={12} /> : <Ico.cal size={12} />}{due.label}</div> : null}
          </>
        ) : <p className="t-sm c-4">Nothing is scheduled.</p>}
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelH}>Facts</div>
        <dl className="t-sm" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
          <dt className="c-4">Arrived</dt><dd>{showDay(p.createdAt, { month: "short", day: "numeric", year: "numeric" })} · {sourceLabel(p.source)}</dd>
          <dt className="c-4">Last contact</dt>
          <dd>{last === undefined ? <span className="c-warn">Could not be read</span> : last ? ago(last) : <span className="c-4">None logged</span>}</dd>
        </dl>
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelH}>What they worked out</div>
        {plan === undefined ? <p className="t-xs c-warn">Their saved plan could not be read.</p>
          : plan ? <p className="t-sm c-2">{planSummary(plan.plan)}.</p>
          : <p className="t-sm c-4">No saved plan.</p>}
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelH}>Journeys</div>
        {js === null ? <p className="t-xs c-warn">Journeys could not be read.</p>
          : js.length ? <ul className={css.panelList}>{js.map((j) => <li key={j.id}><Link className="u" href={`/operations/journey/${j.id}`}>{j.label}</Link> <span className="c-4 t-xs">{SIDE_LABEL[j.side]}</span></li>)}</ul>
          : <p className="t-sm c-4">None yet. Start one from the full record.</p>}
      </div>

      <div className={css.panelBlock}>
        <div className={css.panelH}>Latest notes</div>
        {rec.notesError ? <p className="t-xs c-warn">The notes could not be read. That is not the same as there being none.</p> : rec.notes.length ? (
          <div>
            {rec.notes.slice(0, 4).map((n) => (
              <div key={n.id} className={css.panelNote}>
                <span className="c-4">{KIND[n.kind]} · {ago(n.at)}</span>
                <div className="c-2" style={{ marginTop: 2 }}>{n.body}</div>
              </div>
            ))}
          </div>
        ) : <p className="t-sm c-4">Nothing logged.</p>}
      </div>

      <Link href={`/operations/lead/${p.id}`} className="btn btn-p btn-sm" style={{ marginTop: 16 }}>Open the full record<Ico.arrowR size={13} /></Link>
    </aside>,
  );
}
