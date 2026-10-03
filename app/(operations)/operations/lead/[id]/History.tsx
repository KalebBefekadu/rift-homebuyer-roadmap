import type { LeadNote, NoteKind } from "@/lib/core/pipeline";
import { ago } from "@/lib/core/people";
import { showTime } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Section, Empty, Notice } from "../../ui";
import css from "./record.module.css";

const KIND: Record<NoteKind, { word: string; Icon: typeof Ico.doc }> = {
  call: { word: "Call", Icon: Ico.bell },
  text: { word: "Text", Icon: Ico.send },
  email: { word: "Email", Icon: Ico.mail },
  meeting: { word: "Met", Icon: Ico.users },
  note: { word: "Note", Icon: Ico.doc },
  stage: { word: "Moved", Icon: Ico.arrowR },
};

/**
 * What has been said and done, newest first, because the last conversation is
 * the one the agent is continuing. A note is the word and an icon as well as a
 * place in the list, and carries both when it happened and how long ago.
 */
export function History({ notes, unavailable = null }: { notes: LeadNote[]; /** Why the history could not be read; `notes` is then empty, which is not "nothing recorded". */ unavailable?: string | null }) {
  return (
    <Section title="History" hint="Notes cannot be edited or deleted: a record says what was true at the time.">
      {unavailable ? (
        <Notice tone="warn" title="The history did not load">
          {unavailable}. That is not the same as nothing having been said: reload before assuming there is nothing to catch up on.
        </Notice>
      ) : notes.length === 0 ? (
        <Empty title="Nothing recorded yet">
          The first note is usually everything you already know about them. It is worth two minutes now and unrecoverable later.
        </Empty>
      ) : (
        <div className={`card ${css.hist}`}>
          {notes.map((n) => {
            const { word, Icon } = KIND[n.kind];
            return (
              <div key={n.id} className={`${css.entry} ${n.kind === "stage" ? css.stage : ""}`}>
                <Icon size={15} className="c-4" style={{ marginTop: 2 }} />
                <div>
                  <div className={css.entryHead}>
                    <b>{word}</b>
                    <span title={showTime(n.at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}>{ago(n.at)}</span>
                  </div>
                  <p className={css.entryBody}>{n.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
