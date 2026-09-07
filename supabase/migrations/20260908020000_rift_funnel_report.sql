-- ============================================================================
-- Aggregate the funnel report in the database.
--
-- It was fetching every matching event and counting distinct sessions in
-- JavaScript. At a year of traffic that is 45,000 rows over the wire to produce
-- seven numbers, on every Studio load. At five years it is a page that times
-- out, and the failure arrives exactly when the data finally means something.
--
-- The window matters more than the speed. The report had no time bound, so it
-- mixed last year's funnel with this week's — and the whole point of measuring
-- drop-off is to change a question and see whether it helped. Averaged against
-- twelve months of the old wording, it never will.
-- ============================================================================

create or replace function rift_funnel_report(
  p_agent uuid,
  p_side text,
  p_days integer default 90
)
returns table (
  question_key text,
  reached integer,
  answered integer,
  median_dwell_ms integer
)
language sql
stable
security definer
set search_path = public
as $$
  with windowed as (
    select session_id, name, question_key, dwell_ms
    from rift_events
    where agent_id = p_agent
      and side = p_side
      and at >= now() - (p_days || ' days')::interval
      and name in ('question_view', 'question_answer')
      and question_key is not null
  )
  select
    w.question_key,
    count(distinct w.session_id) filter (where w.name = 'question_view')::integer,
    count(distinct w.session_id) filter (where w.name = 'question_answer')::integer,
    /* The median, not the mean. One person who left a tab open for an hour
       would otherwise turn "they read it and declined" into "they bounced off
       it" for everybody else — and those two want opposite remedies. */
    coalesce(
      percentile_cont(0.5) within group (order by w.dwell_ms)
        filter (where w.name = 'question_answer' and w.dwell_ms is not null),
      0
    )::integer
  from windowed w
  group by w.question_key;
$$;

create or replace function rift_funnel_starts(
  p_agent uuid,
  p_side text,
  p_days integer default 90
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct session_id)::integer
  from rift_events
  where agent_id = p_agent
    and side = p_side
    and at >= now() - (p_days || ' days')::interval
    and name = 'assessment_start';
$$;

-- The report reads a narrow slice by agent, side and recency. Without this it
-- is a sequential scan over every event ever recorded.
create index if not exists rift_events_report_idx
  on rift_events (agent_id, side, at desc)
  where question_key is not null;

-- Granted only to roles that exist. Supabase provides `anon` and
-- `authenticated`; the local test harness has neither by default, and a
-- migration that cannot run locally is a migration nobody tests.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function rift_funnel_report(uuid, text, integer) to %I', r);
      execute format('grant execute on function rift_funnel_starts(uuid, text, integer) to %I', r);
    end if;
  end loop;
end $$;
