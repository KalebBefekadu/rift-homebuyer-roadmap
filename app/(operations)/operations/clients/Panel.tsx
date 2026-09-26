import Link from "next/link";
import { readLead } from "@/lib/db/clients";
import { journeysFor } from "@/lib/db/journeys";
import { progressFor } from "@/lib/db/progress";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/core/progress";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { Ico } from "@/components/rift/icons";

const DAY = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const KIND: Record<string, string> = { note: "Note", call: "Call", email: "Email", text: "Text", meeting: "Met", stage: "Stage" };

/** Only the first few journeys get a stage read: a panel is a glance, and each one is a round trip. */
const STAGED = 3;

/**
 * One person, beside the list (Blueprint v5 §8.5, the side panel).
 *
 * A glance, not the record: how to reach them, what is owed next, their
 * journeys and the last few things that happened. The button goes where the
 * work is: their journey when they have one, their full page when they do not.
 * Everything else is on the full page, one press away (§4.8).
 */
export async function Panel({ id, closeHref }: { id: string; closeHref: string }) {
  const [rec, js] = await Promise.all([readLead(id), journeysFor(id)]);

  if (!rec.ok || !("data" in rec)) {
    return (
      <aside className="ops-panel" aria-label="Person">
        <div className="ops-panel-head">
          <h2 className="ops-panel-title serif">Not available</h2>
          <Link href={closeHref} scroll={false} className="btn btn-g btn-ico" aria-label="Close the panel"><Ico.x size={14} /></Link>
        </div>
        <p className="t-sm c-3">
          {!rec.ok ? `This person could not be read (${rec.error}).` : rec.reason}
        </p>
      </aside>
    );
  }

  const { lead, notes } = rec.data;
  const name = lead.name?.trim() || lead.email || "Someone who left no name";
  const journeys = js.ok && "data" in js ? js.data : [];
  const stages = await Promise.all(journeys.slice(0, STAGED).map((j) => progressFor(j.id)));
  const first = journeys[0];

  return (
    <aside className="ops-panel" aria-label={name}>
      <div className="ops-panel-head">
        <h2 className="ops-panel-title serif">{name}</h2>
        <Link href={closeHref} scroll={false} className="btn btn-g btn-ico" aria-label="Close the panel"><Ico.x size={14} /></Link>
      </div>
      <div className="row gap-2 wrap" style={{ margin: "6px 0 12px" }}>
        {first ? (
          <Link href={`/operations/journey/${first.id}`} className="btn btn-p btn-sm">
            {journeys.length > 1 ? "Open the latest journey" : "Open the journey"}<Ico.arrowR size={12} aria-hidden />
          </Link>
        ) : null}
        <Link href={`/operations/lead/${lead.id}`} className={`btn btn-sm ${first ? "btn-s" : "btn-p"}`}>
          Full page<Ico.arrowR size={12} aria-hidden />
        </Link>
      </div>

      <dl className="ops-dl">
        <dt>Next</dt>
        <dd>
          {lead.nextAction
            ? <><strong>{lead.nextAction}</strong>{lead.nextDue ? ` · ${DAY(lead.nextDue)}` : ""}</>
            : <span className="c-4">Nothing owed yet</span>}
        </dd>
        <dt>Phone</dt><dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : <span className="c-4">None given</span>}</dd>
        <dt>Email</dt><dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : <span className="c-4">None given</span>}</dd>
        <dt>Stage</dt>
        <dd>
          {lead.stage ?? <span className="c-4">Not picked up</span>}
          {lead.stall ? <span className={`chip t-2xs ${STALL_CHIP[lead.stall.level].c}`} style={{ marginLeft: 6 }}>{STALL_CHIP[lead.stall.level].l}</span> : null}
        </dd>
        <dt>Came from</dt><dd>{lead.source === "funnel" ? "Their readout" : lead.source}{lead.contactBasis ? `, ${lead.contactBasis}` : ""}</dd>
        <dt>Arrived</dt><dd>{DAY(lead.createdAt)}</dd>
        {lead.archivedAt ? <><dt>Archived</dt><dd>{DAY(lead.archivedAt)}{lead.archivedReason ? `, ${lead.archivedReason}` : ""}</dd></> : null}
      </dl>

      <h3 className="t-sm w6" style={{ margin: "4px 0 6px" }}>Journeys</h3>
      {!js.ok ? (
        <p className="t-xs c-warn">Journeys did not load ({js.error}). That is not the same as having none.</p>
      ) : "skipped" in js ? (
        <p className="t-xs c-4">{js.reason}.</p>
      ) : !journeys.length ? (
        <p className="t-xs c-4">None yet. Start one from their full page.</p>
      ) : (
        <ul className="col gap-2" style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
          {journeys.map((j, i) => {
            const p = stages[i];
            const prog = p && p.ok && "data" in p ? p.data.progress : null;
            return (
              <li key={j.id} className="t-sm">
                <Link href={`/operations/journey/${j.id}`} className="w6">{j.label}</Link>
                <span className="t-xs c-3">
                  {" · "}{j.side === "buy" ? "Buying" : "Selling"}
                  {prog ? ` · ${STAGE_LABEL[prog.stage]}${prog.status !== "active" ? `, ${STATUS_LABEL[prog.status].toLowerCase()}` : ""}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="t-sm w6" style={{ margin: "4px 0 6px" }}>Recently</h3>
      {notes.length ? (
        <ul className="col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {notes.slice(0, 5).map((n) => (
            <li key={n.id} className="t-xs" style={{ lineHeight: 1.45 }}>
              <span className="c-4">{DAY(n.at)} · {KIND[n.kind] ?? n.kind}</span>
              <div className="c-2" style={{ overflowWrap: "anywhere" }}>{n.body.length > 180 ? `${n.body.slice(0, 180)}…` : n.body}</div>
            </li>
          ))}
        </ul>
      ) : <p className="t-xs c-4">Nothing recorded yet.</p>}
      {notes.length > 5 ? (
        <Link href={`/operations/lead/${lead.id}`} className="t-xs" style={{ display: "inline-block", marginTop: 8 }}>
          All {notes.length} on the full page
        </Link>
      ) : null}
    </aside>
  );
}
