import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedReport, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { SLUG, cleanRecipe, liveVersion, recipeErrors, tagIsCampaign, versionFor, type Publication, type PublicationAction, type Recipe } from "@/lib/core/campaign";
import { isUuid } from "@/lib/core/ids";

/**
 * The only reader and writer of campaigns, their revisions and their
 * publication history (CAMP-01 to CAMP-03). Rules: lib/core/campaign.ts.
 * Null means the tables are not there yet (migration 20260928060000).
 */

const MISSING = /rift_campaign|does not exist|schema cache/;
const rows = (r: DbResult<unknown>) => (r.ok && "data" in r ? (r.data as Record<string, unknown>[]) : []);

export interface CampaignSummary { id: string; slug: string; name: string; live: number | null; versions: number; createdAt: string }
export interface CampaignDetail extends CampaignSummary {
  revisions: { version: number; recipe: Recipe; note: string | null; by: string; at: string }[];
  history: Publication[];
}

async function scope() {
  const db = serviceClient();
  if (!db) return { db: null, agentId: null, why: "no database configured" } as const;
  const agentId = await currentAgentId();
  if (!agentId) return { db: null, agentId: null, why: "not signed in" } as const;
  return { db, agentId, why: null } as const;
}

export async function campaigns(): Promise<DbResult<CampaignSummary[] | null>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const [c, r, p] = await Promise.all([
    boundedRead(s.db.from("rift_campaigns").select("id,slug,name,created_at").eq("agent_id", s.agentId).order("created_at", { ascending: false }).limit(100), "the campaigns"),
    boundedRead(s.db.from("rift_campaign_revisions").select("campaign_id,version").eq("agent_id", s.agentId).limit(2000), "their revisions"),
    boundedRead(s.db.from("rift_campaign_publications").select("campaign_id,action,version,actor_label,created_at").eq("agent_id", s.agentId).order("created_at").limit(2000), "what is live"),
  ]);
  for (const x of [c, r, p]) if (!x.ok) return MISSING.test(x.error) ? done(null) : x;
  return done(rows(c).map((x) => ({
    id: x.id as string, slug: x.slug as string, name: x.name as string, createdAt: x.created_at as string,
    versions: rows(r).filter((v) => v.campaign_id === x.id).length,
    live: liveVersion(rows(p).filter((v) => v.campaign_id === x.id).map(pub)),
  })));
}

const pub = (v: Record<string, unknown>): Publication => ({
  action: v.action as PublicationAction, version: (v.version as number | null) ?? null, by: v.actor_label as string, at: v.created_at as string,
});

async function detail(db: NonNullable<ReturnType<typeof serviceClient>>, campaign: Record<string, unknown>): Promise<DbResult<CampaignDetail>> {
  const [r, p] = await Promise.all([
    boundedRead(db.from("rift_campaign_revisions").select("version,recipe,note,actor_label,created_at").eq("campaign_id", campaign.id as string).order("version").limit(200), "the revisions"),
    boundedRead(db.from("rift_campaign_publications").select("action,version,actor_label,created_at").eq("campaign_id", campaign.id as string).order("created_at").limit(500), "what is live"),
  ]);
  if (!r.ok) return r;
  if (!p.ok) return p;
  const history = rows(p).map(pub);
  return done({
    id: campaign.id as string, slug: campaign.slug as string, name: campaign.name as string, createdAt: campaign.created_at as string,
    versions: rows(r).length, live: liveVersion(history), history,
    revisions: rows(r).map((v) => ({ version: v.version as number, recipe: cleanRecipe(v.recipe), note: (v.note as string | null) ?? null, by: v.actor_label as string, at: v.created_at as string })),
  });
}

export async function campaignFor(id: string): Promise<DbResult<CampaignDetail | null>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  if (!isUuid(id)) return done(null);
  const c = await boundedRead(s.db.from("rift_campaigns").select("id,slug,name,created_at").eq("id", id).eq("agent_id", s.agentId).maybeSingle(), "the campaign");
  if (!c.ok) return MISSING.test(c.error) ? done(null) : c;
  const row = ("data" in c ? c.data : null) as Record<string, unknown> | null;
  return row ? detail(s.db, row) : done(null);
}

/** What a visitor sees at /c/<slug>: the revision they started on, or the live one. Null when there is nothing to show. */
export async function publicCampaign(slug: string, requested: string | undefined): Promise<DbResult<{ slug: string; version: number; recipe: Recipe } | null>> {
  if (!SLUG.test(slug)) return done(null);
  const db = serviceClient();
  if (!db) return done(null);
  const c = await boundedRead(db.from("rift_campaigns").select("id,slug,name,created_at").eq("slug", slug).maybeSingle(), "the page");
  if (!c.ok) return MISSING.test(c.error) ? done(null) : c;
  const row = ("data" in c ? c.data : null) as Record<string, unknown> | null;
  if (!row) return done(null);
  const d = await detail(db, row);
  if (!d.ok || !("data" in d)) return d as DbResult<never>;
  /* An unpublished campaign shows nothing, even to someone holding an old version link. */
  if (d.data.live === null) return done(null);
  const v = versionFor(requested, d.data.live, d.data.revisions.map((x) => x.version));
  const rev = d.data.revisions.find((x) => x.version === v);
  return done(rev ? { slug, version: rev.version, recipe: rev.recipe } : null);
}

export async function createCampaign(input: { slug: string; name: string; recipe: Recipe; by: string; requestId: string }): Promise<DbResult<{ id: string }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  if (!SLUG.test(input.slug)) return failed("The address: 3 to 40 lowercase letters, numbers and dashes");
  if (input.name.trim().length < 3) return failed("Give the campaign a name");
  const errors = recipeErrors(input.recipe);
  if (errors.length) return failed(errors[0]!);
  const c = await boundedWrite(s.db.from("rift_campaigns").insert({ agent_id: s.agentId, slug: input.slug, name: input.name.trim().slice(0, 120), actor_label: input.by.slice(0, 120) }).select("id").single(), "the campaign");
  if (!c.ok) {
    if (/duplicate key|rift_campaigns_slug/.test(c.error)) return failed("That address is taken. Choose another");
    return MISSING.test(c.error) ? failed("Campaigns need migration 20260928060000") : c;
  }
  const id = (("data" in c ? c.data : null) as { id: string }).id;
  const r = await saveRevision(id, input.recipe, 0, "First version", input.by, input.requestId);
  return r.ok && "data" in r ? done({ id }) : (r as DbResult<never>);
}

export async function saveRevision(campaignId: string, recipe: Recipe, expectedVersion: number, note: string | null, by: string, requestId: string): Promise<DbResult<{ version: number }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const errors = recipeErrors(recipe);
  if (errors.length) return failed(errors[0]!);
  const w = await boundedWrite(s.db.from("rift_campaign_revisions").insert({
    agent_id: s.agentId, campaign_id: campaignId, version: expectedVersion + 1, recipe, note: note?.trim().slice(0, 300) || null,
    actor_label: by.slice(0, 120), request_id: requestId,
  }), "the revision");
  if (!w.ok) {
    if (/rift_campaign_revisions_request/.test(w.error)) return done({ version: expectedVersion + 1 });
    if (/rift_campaign_revisions_version|duplicate key/.test(w.error)) return failed("Someone saved a version since the page loaded. Reload and try again");
    return MISSING.test(w.error) ? failed("Campaigns need migration 20260928060000") : w;
  }
  return done({ version: expectedVersion + 1 });
}

export async function publish(campaignId: string, action: PublicationAction, version: number | null, by: string, requestId: string): Promise<DbResult<{ live: number | null }>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const d = await campaignFor(campaignId);
  if (!d.ok || !("data" in d)) return d as DbResult<never>;
  if (!d.data) return failed("That campaign is not yours");
  if (action !== "unpublish") {
    if (!d.data.revisions.some((r) => r.version === version)) return failed("Choose a saved version");
    if (version === d.data.live) return failed(`Version ${version} is already live`);
    if (action === "rollback" && (d.data.live === null || version! >= d.data.live)) return failed("Roll back to an earlier version than the live one");
    /* Validated again at publish: a rule added since it was saved still applies. */
    const errors = recipeErrors(d.data.revisions.find((r) => r.version === version)!.recipe);
    if (errors.length) return failed(`Version ${version} cannot be published: ${errors[0]}`);
  } else if (d.data.live === null) return failed("It is not live");
  const w = await boundedWrite(s.db.from("rift_campaign_publications").insert({
    agent_id: s.agentId, campaign_id: campaignId, action, version: action === "unpublish" ? null : version, actor_label: by.slice(0, 120), request_id: requestId,
  }), "what is live");
  if (!w.ok) return /duplicate key/.test(w.error) ? done({ live: action === "unpublish" ? null : version }) : w;
  return done({ live: action === "unpublish" ? null : version });
}

export interface CampaignResult { visitors: number; leads: number }

/**
 * What each campaign brought in over the last `days`: the browser sessions
 * whose first visit carried its tag, and the leads those sessions became.
 * First touch only (rule 7): a visit that arrived another way and later
 * clicked through is not this campaign's. Keyed by slug.
 *
 * Two reads whatever the number of campaigns. Counts are labelled as visits
 * and leads, never as conversions of anything else, because the tag is all
 * the page can know.
 */
export async function campaignResults(slugs: string[], days = 90): Promise<DbResult<Map<string, CampaignResult>>> {
  const s = await scope();
  if (!s.db) return skipped(s.why!);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const visits = await boundedReport(
    s.db.from("rift_attributions").select("session_id,first_campaign").eq("agent_id", s.agentId)
      .not("first_campaign", "is", null).gte("first_at", since).limit(20_000),
    "the campaign visits",
  );
  if (!visits.ok) return visits;
  const list = rows(visits) as { session_id: string; first_campaign: string }[];
  const out = new Map<string, CampaignResult>(slugs.map((slug) => [slug, { visitors: 0, leads: 0 }]));
  const sessionsOf = new Map<string, string>();
  for (const v of list) {
    const slug = slugs.find((x) => tagIsCampaign(v.first_campaign, x));
    if (!slug) continue;
    out.get(slug)!.visitors += 1;
    sessionsOf.set(v.session_id, slug);
  }
  if (sessionsOf.size) {
    const leads = await boundedReport(
      s.db.from("rift_leads").select("session_id").eq("agent_id", s.agentId).in("session_id", [...sessionsOf.keys()].slice(0, 400)).limit(2000),
      "the campaign leads",
    );
    if (!leads.ok) return leads;
    for (const l of rows(leads) as { session_id: string }[]) {
      const slug = sessionsOf.get(l.session_id);
      if (slug) out.get(slug)!.leads += 1;
    }
  }
  return done(out);
}
