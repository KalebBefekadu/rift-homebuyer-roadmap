/**
 * A phone number as Brevo's SMS API wants it: country code and digits, no
 * plus, no punctuation ("14045550123").
 *
 * The agent's number is typed into Settings in whatever shape people type
 * phone numbers. Ten digits is a U.S. number (the product is one Georgia
 * agent); eleven starting with 1 is the same with its country code; anything
 * written with a leading "+" is taken as international. Anything else is not
 * guessed at: a text sent to a wrong number is a lead's details in a
 * stranger's pocket.
 *
 * Pure: no I/O.
 */
export function smsNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? digits : null;
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return null;
}
