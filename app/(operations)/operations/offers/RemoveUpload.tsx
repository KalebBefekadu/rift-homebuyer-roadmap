"use client";

import { useState, useTransition } from "react";
import { removeOfferUpload } from "./actions";
import k from "../_business/kit.module.css";

/** Two presses, because a removed PDF cannot be brought back. */
export function RemoveUpload({ uploadId }: { uploadId: string }) {
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" className="btn btn-g btn-sm" disabled={pending}
        onClick={() => {
          if (!sure) { setSure(true); return; }
          start(async () => {
            const r = await removeOfferUpload(uploadId);
            if (!r.ok) { setError(r.error); setSure(false); }
          });
        }}>
        {pending ? "Removing…" : sure ? "Remove it and its PDFs" : "Not an offer? Remove"}
      </button>
      {error ? <span role="alert" className={k.muted}> {error}</span> : null}
    </span>
  );
}
