-- Reminding a client of a contract date of theirs (audit portals-2026-10,
-- decision 4), behind the business rule clientDateReminders, off until Kaleb
-- turns it on.
--
-- A sixth notice kind, "date", and the one thing a reminder needs that the
-- other kinds do not: which date it was about, so each date is said once per
-- person however many mornings it stays inside the window. Still no content:
-- `about` is the deadline's id, never its label or its day.
alter table public.rift_client_notices drop constraint if exists rift_client_notices_kind_check;
alter table public.rift_client_notices add constraint rift_client_notices_kind_check
  check (kind in ('home', 'offer', 'priorities', 'pricing', 'proceeds', 'yours', 'date'));
alter table public.rift_client_notices add column if not exists about text
  check (about is null or length(about) between 1 and 80);
create index if not exists rift_client_notices_about_idx on public.rift_client_notices (member_id, kind, about) where about is not null;
