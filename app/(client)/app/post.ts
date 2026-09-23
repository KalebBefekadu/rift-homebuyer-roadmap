/**
 * The buyer's pages write through /api/app. One helper, so every button
 * reports a network failure the same way instead of hanging on "Saving…".
 */
export async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  try {
    const res = await fetch("/api/app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, error: "The server did not answer properly. Nothing was changed. Try again." };
    if (res.status === 429) return { ok: false, error: "Too many tries in a row. Wait a minute and try again." };
    return data;
  } catch {
    return { ok: false, error: "We could not reach the server. Nothing was changed. Check your connection and try again." };
  }
}
