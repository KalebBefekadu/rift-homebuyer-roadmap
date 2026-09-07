import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { nextRung, ceilingNote, type ReviewItem, type TrustState, type ReviewKind } from "@/lib/core/review";

/**
 * The review queue — the producer for `pending-review`.
 *
 * The trust ladder has four rungs and, until this existed, only three could
 * ever occur: `pending-review` was rendered, explained, and unreachable. A
 * person had no way to ask for the one thing the ladder implies they can ask
 * for, which made the middle of it decoration.
 *
 * Two constraints keep it honest, and both live in the database because the UI
 * is not the only thing that will ever write here:
 *
 *   A CEILING PER ITEM. A lender's pre-approval can be verified. An opinion
 *   about a repair budget cannot be, ever, and the product must not offer a
 *   button that pretends otherwise.
 *
 *   VERIFICATION NAMES A PARTY. A green chip with nobody behind it is the exact
 *   false confidence this ladder exists to prevent.
 */

export interface AskInput {
  who: string;
  kind: ReviewKind;
  what: string;
  claim: string;
  ceiling: TrustState;
  readoutId?: string;
  /** The specific figure. "Check this" has to mean a particular number. */
  figureId?: string;
}

const TO_ADVANCE: Record<ReviewKind, string> = {
  document: "Read it and confirm the figure it supports.",
  program: "Re-check eligibility against the current programme terms.",
  figure: "Go through the inputs and confirm the arithmetic holds for their situation.",
  plan: "Read it end to end before it goes out.",
};

/**
 * The figure a share token's readout holds under a given label.
 *
 * The ask control knows which figure it sits beside; it does not know that
 * figure's id, and it must not be trusted to send one — a client that can name
 * an arbitrary figure id can queue a review against somebody else's numbers.
 * So the server resolves it from the token and the label instead.
 */
export async function figureFor(shareToken: string, label: string): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("rift_readouts")
      .select("id")
      .eq("share_token", shareToken)
      .maybeSingle();
    if (!data) return null;

    const { data: fig } = await db
      .from("rift_figures")
      .select("id")
      .eq("readout_id", data.id)
      .eq("label", label)
      .maybeSingle();
    return (fig?.id as string) ?? null;
  } catch {
    return null;
  }
}

export async function ask(input: AskInput): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured — the request was not queued");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_review_items")
      .insert({
        agent_id,
        readout_id: input.readoutId ?? null,
        figure_id: input.figureId ?? null,
        who: input.who.slice(0, 120),
        kind: input.kind,
        what: input.what.slice(0, 200),
        claim: input.claim.slice(0, 80),
        ceiling: input.ceiling,
        raised_by: "client",
        to_advance: TO_ADVANCE[input.kind],
      })
      .select("id")
      .single();
    if (error) return failed(error.message);
    return done({ id: data.id as string });
  } catch (e) {
    return failed(e);
  }
}

export async function openItems(): Promise<DbResult<ReviewItem[]>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");

  try {
    const { data, error } = await db
      .from("rift_review_items")
      .select("id,who,kind,what,claim,state,ceiling,raised_by,to_advance,confirmed_by,raised_at")
      .eq("agent_id", agent_id)
      .is("resolved_at", null)
      /* Oldest wait first. A review queue sorted by anything else is a to-do
         list, and the promise attached to the ask is about time. */
      .order("raised_at", { ascending: true });
    if (error) return failed(error.message);

    return done((data ?? []).map((r) => ({
      id: r.id as string,
      who: r.who as string,
      whoId: "",
      kind: r.kind as ReviewKind,
      what: r.what as string,
      claim: r.claim as string,
      state: r.state as TrustState,
      ceiling: r.ceiling as TrustState,
      raisedBy: r.raised_by as "client" | "agent" | "system",
      raisedAt: (r.raised_at as string).slice(0, 10),
      waitingHours: Math.floor((Date.now() - new Date(r.raised_at as string).getTime()) / 3_600_000),
      toAdvance: r.to_advance as string,
      ...(r.confirmed_by ? { confirmedBy: r.confirmed_by as string } : {}),
    })));
  } catch (e) {
    return failed(e);
  }
}

/**
 * Moves an item up one rung.
 *
 * The rung and naming rules are checked here against the shared engine, and
 * again by the database. Two layers because this is the one place a mistake
 * puts a green "verified" chip next to a figure nobody confirmed.
 */
export async function promoteItem(id: string, confirmedBy?: string): Promise<DbResult<{ state: TrustState }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");

  try {
    const { data, error } = await db
      .from("rift_review_items")
      .select("id,state,ceiling,kind,figure_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return failed(error.message);
    if (!data) return failed("no such review item");

    const item = { state: data.state, ceiling: data.ceiling } as ReviewItem;
    const to = nextRung(item);
    if (!to) return failed(ceilingNote(item) ?? "already at its ceiling");
    if (to === "verified" && !confirmedBy?.trim()) {
      return failed("Verification needs the name of who confirmed it, in writing. Without a name this is still an estimate.");
    }

    const patch: Record<string, unknown> = { state: to };
    if (confirmedBy) patch.confirmed_by = confirmedBy.slice(0, 200);
    if (to === "verified") patch.resolved_at = new Date().toISOString();

    const { error: upErr } = await db.from("rift_review_items").update(patch).eq("id", id);
    if (upErr) return failed(upErr.message);

    /* And the figure itself, which is the whole point.
       
       Without this the ladder was connected at neither end: promoting an item
       changed a row in Studio while the number the customer is looking at
       stayed "preliminary" forever. "Kaleb has been through this" was a fact
       recorded for the one person who already knew it. */
    const figureId = (data as { figure_id?: string | null }).figure_id;
    if (figureId) {
      const figurePatch: Record<string, unknown> = { trust_state: to };
      if (confirmedBy) figurePatch.confirmed_by = confirmedBy.slice(0, 200);
      const { error: figErr } = await db.from("rift_figures").update(figurePatch).eq("id", figureId);
      if (figErr) {
        /* The item advanced and the figure did not, which is exactly the state
           this change exists to prevent. Loud, not swallowed. */
        return failed(`review advanced but the figure did not: ${figErr.message}`);
      }
    }

    return done({ state: to });
  } catch (e) {
    return failed(e);
  }
}
