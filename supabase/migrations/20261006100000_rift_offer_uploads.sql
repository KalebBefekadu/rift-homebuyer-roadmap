-- An offer PDF counts as delivered the moment it is stored (manual review
-- WS8.2), and one offer can carry several PDFs (WS8.3).
--
-- Until now the PDF waited in an "incoming" folder under a random token until
-- the sender pressed Send, and a file nobody sent was deleted after a day. A
-- buyer's agent who uploaded their offer and then closed the tab had, in their
-- mind, sent it; Kaleb never saw it. The upload step now asks for a name and a
-- phone number first (Kaleb's pick between that and "sender unknown": an
-- offer nobody can be called about is not one he can answer), and the upload
-- is a row from the first file on.
--
--   rift_offer_uploads  who uploaded, what the automatic read proposed, and
--                       the offer it became once the form was sent (null
--                       until then: that is what puts it on the Offers board
--                       as "PDF only").
--   rift_offer_files    each PDF, in the order it was added: the offer, then
--                       any addenda.
--
-- Written only by the server (the sender has no account). The agent reads his
-- own. Removing the offer or the upload removes the rows below it; the files
-- in storage are removed first by whoever deletes (retention, Operations).
create table if not exists public.rift_offer_uploads (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents (id) on delete cascade,
  sender_name     text not null check (length(btrim(sender_name)) between 2 and 120),
  sender_phone    text not null check (length(regexp_replace(sender_phone, '\D', '', 'g')) >= 10 and length(sender_phone) <= 40),
  sender_email    text check (sender_email is null or (length(sender_email) <= 200 and sender_email like '%@%')),
  read_candidates jsonb,
  offer_id        uuid references public.rift_offers (id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index if not exists rift_offer_uploads_agent_idx on public.rift_offer_uploads (agent_id, created_at desc);
create unique index if not exists rift_offer_uploads_offer_idx on public.rift_offer_uploads (offer_id) where offer_id is not null;

create table if not exists public.rift_offer_files (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  upload_id   uuid not null references public.rift_offer_uploads (id) on delete cascade,
  path        text not null unique check (path ~ '^offers/uploads/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  file_name   text not null check (length(btrim(file_name)) between 1 and 200),
  size_bytes  integer not null check (size_bytes > 0),
  created_at  timestamptz not null default now()
);
create index if not exists rift_offer_files_upload_idx on public.rift_offer_files (upload_id, created_at);

-- A sent offer's document is now its upload's first file, which lives under
-- the upload rather than at offers/<offer id>.pdf. Offers sent before this
-- keep the old path, so both are allowed, and nothing else.
alter table public.rift_offers drop constraint if exists rift_offers_document_path;
alter table public.rift_offers add constraint rift_offers_document_path check (
  document_path is null
  or document_path ~ '^offers/[0-9a-f-]{36}\.pdf$'
  or document_path ~ '^offers/uploads/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
);

alter table public.rift_offer_uploads enable row level security;
alter table public.rift_offer_files enable row level security;

drop policy if exists rift_offer_uploads_agent on public.rift_offer_uploads;
create policy rift_offer_uploads_agent on public.rift_offer_uploads for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

drop policy if exists rift_offer_files_agent on public.rift_offer_files;
create policy rift_offer_files_agent on public.rift_offer_files for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
declare t text;
begin
  foreach t in array array['rift_offer_uploads', 'rift_offer_files'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
end $$;

comment on table public.rift_offer_uploads is
  'An offer PDF upload from /offer: delivered from the first file (manual review WS8.2). offer_id is null until the form is sent.';
comment on table public.rift_offer_files is
  'Each PDF on an upload: the offer, then any addenda (manual review WS8.3).';
