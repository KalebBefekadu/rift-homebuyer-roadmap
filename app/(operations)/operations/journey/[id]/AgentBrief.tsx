"use client";

import { BriefEditor } from "@/components/rift/BriefEditor";
import type { SearchCriterion } from "@/lib/core/search";
import { useRefresh } from "@/components/rift/useRefresh";
import { send } from "../send";

/** The shared brief editor, saving through /api/operations/journey. */
export function AgentBrief({ journeyId, ...rest }: {
  journeyId: string;
  latest: { revision: number; criteria: SearchCriterion[]; questions: string[] } | null;
  start: { criteria: SearchCriterion[]; from: string } | null;
  person: string;
  disagreement: string[];
}) {
  const refresh = useRefresh(String(rest.latest?.revision ?? 0));
  return (
    <BriefEditor
      {...rest}
      onSave={async (brief, expected, note) => {
        const r = await send("save-brief", { journeyId, brief, expectedLatest: expected, note });
        if (r.ok) refresh();
        return r;
      }}
    />
  );
}
