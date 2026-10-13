-- When a household member last opened their portal, for "Since you last
-- looked" on their Today (audit portals-2026-10, item 10).
--
-- Two times, not one: seen_at is the start of the current visit and
-- seen_before the one before it, so moving between tabs inside one visit
-- does not wipe the list of what changed (lib/core/since.ts). Written only by
-- the member's own page, never by the agent's preview.
--
-- Columns on an existing table, so no new policy: rift_journey_members keeps
-- the RLS policy its own migration gave it.
alter table public.rift_journey_members add column if not exists seen_at timestamptz;
alter table public.rift_journey_members add column if not exists seen_before timestamptz;

comment on column public.rift_journey_members.seen_at is
  'Start of the member''s current portal visit. With seen_before, decides what "Since you last looked" lists.';
