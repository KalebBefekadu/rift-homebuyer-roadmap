/**
 * The agent's own details: the five columns on `rift_agents` a person can see.
 *
 * They were written once by scripts/bootstrap-rift.mjs and never again, with
 * no way to change them short of the Supabase table editor. Since
 * 20260929100000 a session cannot write that table at all, which is right for
 * "who is the agent" and left "what is the agent's phone number" with no door.
 *
 * Every field says where it reaches, on the same terms as RULE_REACH in
 * ./settings.ts: three of these five are stored and read by nothing, and a
 * form that lets the agent type a licence number with no word that nothing
 * shows it is the dial-connected-to-nothing failure again. Recording it is
 * still worth having; pretending it is on a page is not.
 *
 * Pure: the rules for what a value may be, and what changed. The write and its
 * history are lib/db/profile.ts and `rift_update_agent_profile`.
 */

export const PROFILE_FIELDS = ["name", "email", "phone", "license", "brokerage"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export type AgentProfile = Record<ProfileField, string | null>;

export interface FieldSpec {
  label: string;
  /** Under the input: what goes here, in the words the agent would use. */
  hint: string;
  /** Null would leave the product without something it cannot do without. */
  required: boolean;
  max: number;
  /** The same shape as a rule's Reach: does changing it change anything a person sees? */
  reach: { live: boolean; where: string };
  /** On the setup list when empty. Only the ones a client or a regulator would expect. */
  expected: boolean;
}

export const PROFILE: Record<ProfileField, FieldSpec> = {
  name: {
    label: "Name",
    hint: "As clients know you.",
    required: true,
    max: 120,
    expected: true,
    reach: {
      live: true,
      where: "The client plan page, a client's journey portal and invitations, this sidebar, and the name recorded against every decision you make here. The public pages spell your name in their own text and do not read it from here.",
    },
  },
  email: {
    label: "Email",
    hint: "Where new-lead alerts and the morning summary go. Not your sign-in address, which stays as it is.",
    required: true,
    max: 200,
    expected: true,
    reach: {
      live: true,
      where: "New-lead and plan alerts, the morning summary, and the contact address in a client's journey portal.",
    },
  },
  phone: {
    label: "Phone",
    hint: "The number clients may call.",
    required: false,
    max: 40,
    expected: true,
    reach: {
      live: false,
      where: "Recorded only. No page or email shows it yet, so it is kept ready for the footer and signature that will.",
    },
  },
  license: {
    label: "Licence number",
    hint: "Your Georgia Real Estate Commission licence number.",
    required: false,
    max: 40,
    expected: true,
    reach: {
      live: false,
      where: "Recorded only. Nothing reads it yet; the search-engine profile on the public pages leaves it out rather than guess at it.",
    },
  },
  brokerage: {
    label: "Brokerage",
    hint: "The firm you are licensed under.",
    required: false,
    max: 120,
    expected: true,
    reach: {
      live: false,
      where: "Recorded only. The public footer, the readout and the privacy page spell \"Peachtree Cardinal\" in their own text, so changing this does not change them.",
    },
  },
};

export const PROFILE_LABEL: Record<ProfileField, string> = Object.fromEntries(
  PROFILE_FIELDS.map((f) => [f, PROFILE[f].label]),
) as Record<ProfileField, string>;

/* Loose on purpose. The only job is to refuse something that is plainly not
   an address, because a typo here sends every new-lead alert into the void
   and nothing anywhere would say so. Deliverability is Brevo's question. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/* Digits and the punctuation people write numbers with. An extension or a
   country code is fine; letters are a typo. */
const PHONE = /^\+?[0-9 ().-]{7,}$/;

export type Checked = { ok: true; value: string | null } | { ok: false; error: string };

/** One value, cleaned: trimmed, empty meaning "not recorded", and refused when it is not usable. */
export function checkField(field: ProfileField, raw: unknown): Checked {
  const spec = PROFILE[field];
  if (raw !== null && raw !== undefined && typeof raw !== "string") return { ok: false, error: `${spec.label} must be text.` };
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return spec.required ? { ok: false, error: `${spec.label} cannot be empty.` } : { ok: true, value: null };
  if (value.length > spec.max) return { ok: false, error: `${spec.label} is longer than ${spec.max} characters.` };
  if (field === "email" && !EMAIL.test(value)) return { ok: false, error: "That does not look like an email address." };
  if (field === "phone" && (!PHONE.test(value) || value.replace(/\D/g, "").length < 7)) {
    return { ok: false, error: "That does not look like a phone number." };
  }
  return { ok: true, value: field === "email" ? value.toLowerCase() : value };
}

/**
 * What a submitted form would change, field by field, or the first problem.
 *
 * Only fields that differ are returned, so saving an untouched form records
 * nothing: a history row that says "changed from X to X" is noise that makes
 * the real changes harder to find.
 */
export function profileChanges(
  current: AgentProfile,
  submitted: Partial<Record<ProfileField, unknown>>,
): { ok: true; changes: Partial<AgentProfile> } | { ok: false; field: ProfileField; error: string } {
  const changes: Partial<AgentProfile> = {};
  for (const f of PROFILE_FIELDS) {
    if (!(f in submitted)) continue;
    const c = checkField(f, submitted[f]);
    if (!c.ok) return { ok: false, field: f, error: c.error };
    if ((current[f] ?? null) !== c.value) changes[f] = c.value;
  }
  return { ok: true, changes };
}

/** Expected fields with nothing recorded, in form order. */
export function missingProfile(p: AgentProfile): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => PROFILE[f].expected && !(p[f] ?? "").trim());
}
