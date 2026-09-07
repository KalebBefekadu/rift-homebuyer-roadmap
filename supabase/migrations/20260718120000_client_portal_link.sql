-- Link homebuyer auth users to intake clients so the client portal can read their roadmap.

alter table public.clients
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists clients_auth_user_id_uidx
  on public.clients (auth_user_id)
  where auth_user_id is not null;

create index if not exists clients_email_lower_idx
  on public.clients (lower(trim(email)));

-- Claim unlinked client rows whose email matches the signed-in user.
create or replace function public.claim_my_client_records()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  em text;
  n integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select lower(u.email) into em
  from auth.users u
  where u.id = uid;

  if em is null or em = '' then
    return 0;
  end if;

  update public.clients
  set auth_user_id = uid,
      updated_at = now()
  where auth_user_id is null
    and lower(trim(email)) = em;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.claim_my_client_records() from public;
grant execute on function public.claim_my_client_records() to authenticated;

-- Clients may read their own linked row + roadmaps + agent branding (read-only).
drop policy if exists "client read own row" on public.clients;
create policy "client read own row" on public.clients
  for select using (auth_user_id = auth.uid());

drop policy if exists "client read own roadmaps" on public.roadmaps;
create policy "client read own roadmaps" on public.roadmaps
  for select using (
    exists (
      select 1
      from public.clients c
      where c.id = roadmaps.client_id
        and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists "client read agent branding" on public.agents_settings;
create policy "client read agent branding" on public.agents_settings
  for select using (
    exists (
      select 1
      from public.clients c
      where c.agent_id = agents_settings.agent_id
        and c.auth_user_id = auth.uid()
    )
  );
