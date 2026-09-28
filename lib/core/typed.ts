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

/**
 * The same, for an amount that can honestly be below zero: a decision option
 * that costs money rather than saving it. A leading minus is read, whether
 * typed as "-$5,000", "$-5,000" or pasted with the typographic minus sign;
 * everything else is refused exactly as `typedNumber` refuses it, so "about
 * -5k" is still NaN rather than -5.
 */
export function typedSignedNumber(value: unknown): number | null {
  const t = String(value ?? "").replace(/[$,\s]/g, "").replace(/^−/, "-");
  if (!t) return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  /* "-0" is zero, not a negative zero that formats as "-$0". */
  return Number(t) || 0;
}

/**
 * The first of these form fields that holds something that is not a number,
 * or null when all read. `read` is `typedSignedNumber` for fields that may be
 * negative.
 */
export function unreadableField(
  form: FormData,
  fields: Record<string, string>,
  read: (value: unknown) => number | null = typedNumber,
): string | null {
  for (const [name, label] of Object.entries(fields)) {
    if (Number.isNaN(read(form.get(name)))) return label;
  }
  return null;
}
