-- A client is told when something is put on their list (audit
-- portals-2026-10, item 3).
--
-- The notices table (20261006120000) covered the search and the offers, and
-- nothing between contract and closing: a workstream or a plan step the agent
-- puts on the client appeared on their Today and nobody told them. One more
-- kind, "yours". Same rules as the others: kind only, never content, one per
-- person per kind in six hours, and the member's own switch respected.
--
-- No new table, so no new policy: rift_client_notices keeps the RLS policy
-- and grants its own migration gave it.
alter table public.rift_client_notices drop constraint if exists rift_client_notices_kind_check;
alter table public.rift_client_notices add constraint rift_client_notices_kind_check
  check (kind in ('home', 'offer', 'priorities', 'pricing', 'proceeds', 'yours'));
