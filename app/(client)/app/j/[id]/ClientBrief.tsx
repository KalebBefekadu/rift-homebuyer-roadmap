"use client";

import { useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import { BriefEditor } from "@/components/rift/BriefEditor";
import type { Response, SearchCriterion } from "@/lib/core/search";
import { post } from "../../post";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

/**
 * The buyer's answer to their priorities: "that is right", "something should
 * change", or a change they make themselves. Each is against the exact version
 * on the screen; if the agent saved a newer one meanwhile, the server refuses
 * and says reload, so nobody confirms something they did not read.
 *
 * A change they make is a proposal. It becomes a new version the agent reviews
 * before anything in the MLS search moves (REQ-SEARCH-06).
 */
export function ClientBrief({ journeyId, revision, myResponse, canRespond, person, hiddenMoney, agentFirst }: {
  journeyId: string;
  revision: { id: string; revision: number; criteria: SearchCriterion[]; questions: string[] };
  myResponse: { response: Response; note: string | null; at: string } | null;
  canRespond: boolean;
  person: string;
  hiddenMoney: boolean;
  agentFirst: string;
}) {
  const refresh = useRefresh(`${revision.id}|${myResponse?.at ?? ""}`);
  const [mode, setMode] = useState<"idle" | "changes" | "edit">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!canRespond) {
    return <p className="t-2xs c-4" style={{ marginTop: 12 }}>You can read these. Only the buyers on this move can answer them.</p>;
  }

  const respond = async (response: Response) => {
    setBusy(true);
    const r = await post({ action: "respond", journeyId, revisionId: revision.id, response, note: response === "changes-requested" ? note : null });
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "That did not save."); return; }
    setError(null);
    setDone(response === "confirmed" ? `Thank you. ${agentFirst} can see you confirmed these.` : `Sent to ${agentFirst}. Nothing changes in your search until they review it.`);
    setMode("idle");
    setNote("");
    refresh();
  };

  return (
    <div style={{ marginTop: 16 }}>
      {done ? <p role="status" className="t-sm c-pos">{done}</p> : myResponse ? (
        <p className="t-xs c-3">
          You {myResponse.response === "confirmed" ? "confirmed these" : "asked for changes"} on {DAY(myResponse.at)}
          {myResponse.note ? `: "${myResponse.note}"` : ""}.
        </p>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}

      {mode === "idle" ? (
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
          <button className="btn btn-p btn-sm" disabled={busy} onClick={() => respond("confirmed")}>
            {busy ? "Saving…" : "These are right"}
          </button>
          <button className="btn btn-s btn-sm" disabled={busy} onClick={() => setMode("changes")}>Something should change</button>
          <button className="btn btn-g btn-sm" disabled={busy} onClick={() => setMode("edit")}>Make the change myself</button>
        </div>
      ) : mode === "changes" ? (
        <div style={{ marginTop: 10 }}>
          <label className="field">
            <span className="label">What should change?</span>
            <textarea className="ta" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)}
              placeholder="We said four bedrooms, not three." style={{ minHeight: 90 }} />
          </label>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !note.trim()} onClick={() => respond("changes-requested")}>
              {busy ? "Sending…" : `Send to ${agentFirst}`}
            </button>
            <button className="btn btn-g btn-sm" disabled={busy} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {hiddenMoney ? (
            <p className="t-2xs c-4" style={{ marginBottom: 8 }}>Price items you cannot see stay exactly as they are.</p>
          ) : null}
          <BriefEditor
            mode="client"
            latest={{ revision: revision.revision, criteria: revision.criteria, questions: revision.questions }}
            start={null}
            person={person}
            disagreement={[]}
            saveLabel={`Send the change to ${agentFirst}`}
            onSave={async (brief, expected, why) => {
              const r = await post({ action: "propose", journeyId, brief, expectedLatest: expected, note: why });
              if (r.ok) {
                setDone(`Sent to ${agentFirst}. It is a new version for them to review; your MLS search does not change until they do.`);
                setMode("idle");
                refresh();
              }
              return r;
            }}
          />
          <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={() => setMode("idle")}>Cancel</button>
        </div>
      )}
    </div>
  );
}
