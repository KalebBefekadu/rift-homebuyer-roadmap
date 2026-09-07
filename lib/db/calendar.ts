import "server-only";
import { captureOpError } from "@/lib/monitoring/capture";

/**
 * Consultation booking.
 *
 * Written against an interface rather than a vendor, because the vendor is the
 * least durable thing here. Cal.com is the implementation; swapping it should
 * touch this file and nothing else.
 *
 * The rule that survives any provider: **never offer a slot that is not real.**
 * A booking screen showing invented times is a promise the product cannot keep,
 * and the person discovers that only after choosing one — at the exact moment
 * they had decided to trust it. When availability cannot be fetched, the UI is
 * told so and asks the agent to confirm instead of inventing four options.
 */

export interface Slot {
  /** ISO 8601, UTC. */
  start: string;
  end: string;
  /** How it reads to a person, in the agent's timezone. */
  label: string;
}

export type Availability =
  | { ok: true; slots: Slot[]; source: "calendar" }
  | { ok: true; slots: []; source: "unconfigured"; reason: string }
  | { ok: false; error: string };

const TZ = process.env.RIFT_TIMEZONE || "America/New_York";

function label(startISO: string): string {
  const d = new Date(startISO);
  return d.toLocaleString("en-US", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Real availability, or an honest absence of it.
 *
 * Returns an empty list with a stated reason when unconfigured — never a
 * plausible-looking default. That distinction is the whole point of this
 * module: `slots: []` with `source: "unconfigured"` is a different thing from
 * "the agent has no free time", and the booking screen says something
 * different for each.
 */
export async function availability(days = 7): Promise<Availability> {
  const key = process.env.CAL_API_KEY;
  const eventTypeId = process.env.CAL_EVENT_TYPE_ID;

  if (!key || !eventTypeId) {
    return {
      ok: true,
      slots: [],
      source: "unconfigured",
      reason: "CAL_API_KEY or CAL_EVENT_TYPE_ID not set — no real availability to show",
    };
  }

  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);

  try {
    const url = new URL("https://api.cal.com/v1/slots");
    url.searchParams.set("apiKey", key);
    url.searchParams.set("eventTypeId", eventTypeId);
    url.searchParams.set("startTime", from.toISOString());
    url.searchParams.set("endTime", to.toISOString());
    url.searchParams.set("timeZone", TZ);

    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Cal ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const body = (await res.json()) as { slots?: Record<string, { time: string }[]> };
    const slots: Slot[] = Object.values(body.slots ?? {})
      .flat()
      .slice(0, 8)
      .map((s) => ({
        start: s.time,
        end: new Date(new Date(s.time).getTime() + 20 * 60_000).toISOString(),
        label: label(s.time),
      }));

    return { ok: true, slots, source: "calendar" };
  } catch (error) {
    captureOpError(error, { op: "calendar.availability" });
    return { ok: false, error: error instanceof Error ? error.message : "availability failed" };
  }
}

export interface BookInput {
  start: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
}

/**
 * Takes a slot.
 *
 * Fails loudly rather than silently, because the alternative is somebody
 * believing they have an appointment that does not exist — which is worse than
 * not being able to book at all, and is discovered by them rather than by us.
 */
export async function book(input: BookInput): Promise<{ ok: true; id: string } | { ok: true; skipped: true; reason: string } | { ok: false; error: string }> {
  const key = process.env.CAL_API_KEY;
  const eventTypeId = process.env.CAL_EVENT_TYPE_ID;
  if (!key || !eventTypeId) {
    return { ok: true, skipped: true, reason: "calendar not configured — the request was recorded but no slot was held" };
  }

  try {
    const res = await fetch(`https://api.cal.com/v1/bookings?apiKey=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventTypeId: Number(eventTypeId),
        start: input.start,
        responses: {
          name: input.name || "Rift visitor",
          email: input.email,
          ...(input.phone ? { attendeePhoneNumber: input.phone } : {}),
        },
        timeZone: TZ,
        language: "en",
        /* The call is about their computed blocker, carried from the readout.
           A generic slot asks somebody to decide what to talk about, which is
           work, at the moment of conversion. */
        title: `Rift — ${input.topic}`.slice(0, 120),
        metadata: {},
      }),
    });
    if (!res.ok) throw new Error(`Cal ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { id?: number | string; uid?: string };
    return { ok: true, id: String(body.uid ?? body.id ?? "booked") };
  } catch (error) {
    captureOpError(error, { op: "calendar.book" });
    return { ok: false, error: error instanceof Error ? error.message : "booking failed" };
  }
}
