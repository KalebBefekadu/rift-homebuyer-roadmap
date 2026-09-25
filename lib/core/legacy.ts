/**
 * Where an address from before the values goes now (Blueprint v5 §5.1, §5.8).
 *
 * The seller questionnaire (/sell/start) and its crowded readout
 * (/sell/results) are replaced by separate values. Their addresses live on in
 * old landing links, bookmarks, campaign links and forwarded readouts, so
 * each one is sent to the value it was really asking about, carrying:
 *
 *   * the answers the new value understands (price and what is owed), so the
 *     person is not asked again for what the link already says;
 *   * the campaign and referral tags, so first touch is credited to the
 *     campaign or the person who sent the link (rule 7), not to "direct".
 *
 * Saved readouts at /r/<token> are snapshots and are not touched: rule 4.
 *
 * Pure: no I/O.
 */

import { ASKS, answersToQuery, parseAnswers } from "./asks";
import { refFrom } from "./attribution";

const TAGS = ["utm_source", "utm_medium", "utm_campaign"] as const;

function tagsFrom(get: (k: string) => string | undefined): URLSearchParams {
  const out = new URLSearchParams();
  for (const t of TAGS) {
    const v = get(t);
    if (v) out.set(t, v.slice(0, 120));
  }
  const ref = refFrom(get("r"));
  if (ref) out.set("r", ref);
  return out;
}

/** The old seller parameters: p (price), o (still owed). */
export function legacySellerTarget(get: (k: string) => string | undefined): string {
  /* Read through the new validators, under the new parameter names, so an
     out-of-range figure is dropped and asked for rather than carried. */
  const answers = parseAnswers((param) =>
    param === ASKS.price.param ? get("p") : param === ASKS.payoff.param ? get("o") : undefined);
  const tags = tagsFrom(get).toString();
  const known = answersToQuery(answers, ["price", "payoff"]);
  const base = known ? "/sell/proceeds" : "/sell";
  const q = [known, tags].filter(Boolean).join("&");
  return q ? `${base}?${q}` : base;
}
