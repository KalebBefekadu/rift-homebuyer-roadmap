/**
 * Campaign landing pages (Blueprint v5 §5.10; CAMP-01 to CAMP-03).
 *
 * A campaign is a recipe of approved blocks, each with validated
 * properties, and nothing else: no HTML, no scripts, no embeds, no custom
 * CSS, no formula anybody typed. The figures on a campaign page come from
 * the same values and engine as the rest of the site (CAMP-04), so a
 * campaign can change the words around a value, never its maths.
 *
 * Every saved recipe is a revision that is never edited. Publishing points
 * the campaign at a revision; rolling back points it at an earlier one; both
 * are recorded. A visitor stays on the revision they started on.
 *
 * The first recipe is the buyer's assistance path (CAMP-02): a heading,
 * the county's programs, the assistance value and its call to action. The
 * blocks below are the general composer's, kept deliberately few.
 *
 * Pure: no I/O.
 */

import { VALUES } from "./values";
import { GA_COUNTIES } from "./registry";

export type Block =
  | { type: "heading"; title: string; lede: string }
  | { type: "value"; valueId: string }
  | { type: "programs"; county: string }
  | { type: "text"; body: string }
  | { type: "cta"; label: string; valueId: string };

export type BlockType = Block["type"];
export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading",
  value: "A value (the tool itself)",
  programs: "Georgia programs for a county",
  text: "A paragraph",
  cta: "Call to action",
};

export interface Recipe { blocks: Block[] }

export const MAX_BLOCKS = 8;

/** The disclaimer a programs block always carries; it is not editable. */
export const PROGRAMS_DISCLAIMER =
  "The program and a participating lender decide who is eligible. Amounts and availability change; each program links to its official page.";

/* Words a campaign may not use: eligibility is the program's to decide, and
   nothing here promises an outcome (CAMP-05). */
const REFUSED = [/\bqualif(y|ies|ied)\b/i, /\bguarantee/i, /\bapproved\b/i, /\bfree money\b/i, /\bno credit check\b/i, /\bpre-?approved\b/i];
const CODE = /[<>{}]|javascript:|https?:\/\//i;

const liveValue = (id: string) => VALUES.some((v) => v.id === id && v.live);

/** Why one block is not allowed, or null. */
export function blockError(b: Block): string | null {
  const text = (s: string, label: string, min: number, max: number): string | null => {
    const t = s.trim();
    if (t.length < min) return `${label} is too short`;
    if (t.length > max) return `${label}: keep it under ${max} characters`;
    if (CODE.test(t)) return `${label}: plain words only, no code or links`;
    const bad = REFUSED.find((r) => r.test(t));
    if (bad) return `${label}: "${t.match(bad)![0]}" promises something the program or lender decides`;
    return null;
  };
  switch (b.type) {
    case "heading": return text(b.title, "The heading", 5, 90) ?? text(b.lede, "The line under it", 10, 220);
    case "text": return text(b.body, "The paragraph", 10, 600);
    case "value": return liveValue(b.valueId) ? null : "Choose one of the site's live values";
    case "cta": return text(b.label, "The button", 3, 40) ?? (liveValue(b.valueId) ? null : "Point the button at one of the site's live values");
    case "programs": return GA_COUNTIES.includes(b.county) ? null : "Choose a county Rift covers";
    default: return "That block is not one of the approved blocks";
  }
}

/** Why a recipe may not be saved, or an empty list. */
export function recipeErrors(r: Recipe): string[] {
  const out: string[] = [];
  if (!Array.isArray(r.blocks) || !r.blocks.length) return ["Add at least one block"];
  if (r.blocks.length > MAX_BLOCKS) out.push(`${MAX_BLOCKS} blocks at most`);
  if (r.blocks[0]?.type !== "heading") out.push("Start with a heading, so the page says what it is before anything else");
  if (!r.blocks.some((b) => b.type === "value" || b.type === "cta")) out.push("Include a value or a call to action: a campaign page leads to something useful");
  r.blocks.forEach((b, i) => {
    const e = blockError(b);
    if (e) out.push(`Block ${i + 1}: ${e}`);
  });
  return out;
}

/** Only the known properties of each block, whatever was posted: this becomes jsonb. */
export function cleanRecipe(raw: unknown): Recipe {
  const blocks = (Array.isArray((raw as Recipe)?.blocks) ? (raw as Recipe).blocks : []).slice(0, MAX_BLOCKS + 1);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    blocks: blocks.map((b): Block => {
      const x = b as Record<string, unknown>;
      switch (x.type) {
        case "heading": return { type: "heading", title: str(x.title, 200), lede: str(x.lede, 400) };
        case "value": return { type: "value", valueId: str(x.valueId, 40) };
        case "programs": return { type: "programs", county: str(x.county, 40) };
        case "cta": return { type: "cta", label: str(x.label, 80), valueId: str(x.valueId, 40) };
        default: return { type: "text", body: str(x.body, 1200) };
      }
    }),
  };
}

/** The first recipe (CAMP-02): the buyer's assistance path for one county. */
export function assistanceRecipe(county: string): Recipe {
  return {
    blocks: [
      { type: "heading", title: `Help buying a home in ${county} County`, lede: "See which Georgia programs may fit you, what each one checks, and the most they could add up to. No account, no call unless you ask for one." },
      { type: "programs", county },
      { type: "cta", label: "Check my programs", valueId: "assistance" },
    ],
  };
}

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/**
 * Which revision a visitor sees: the one in the address when they started
 * (it is never edited, so it still says what it said), otherwise the live
 * one. Null when the campaign is not published.
 */
export function versionFor(requested: string | undefined, live: number | null, versions: number[]): number | null {
  const v = Number(requested);
  if (requested && Number.isInteger(v) && versions.includes(v)) return v;
  return live;
}

export type PublicationAction = "publish" | "rollback" | "unpublish";
export interface Publication { action: PublicationAction; version: number | null; by: string; at: string }

/** The revision that is live, from the publication history. */
export function liveVersion(history: Publication[]): number | null {
  const last = [...history].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return !last || last.action === "unpublish" ? null : last.version;
}

/**
 * Whether a visit's campaign tag names this campaign. The public page tags the
 * values it links to with `<slug>-v<version>` (app/(rift)/c/[slug]/page.tsx),
 * so a tag is this campaign's when it is the slug or the slug and a version.
 * Matched exactly and never by prefix: "cobb" must not claim "cobb-sellers-v2".
 */
export function tagIsCampaign(tag: string | null | undefined, slug: string): boolean {
  if (!tag) return false;
  const t = tag.toLowerCase();
  /* A slug is lowercase letters, digits and hyphens (SLUG above), so a plain
     prefix check followed by a number is exact; no pattern is built from it. */
  return t === slug || (t.startsWith(`${slug}-v`) && /^\d+$/.test(t.slice(slug.length + 2)));
}
