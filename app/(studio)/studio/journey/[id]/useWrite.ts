"use client";

import { useEffect, useRef, useState } from "react";
import { useRefresh } from "@/components/rift/useRefresh";
import { send, type Sent } from "../send";

/**
 * One write on the journey page: send it, report its answer, refresh
 * (components/rift/useRefresh.ts, which reloads if the refresh never lands).
 *
 * `busy` covers the write AND the refresh that follows it. It clears when
 * `stamp` (a summary of what the component shows) changes, meaning the
 * refreshed page has arrived. Clearing on the answer alone would let a second
 * click in before the page caught up, and approval mints a new request id
 * after each success, so that click would record a second approval. If the
 * page never changes, the button comes back after ten seconds rather than
 * staying on "Saving…".
 */
export function useWrite(stamp: string) {
  const refresh = useRefresh(stamp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);

  useEffect(() => { setBusy(false); }, [stamp]);

  const write = async (op: string, body: Record<string, unknown>, opts?: { reload?: boolean }): Promise<Sent> => {
    const mine = ++attempt.current;
    setBusy(true);
    const r = await send(op, body);
    if (!r.ok) {
      setError(r.error ?? "That did not work");
      setBusy(false);
      return r;
    }
    setError(null);
    refresh(opts);
    setTimeout(() => { if (attempt.current === mine) setBusy(false); }, 10_000);
    return r;
  };

  return { busy, error, setError, write };
}
