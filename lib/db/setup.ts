import "server-only";
import { rulesOrDefaults } from "./settings";
import { agentProfile } from "./profile";
import { lastSenderVerdict } from "./sender";
import { resolveSiteUrl, type Env } from "@/lib/core/site";
import { KEYS, WRONG_IN_AM, unreviewedAm } from "@/lib/core/i18n";
import { setupTodo, type SetupFacts } from "@/lib/core/setup";

/**
 * The facts the setup list is computed from (lib/core/setup.ts), gathered.
 *
 * The environment is read here and only here, and only as "set or not": the
 * values never leave this function. The site address is the exception, and
 * it is not a secret: it is printed in every link the product sends.
 */

type EnvFacts = Omit<SetupFacts, "undecided" | "profile" | "jobs">;

export function envFacts(env: Env = process.env as Env): EnvFacts {
  const set = (k: string) => Boolean(env[k]?.trim());
  return {
    email: { key: set("BREVO_API_KEY"), sender: set("BREVO_FROM_EMAIL"), verdict: lastSenderVerdict() },
    calendar: { key: set("CAL_API_KEY"), eventType: set("CAL_EVENT_TYPE_ID") },
    ai: set("ANTHROPIC_API_KEY"),
    monitoring: set("NEXT_PUBLIC_SENTRY_DSN") || set("SENTRY_DSN"),
    cronSecret: set("CRON_SECRET"),
    site: { explicit: set("NEXT_PUBLIC_SITE_URL"), resolved: resolveSiteUrl(env) },
    amharic: { unreviewed: unreviewedAm().length, total: KEYS.length, wrong: WRONG_IN_AM.length },
  };
}

/**
 * The sidebar's count, for the layout on every Operations page.
 *
 * Two reads, both cached for the request and both ones the settings page
 * makes anyway, run side by side; the rest is the environment. It never asks
 * Brevo and never reads the job runs: see setupTodo() for why the badge
 * counts only what these can decide.
 */
export async function setupTodoCount(agentId: string): Promise<number> {
  const [rules, profile] = await Promise.all([rulesOrDefaults(agentId), agentProfile(agentId)]);
  return setupTodo({
    ...envFacts(),
    undecided: rules.undecided,
    profile: profile.ok && "data" in profile ? profile.data : null,
  });
}
