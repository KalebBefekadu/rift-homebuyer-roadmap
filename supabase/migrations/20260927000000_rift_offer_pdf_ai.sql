-- ============================================================================
-- Submit an offer, starting with the PDF (Blueprint v5 §5.9), and the AI cost
-- record that has to exist before any AI is used (§10.2, D16, AUTO-06).
--
--   rift_ai_usage   each AI call: workflow, model, prompt version, tokens and
--                   cost. How the $50 monthly limit is kept (lib/core/ai.ts).
--                   Nothing about the person or the document is stored here.
--   rift_program_checks.summary  what the AI comparison found in a changed
--                   program page, for the reviewer (§6.5).
--   rift_offers     the fields the form gained (what "other" financing is,
--                   due diligence days), the uploaded PDF's place in the
--                   private rift-documents bucket, and what the automatic
--                   read proposed, so Operations can show it beside what the
--                   sender actually sent.
--
-- Additive: older code neither reads nor writes these columns.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_ai_usage (
  id              uuid primary key default gen_random_uuid(),
  workflow        text not null check (workflow in ('offer-extraction', 'program-compare')),
  model           text not null check (length(model) between 3 and 80),
  prompt_version  text not null check (length(prompt_version) between 3 and 80),
  input_tokens    integer not null default 0 check (input_tokens >= 0),
  output_tokens   integer not null default 0 check (output_tokens >= 0),
  cost_cents      integer not null default 0 check (cost_cents >= 0),
  outcome         text not null check (outcome in ('ok', 'refused', 'failed')),
  created_at      timestamptz not null default now()
);
create index if not exists rift_ai_usage_month_idx on public.rift_ai_usage (created_at desc);

create or replace function public.rift_ai_usage_history() returns trigger
language plpgsql as $$
begin
  raise exception 'rift_ai_usage is history and cannot be edited'
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_ai_usage_is_history on public.rift_ai_usage;
create trigger rift_ai_usage_is_history before update or delete on public.rift_ai_usage
  for each row execute function public.rift_ai_usage_history();

alter table public.rift_ai_usage enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_ai_usage from anon;
    revoke execute on function public.rift_ai_usage_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_ai_usage from authenticated;
    revoke execute on function public.rift_ai_usage_history() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.rift_ai_usage to service_role;
  end if;
end $$;

alter table public.rift_offers add column if not exists financing_other text;
alter table public.rift_offers add column if not exists due_diligence_days integer;
alter table public.rift_offers add column if not exists document_path text;
alter table public.rift_offers add column if not exists read_candidates jsonb;

alter table public.rift_offers drop constraint if exists rift_offers_financing_other_said;
alter table public.rift_offers add constraint rift_offers_financing_other_said check (
  financing_other is null or (financing = 'other' and length(btrim(financing_other)) between 2 and 80)
);
alter table public.rift_offers drop constraint if exists rift_offers_due_diligence_days;
alter table public.rift_offers add constraint rift_offers_due_diligence_days check (
  due_diligence_days is null or due_diligence_days between 0 and 60
);
alter table public.rift_offers drop constraint if exists rift_offers_document_path;
alter table public.rift_offers add constraint rift_offers_document_path check (
  document_path is null or document_path ~ '^offers/[0-9a-f-]{36}\.pdf$'
);
alter table public.rift_offers drop constraint if exists rift_offers_read_is_object;
alter table public.rift_offers add constraint rift_offers_read_is_object check (
  read_candidates is null or jsonb_typeof(read_candidates) = 'object'
);

-- The AI comparison of a changed program page (Blueprint v5 §6.5), written
-- with the reading and never edited, like the reading itself. For the
-- reviewer only; the reviewer still decides.
alter table public.rift_program_checks add column if not exists summary text;
alter table public.rift_program_checks drop constraint if exists rift_program_checks_summary_len;
alter table public.rift_program_checks add constraint rift_program_checks_summary_len check (summary is null or length(summary) <= 2000);

comment on table public.rift_ai_usage is 'Each AI call and what it cost. Keeps the monthly limit; holds nothing about the person or the document.';
comment on column public.rift_offers.read_candidates is 'What the automatic read of the uploaded PDF proposed, each with its page and quoted words. Candidates, not facts: the offer columns hold what the sender sent.';

commit;
