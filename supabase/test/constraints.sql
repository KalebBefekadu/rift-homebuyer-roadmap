\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into rift_agents (id, auth_user_id, name, email)
  values ('11111111-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Kaleb','k@example.com')
  on conflict do nothing;
insert into rift_funnels (id, agent_id, side) values ('22222222-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','buy') on conflict do nothing;
insert into rift_funnel_versions (id, funnel_id, version) values ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001',1) on conflict do nothing;
insert into rift_assessments (id, agent_id, session_id, side) values ('44444444-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','s1','buy') on conflict do nothing;
insert into rift_readouts (id, agent_id, assessment_id, side, share_token, inputs, figures)
  values ('55555555-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','44444444-0000-4000-8000-000000000001','buy','tok1','{}','{}') on conflict do nothing;

\echo '--- 1. a custom question must not bind to a compute field ---'
insert into rift_questions (funnel_version_id, key, kind, bound, type, title)
  values ('33333333-0000-4000-8000-000000000001','q_custom','custom','savings','text','Anything else?');

\echo '--- 2. a core question must bind to one ---'
insert into rift_questions (funnel_version_id, key, kind, bound, type, title)
  values ('33333333-0000-4000-8000-000000000001','q_core','core',null,'money','Savings?');

\echo '--- 3. a telemetry event must not carry an answer ---'
insert into rift_events (agent_id, session_id, name, payload)
  values ('11111111-0000-4000-8000-000000000001','s1','question_answer','{"value":42000}');

\echo '--- 4. verified requires a named party ---'
insert into rift_figures (agent_id, readout_id, label, value_cents, trust_state, assumptions, could_be_wrong)
  values ('11111111-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000001','Cash to close',2618750,'verified','[{"l":"price"}]','Rates move and escrow depends on closing date.');

\echo '--- 5. a figure must carry assumptions ---'
insert into rift_figures (agent_id, readout_id, label, value_cents, assumptions, could_be_wrong)
  values ('11111111-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000001','Cash to close',2618750,'[]','Rates move and escrow depends on closing date.');

\echo '--- 6. first touch is immutable ---'
insert into rift_attributions (session_id, agent_id, first_source, last_source)
  values ('s1','11111111-0000-4000-8000-000000000001','facebook','facebook');
update rift_attributions set first_source = 'google' where session_id = 's1';

\echo '--- 7. last touch MAY move (this one must succeed) ---'
update rift_attributions set last_source = 'google', visits = visits + 1 where session_id = 's1';
select session_id, first_source, last_source, visits from rift_attributions where session_id='s1';

\echo '--- 8. a valid figure inserts (this one must succeed) ---'
insert into rift_figures (agent_id, readout_id, label, value_cents, trust_state, confirmed_by, assumptions, could_be_wrong)
  values ('11111111-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000001','Pre-approval',34000000,'verified','Brookhaven Mortgage, 3 Sep 2026','[{"l":"rate"}]','A lender re-checks income before closing.');
select label, trust_state, confirmed_by from rift_figures where label='Pre-approval';
