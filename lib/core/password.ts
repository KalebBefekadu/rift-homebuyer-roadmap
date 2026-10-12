/**
 * The client password rule, shared by the page that sets one and the server
 * that refuses a bad one, so the two never disagree about what is allowed.
 *
 * Length, not character classes. A long phrase is stronger than a short
 * string with a symbol in it, and "must contain a number" mostly teaches
 * people to add a 1. 72 is where bcrypt (Supabase's hash) stops reading, so
 * anything past it would be silently ignored.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

export function passwordError(pw: string, email?: string | null): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (/^(.)\1+$/.test(pw)) return "Use something other than one repeated character.";
  if (email && pw.trim().toLowerCase() === email.trim().toLowerCase()) return "Use something other than your email address.";
  return null;
}
