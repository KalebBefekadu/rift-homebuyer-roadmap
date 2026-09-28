/**
 * A number a person typed into a form.
 *
 * "$350,000" and "350000" read as 350000; blank is null (not given); anything
 * else is NaN, for the form to refuse. The forms used to strip every
 * character that was not a digit, so "about 350k" was recorded as $350 and
 * "3 or 4" bedrooms as 34, with nothing on screen to say so. Refusing is the
 * honest answer: the agent can see what they typed and fix it.
 *
 * Pure: no I/O.
 */
export function typedNumber(value: unknown): number | null {
  const t = String(value ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** The first of these form fields that holds something that is not a number, or null when all read. */
export function unreadableField(form: FormData, fields: Record<string, string>): string | null {
  for (const [name, label] of Object.entries(fields)) {
    if (Number.isNaN(typedNumber(form.get(name)))) return label;
  }
  return null;
}
