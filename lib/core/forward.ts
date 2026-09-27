/**
 * Old addresses of the retired questionnaires and readouts (Blueprint v5
 * §5.1, §5.6, §5.8), forwarded to the values that replaced them.
 *
 * Links to them live on in emails already sent, bookmarks and shared
 * messages. Each forward keeps the answers the old link carried, renamed to
 * the values' parameters so nobody is asked again, and keeps the campaign
 * tags and share handle, so first touch still credits the right source.
 * Nothing else passes: an unknown parameter is not carried into a page that
 * might one day read it.
 *
 * Pure: no I/O.
 */

type Params = Record<string, string | string[] | undefined>;

/** Carried unchanged wherever a person lands. */
const KEEP = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

export function forwardTo(path: string, sp: Params, rename: Record<string, string> = {}, keep: string[] = []): string {
  const q = new URLSearchParams();
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  for (const [from, to] of Object.entries(rename)) {
    const v = one(from);
    if (v !== undefined && v !== "") q.set(to, v);
  }
  for (const k of [...KEEP, ...keep]) {
    const v = one(k);
    if (v !== undefined && v !== "" && !q.has(k)) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** The old buyer readout's answers, as the values name them. Its monthly
    saving travelled as `r`, which is the referral handle everywhere else. */
export const BUY_READOUT_RENAME = { c: "c", o: "o", p: "p", s: "s", r: "ms" } as const;
/** The old seller landing, questionnaire and readout: price was `p`, payoff `o`. */
export const SELL_RENAME = { c: "c", p: "sp", o: "po" } as const;
