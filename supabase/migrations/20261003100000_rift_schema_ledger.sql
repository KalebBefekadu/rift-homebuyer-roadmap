-- Which migrations production has, recorded by production.
--
-- Migrations reach production one file at a time through
-- scripts/apply-sql-migration.sh, by hand, and nothing recorded which ones had
-- arrived. A missed file showed up only as a page saying "not migrated yet",
-- on whichever page happened to read the missing column, and only if somebody
-- opened it. The script now writes one row here in the same request as each
-- migration, and /api/health compares the newest row with the newest file the
-- deployed code was built with (lib/db/schema-version.ts).
--
-- Service role only. It says nothing about anybody, but nothing in the product
-- reads it apart from the health check, so nothing else is granted.
create table if not exists public.rift_schema_migrations (
  name       text primary key check (name ~ '^[0-9]{14}_[a-z0-9_]+$'),
  applied_at timestamptz not null default now()
);

alter table public.rift_schema_migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_schema_migrations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_schema_migrations from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.rift_schema_migrations to service_role;
  end if;
end $$;

-- The baseline: every migration before this one. Each was applied through the
-- script when it was written (the build workflow applies, then deploys), and
-- there is no record to check them against, which is the problem this table
-- solves from here on. Their applied_at is when this baseline ran, not when
-- each was applied.
insert into public.rift_schema_migrations (name) values
  ('20260717000000_roadmap_mvp'),
  ('20260717200000_auth_agent_bootstrap'),
  ('20260718120000_client_portal_link'),
  ('20260907000000_rift_core'),
  ('20260907120000_rift_nurture_review'),
  ('20260907180000_rift_rates'),
  ('20260907190000_rift_lead_without_assessment'),
  ('20260907200000_rift_lead_inputs'),
  ('20260907210000_rift_question_types'),
  ('20260907220000_rift_review_figure'),
  ('20260907230000_rift_one_live_assessment'),
  ('20260908000000_rift_lead_survives_assessment'),
  ('20260908010000_rift_agent_survives_login'),
  ('20260908020000_rift_funnel_report'),
  ('20260909000000_rift_manage_real_people'),
  ('20260910000000_rift_next_action'),
  ('20260920000000_rift_attribution_sweep_index'),
  ('20260920010000_rift_events_allowlist'),
  ('20260920020000_rift_forget_reaches_the_lead'),
  ('20260920030000_rift_client_plan'),
  ('20260920040000_rift_offers'),
  ('20260921010000_rift_referral_moments'),
  ('20260921030000_rift_referral_attribution'),
  ('20260921040000_rift_representation'),
  ('20260921050000_rift_decisions'),
  ('20260921060000_rift_inbound_offers'),
  ('20260921070000_rift_offer_room'),
  ('20260923000000_rift_plain_punctuation'),
  ('20260923010000_rift_journeys'),
  ('20260923020000_rift_journey_members'),
  ('20260923030000_rift_search'),
  ('20260923040000_rift_shortlist'),
  ('20260923050000_rift_search_command_grants'),
  ('20260924000000_rift_tours'),
  ('20260924010000_rift_progress'),
  ('20260924020000_rift_offers_documents'),
  ('20260924030000_rift_deadlines_jobs'),
  ('20260924040000_rift_summary_job'),
  ('20260925000000_rift_closing'),
  ('20260925010000_rift_reconciliations'),
  ('20260926000000_rift_events_allowlist_values'),
  ('20260926010000_rift_saved_plan'),
  ('20260926020000_rift_assistance_programs'),
  ('20260926030000_rift_program_checks'),
  ('20260927000000_rift_offer_pdf_ai'),
  ('20260927010000_rift_outbox'),
  ('20260927020000_rift_summary_links'),
  ('20260928000000_rift_desk_marks'),
  ('20260928010000_rift_money_facts'),
  ('20260928020000_rift_journey_dependencies'),
  ('20260928030000_rift_seller_stages'),
  ('20260928040000_rift_seller_money'),
  ('20260928050000_rift_listing'),
  ('20260928060000_rift_campaigns'),
  ('20260928070000_rift_ai_campaign_draft'),
  ('20260929100000_rift_agents_not_self_service'),
  ('20260929100100_rift_leads_no_shared_session'),
  ('20260929200000_rift_outbox_one_step_at_a_time'),
  ('20260929300000_rift_programs_rules_refresh'),
  ('20260929300100_drop_retired_mvp_auth_hooks'),
  ('20260929400000_rift_question_wording'),
  ('20260929410000_rift_agent_profile_changes')
on conflict (name) do nothing;
