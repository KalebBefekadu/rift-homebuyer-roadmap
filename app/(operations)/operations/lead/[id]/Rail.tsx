import type { ManagedLead } from "@/lib/core/pipeline";
import { STOPS } from "@/lib/core/nurture";
import { ago, sourceLabel } from "@/lib/core/people";
import { showDay } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Section, Notice } from "../../ui";
import type { Background, ConsentView } from "@/lib/db/lead-background";
import { ArchiveBox } from "./Record";
import css from "./record.module.css";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });

/** One channel's consent, as an icon and a sentence (never colour alone). */
function Channel({ label, c }: { label: string; c: ConsentView }) {
  if (c.granted === true) return <div className={css.consent}><Ico.checkCircle size={15} className="c-pos" style={{ flex: "none", marginTop: 1 }} /><span><b className="w6">{label}:</b> agreed{c.at ? `, ${DAY(c.at)}` : ""}</span></div>;
  if (c.granted === false) return <div className={css.consent}><Ico.x size={15} className="c-neg" style={{ flex: "none", marginTop: 1 }} /><span><b className="w6">{label}:</b> they said no{c.at ? `, ${DAY(c.at)}` : ""}. Do not use it.</span></div>;
  return <div className={css.consent}><Ico.minus size={15} className="c-4" style={{ flex: "none", marginTop: 1 }} /><span><b className="w6">{label}:</b> <span className="c-3">no answer recorded</span></span></div>;
}

/**
 * How to reach them and whether they have agreed to it: the lines the agent
 * checks before picking up the phone, which the record did not show at all.
 * A consent that could not be read says so, because "no answer recorded" over
 * a failed read is the one mistake here that sends somebody a text they
 * declined.
 */
export function Contact({ lead, background }: { lead: ManagedLead; background: Background | null }) {
  const c = background?.consents ?? null;
  const f = background?.followUp;
  const stop = f && f !== "unread" && f.stopReason ? STOPS.find((s) => s.id === f.stopReason) : null;

  return (
    <Section title="Contact and consent">
      <div className="card p-4">
        <div className={css.railList}>
          <div className={css.links}>
            {lead.phone ? <a className="u" href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
            {lead.email ? <a className="u" href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            {!lead.phone && !lead.email ? <span className="c-4">No way to reach them is recorded.</span> : null}
          </div>

          <div className={css.sep} />

          {background === null || c === null ? (
            <Notice tone="warn" title="Consent did not load">That is not the same as no consent: reload before contacting them.</Notice>
          ) : c.recorded ? (
            <div>
              <Channel label="Email" c={c.email} />
              <Channel label="Phone and text" c={c.phone} />
            </div>
          ) : lead.source === "funnel" ? (
            <p className="t-sm c-3" style={{ lineHeight: 1.55 }}>No consent answer is recorded for them.</p>
          ) : null}

          {lead.contactBasis ? (
            <div>
              <div className={css.label}>Why you can contact them</div>
              <p className="t-sm" style={{ marginTop: 2 }}>{lead.contactBasis}</p>
            </div>
          ) : null}

          <div className={css.sep} />

          <div>
            <div className={css.label}>Automatic follow-up</div>
            <div className={css.consent} style={{ marginTop: 4 }}>
              {f === undefined || f === "unread" ? (
                <><Ico.alert size={15} className="c-warn" style={{ flex: "none", marginTop: 1 }} /><span className="c-warn">It could not be read.</span></>
              ) : f === null ? (
                <><Ico.minus size={15} className="c-4" style={{ flex: "none", marginTop: 1 }} /><span className="c-3">Not in a sequence.</span></>
              ) : f.stoppedAt ? (
                <><Ico.pause size={15} className="c-4" style={{ flex: "none", marginTop: 1 }} /><span>Stopped {DAY(f.stoppedAt)}: {stop?.label.toLowerCase() ?? "stopped"}. {f.touches} sent.</span></>
              ) : (
                <><Ico.refresh size={15} className="c-pos" style={{ flex: "none", marginTop: 1 }} /><span>Running since {DAY(f.enteredAt)}, {f.touches} {f.touches === 1 ? "step" : "steps"} so far{f.phoneConsent ? "" : ", email only"}.</span></>
              )}
            </div>
            {background?.humanRepliedAt ? <p className="t-xs c-4" style={{ marginTop: 4 }}>They replied {ago(background.humanRepliedAt)}.</p> : null}
          </div>
        </div>
      </div>
    </Section>
  );
}

/** The facts about the record itself, and the way to set it aside. */
export function Details({ lead }: { lead: ManagedLead }) {
  return (
    <Section title="Details">
      <div className="card p-4">
        <dl className={`${css.facts} ${css.one}`}>
          <div><dt>Added</dt><dd>{DAY(lead.createdAt)} ({ago(lead.createdAt)})</dd></div>
          <div><dt>How they arrived</dt><dd>{sourceLabel(lead.source)}</dd></div>
        </dl>
      </div>
      {/* An archived record shows its restore button at the top of the page. */}
      {!lead.archivedAt ? <div style={{ marginTop: 12 }}><ArchiveBox lead={lead} /></div> : null}
    </Section>
  );
}
