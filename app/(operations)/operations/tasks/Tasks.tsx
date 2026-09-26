"use client";

import { useState } from "react";
import type { StepView } from "@/lib/core/checklist";
import { useWrite } from "../journey/[id]/useWrite";
import { StepRow, newRequest } from "../journey/[id]/Checklist";

/** One journey's coordinator steps, each with its one button. Writes go to the team route. */
export function Tasks({ journeyId, steps, today, me }: { journeyId: string; steps: StepView[]; today: string; me: string }) {
  const { busy, error, write } = useWrite(steps.map((s) => `${s.step.id}:${s.history.length}:${s.state}`).join("|"), "/api/operations/team");
  const [req, setReq] = useState(newRequest);
  return (
    <>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{error}</p> : null}
      <ol className="ck-list">
        {steps.map((v) => (
          <StepRow key={v.step.id} v={v} busy={busy} locked={false} today={today} agentFirst={me} mine={["tc"]} canReopen={false}
            run={async (body) => {
              const r = await write("mark", {
                journeyId, stepId: v.step.id, requestId: req,
                expectedSeq: v.history.length ? v.history[v.history.length - 1].seq : 0, ...body,
              });
              if (r.ok) setReq(newRequest());
              return r.ok;
            }} />
        ))}
      </ol>
    </>
  );
}
