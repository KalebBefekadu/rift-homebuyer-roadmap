-- ============================================================================
-- The values' questions, as the agent words them (Blueprint v5 D37, reversing
-- D31's "no editor").
--
--   rift_question_versions   each published set of wording. Never edited; the
--                            version counts up per agent.
--   rift_question_wordings   one row per question in a version: a built-in
--                            question whose words differ from the code's
--                            (lib/core/asks.ts), or one of the agent's own.
--   rift_custom_answers      a lead's answers to the agent's own questions,
--                            in the words they were shown.
--   rift_leads.question_version_id
--                            the version the page they saved from was
--                            rendered with. Null is the code's own wording.
--
-- Why new tables rather than rift_funnels / rift_funnel_versions /
-- rift_questions: those are the retired v4 questionnaire's (D31). They are one
-- funnel per side with only 'buy' and 'sell', while a v5 answer is worded
-- once and shared by every value on every side ('price' is asked on the buyer
-- and the abroad side alike); their rows hold v4 keys that no value asks; and
-- rift_leads.funnel_version_id already means "the v4 questionnaire", so
-- reusing it would make one column mean two things on old and new leads.
-- They stay, untouched, for the leads that point at them.
--
-- The v4 table's one load-bearing rule is carried over word for word: a
-- custom question can never feed a calculation (custom_questions_are_inert).
-- A custom key must start `x_`, which no compute input does, so it cannot be
-- confused with one either.
--
-- History only (trigger on update). Publishing is one statement through
-- rift_publish_questions, so a version can never exist with half its rows:
-- a version with none would read as "everything back to the code's words".
-- Written only by lib/db/questions.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_question_versions (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  version      integer not null check (version >= 1),
  note         text check (note is null or length(btrim(note)) between 1 and 300),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null,
  created_at   timestamptz not null default now(),
  constraint rift_question_versions_request unique (agent_id, request_id),
  constraint rift_question_versions_version unique (agent_id, version),
  constraint rift_question_versions_id_agent unique (id, agent_id)
);

create table if not exists public.rift_question_wordings (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null,
  version_id  uuid not null,
  key         text not null,
  kind        text not null check (kind in ('builtin', 'custom')),
  -- The compute input this question's answer feeds. A built-in question
  -- names its own; a custom one must not name any.
  bound       text,
  type        text not null check (type in ('choice', 'money', 'text')),
  title       text not null check (length(btrim(title)) between 3 and 160),
  why         text check (why is null or length(btrim(why)) between 1 and 300),
  unit        text check (unit is null or length(btrim(unit)) between 1 and 40),
  options     jsonb not null default '[]'::jsonb
                check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 12),
  sides       text[] not null default '{}' check (sides <@ array['buy', 'sell', 'abroad']::text[]),
  value_ids   text[] not null default '{}',
  position    integer not null default 0 check (position >= 0),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint rift_question_wordings_version foreign key (version_id, agent_id)
    references public.rift_question_versions (id, agent_id) on delete cascade,
  constraint rift_question_wordings_once unique (version_id, key),
  constraint rift_question_wordings_key_agent unique (version_id, key, agent_id),
  constraint custom_questions_are_inert check (kind = 'builtin' or bound is null),
  constraint builtin_questions_feed_their_own_answer check (kind = 'custom' or bound = key),
  constraint custom_keys_cannot_name_an_input check (kind = 'builtin' or key ~ '^x_[a-z0-9]{6,24}$'),
  constraint custom_questions_are_choice_or_text check (kind = 'builtin' or type in ('choice', 'text')),
  constraint custom_choices_have_options check (kind = 'builtin' or type <> 'choice' or jsonb_array_length(options) between 2 and 8),
  constraint custom_questions_name_a_side check (kind = 'builtin' or cardinality(sides) >= 1),
  constraint builtin_wording_is_words_only check (kind = 'custom' or (cardinality(sides) = 0 and cardinality(value_ids) = 0))
);
create index if not exists rift_question_wordings_version_idx on public.rift_question_wordings (version_id);

create table if not exists public.rift_custom_answers (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents (id) on delete cascade,
  lead_id       uuid not null,
  version_id    uuid not null,
  question_key  text not null check (question_key ~ '^x_[a-z0-9]{6,24}$'),
  -- The question and the answer as they were shown, not a reference to them:
  -- a later version may reword both, and what somebody was asked is not
  -- rewritten (rule 4).
  question      text not null check (length(btrim(question)) between 3 and 160),
  answer        text not null check (length(btrim(answer)) between 1 and 300),
  answer_label  text not null check (length(btrim(answer_label)) between 1 and 300),
  created_at    timestamptz not null default now(),
  constraint rift_custom_answers_lead foreign key (lead_id, agent_id)
    references public.rift_leads (id, agent_id) on delete cascade,
  -- Only to a custom question that the version they were shown has.
  constraint rift_custom_answers_question foreign key (version_id, question_key, agent_id)
    references public.rift_question_wordings (version_id, key, agent_id),
  constraint rift_custom_answers_once unique (lead_id, question_key)
);
create index if not exists rift_custom_answers_lead_idx on public.rift_custom_answers (lead_id);

-- The foreign key proves the question exists in that version; this proves it
-- is one of the agent's own. A built-in question's answer lives in the saved
-- plan, where it is parsed and bounded, never here as free text.
create or replace function public.rift_custom_answers_to_custom() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.rift_question_wordings
     where version_id = new.version_id and key = new.question_key and kind = 'custom'
  ) then
    raise exception 'only the agent''s own questions are answered here' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_custom_answers_to_custom on public.rift_custom_answers;
create trigger rift_custom_answers_to_custom before insert on public.rift_custom_answers
  for each row execute function public.rift_custom_answers_to_custom();

alter table public.rift_leads
  add column if not exists question_version_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_question_version') then
    alter table public.rift_leads add constraint rift_leads_question_version
      foreign key (question_version_id, agent_id) references public.rift_question_versions (id, agent_id);
  end if;
end $$;

create or replace function public.rift_questions_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; publish a new version', tg_table_name
    using errcode = 'check_violation';
end $$;

-- One statement: the version and every row of it, or nothing. The same
-- request twice is one version; a version published by someone else since
-- the editor loaded is refused rather than silently replaced.
create or replace function public.rift_publish_questions(
  p_agent uuid, p_version integer, p_note text, p_by text, p_request uuid, p_rows jsonb
) returns uuid
language plpgsql as $$
declare
  existing uuid;
  latest integer;
  made uuid;
begin
  select id into existing from public.rift_question_versions where agent_id = p_agent and request_id = p_request;
  if existing is not null then return existing; end if;

  select coalesce(max(version), 0) into latest from public.rift_question_versions where agent_id = p_agent;
  if latest <> p_version - 1 then
    raise exception 'version % was published since this page loaded; reload to see it', latest
      using errcode = 'serialization_failure';
  end if;

  insert into public.rift_question_versions (agent_id, version, note, actor_label, request_id)
  values (p_agent, p_version, nullif(btrim(coalesce(p_note, '')), ''), p_by, p_request)
  returning id into made;

  insert into public.rift_question_wordings
    (agent_id, version_id, key, kind, bound, type, title, why, unit, options, sides, value_ids, position, enabled)
  select p_agent, made, r.key, r.kind, r.bound, r.type, r.title, r.why, r.unit,
         coalesce(r.options, '[]'::jsonb), coalesce(r.sides, '{}'), coalesce(r.value_ids, '{}'),
         coalesce(r.position, 0), coalesce(r.enabled, true)
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
      key text, kind text, bound text, type text, title text, why text, unit text,
      options jsonb, sides text[], value_ids text[], position integer, enabled boolean);

  return made;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rift_question_versions', 'rift_question_wordings', 'rift_custom_answers'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_history', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.rift_questions_history()', t || '_history', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_agent', t);
    execute format(
      'create policy %I on public.%I for all to public using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()))',
      t || '_agent', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert on public.%I to service_role', t);
    end if;
  end loop;

  revoke all on function public.rift_publish_questions(uuid, integer, text, text, uuid, jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_questions_history() from anon;
    revoke execute on function public.rift_custom_answers_to_custom() from anon;
    revoke execute on function public.rift_publish_questions(uuid, integer, text, text, uuid, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_questions_history() from authenticated;
    revoke execute on function public.rift_custom_answers_to_custom() from authenticated;
    revoke execute on function public.rift_publish_questions(uuid, integer, text, text, uuid, jsonb) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rift_publish_questions(uuid, integer, text, text, uuid, jsonb) to service_role;
  end if;
end $$;

comment on table public.rift_question_versions is 'Each published set of wording for the values'' questions (D37). Never edited.';
comment on table public.rift_question_wordings is 'A question in a published version: built-in words over lib/core/asks.ts, or the agent''s own question. Custom questions feed nothing.';
comment on table public.rift_custom_answers is 'A lead''s answers to the agent''s own questions, in the words shown. Never edited; deleted with the lead.';
comment on column public.rift_leads.question_version_id is 'The question wording version the page they saved from was rendered with. Null is the code''s own wording.';

commit;
