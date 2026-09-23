/**
 * The journey page writes through /api/studio/journey (why: journey/ops.ts).
 * One helper, so every button reports a network failure the same way instead
 * of hanging on "Saving…".
 */
export type Sent = { ok: boolean; error?: string } & Record<string, unknown>;

export async function send(op: string, body: Record<string, unknown>): Promise<Sent> {
  try {
    const res = await fetch("/api/studio/journey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, ...body }),
    });
    const data = (await res.json().catch(() => null)) as Sent | null;
    if (res.status === 429) return { ok: false, error: "Too many tries in a row. Wait a minute and try again." };
    if (!data) return { ok: false, error: "The server did not answer properly. Nothing was changed. Try again." };
    return data;
  } catch {
    return { ok: false, error: "Rift could not be reached. Nothing was changed. Check the connection and try again." };
  }
}
