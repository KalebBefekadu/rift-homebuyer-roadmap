import type { Metadata } from "next";
import { redirect } from "next/navigation";

/* A forward, not a page: nothing here to index. */
export const metadata: Metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/**
 * The old buyer questionnaire, retired by Blueprint v5 (§5.1, §5.6): one long
 * form producing one crowded readout became separate values, each with its
 * own few questions. Links to it still exist (shared readouts, emails already
 * sent, bookmarks), so it forwards to the buyer landing with its query
 * intact: a share handle (`r`) or campaign tags still credit the right source
 * when the landing records the first touch.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0]) q.set(k, v[0]);
  }
  const s = q.toString();
  redirect(s ? `/buy?${s}` : "/buy");
}
