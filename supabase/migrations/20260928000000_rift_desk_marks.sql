-- ============================================================================
-- Snooze, pin and delegate on Today (Blueprint v5 §8.4, OPS-02).
--
--   rift_desk_marks   what the agent did to an item on Today, append-only.
--                     The latest row for an item is its state; "clear" ends
--                     whatever was there.
--
-- An item is named by a stable key made from what it is about ("action:<lead
-- id>", "outbox:<id>", "work:<contract id>:<workstream>"). The rules:
--   * a snooze has an owner and a time to come back, and a contract date
--     ("date:...") is never snoozed: snoozing hides the reminder, never moves
--     the date;
--   * a pin has a reason and an end;
--   * a delegation names who it went to, and shows as not accepted until an
--     "accept" row says who accepted it. Outside parties have no account.
--
-- The rules are lib/core/desk.ts; the only writer is lib/db/desk.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_desk_marks (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  item_key    text not null check (item_key ~ '^[a-z]+:[A-Za-z0-9:_-]{1,200}$'),
  kind        text not null check (kind in ('snooze', 'pin', 'delegate', 'accept', 'clear')),
  -- Snooze: when it comes back. Pin: when it stops being pinned.
  until_at    timestamptz,
  -- Snooze: who will pick it up again. Delegate and accept: who it went to.
  person      text check (person is null or length(btrim(person)) between 1 and 120),
  reason      text check (reason is null or length(btrim(reason)) between 1 and 300),
  by_name     text not null check (length(btrim(by_name)) between 1 and 120),
  request_id  uuid not null,
  created_at  timestamptz not null default now(),
  constraint rift_desk_marks_request unique (agent_id, request_id),
  constraint rift_desk_marks_snooze check (kind <> 'snooze' or (until_at is not null and until_at > created_at and person is not null)),
  constraint rift_desk_marks_never_a_date check (kind <> 'snooze' or item_key not like 'date:%'),
  constraint rift_desk_marks_pin check (kind <> 'pin' or (until_at is not null and until_at > created_at and reason is not null)),
  constraint rift_desk_marks_delegate check (kind not in ('delegate', 'accept') or person is not null)
);
create index if not exists rift_desk_marks_idx on public.rift_desk_marks (agent_id, item_key, created_at desc);

create or replace function public.rift_desk_marks_history() returns trigger
language plpgsql as $$
begin
  raise exception 'rift_desk_marks is history and cannot be edited; record a new mark'
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_desk_marks_are_history on public.rift_desk_marks;
create trigger rift_desk_marks_are_history before update on public.rift_desk_marks
  for each row execute function public.rift_desk_marks_history();

alter table public.rift_desk_marks enable row level security;
drop policy if exists rift_desk_marks_agent on public.rift_desk_marks;
create policy rift_desk_marks_agent on public.rift_desk_marks for all to public
  using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_desk_marks from anon;
    revoke execute on function public.rift_desk_marks_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_desk_marks from authenticated;
    grant select on public.rift_desk_marks to authenticated;
    revoke execute on function public.rift_desk_marks_history() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.rift_desk_marks to service_role;
  end if;
end $$;

comment on table public.rift_desk_marks is 'Snoozes, pins and delegations of items on Today. Append-only; the latest row per item is its state; contract dates are never snoozed.';

commit;
