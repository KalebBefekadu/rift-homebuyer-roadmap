"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { answersToQuery, hasAll, type Answers } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { readAnswers } from "@/lib/rift/answers";
import { Ico } from "@/components/rift/icons";

const KEYS = valueById("assistance")!.asks as InputKey[];

/**
 * The way into the "if approved" figure (V3) from a value that does not ask
 * the assistance questions.
 *
 * Only a value's own answers travel in its address, so the timeline never
 * sees an income. When this device already holds every assistance answer,
 * this offers to add them, and the server works the figure out from the
 * address like any other. Otherwise it points at the assistance value. It
 * never sends anything itself.
 */
export function IfApprovedPrompt({ href, asks, given }: { href: string; asks: readonly InputKey[]; given: Answers }) {
  const [merged, setMerged] = useState<Answers | null>(null);
  useEffect(() => {
    /* The page's own answers win: the price here is the one this answer used. */
    const m = { ...readAnswers(), ...given };
    setMerged(hasAll(m, KEYS) ? m : null);
  }, [given]);

  return (
    <p className="t-sm c-3 mt-3 measure row-t gap-2" style={{ lineHeight: 1.6 }}>
      <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
      {merged ? (
        <span>
          You have answered the program questions.{" "}
          <Link className="btn-link" href={`${href}?${answersToQuery(merged, [...asks, ...KEYS.filter((k) => !asks.includes(k))])}`}>
            Show what the program you may fit would change
          </Link>
          , below this answer and never in it.
        </span>
      ) : (
        <span>
          Programs are not counted here, because a lender decides them.{" "}
          <Link className="btn-link" href="/buy/assistance">Check which Georgia programs may fit you</Link> to see what one would change.
        </span>
      )}
    </p>
  );
}
