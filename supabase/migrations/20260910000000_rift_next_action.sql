-- ============================================================================
-- The next thing you owe them, and when.
--
-- The board says who has gone quiet. It cannot say what you decided to do about
-- it, so the decision lives in the agent's head between sessions, which is
-- exactly where it gets lost. "Call Marcus Thursday" is the smallest unit of
-- account management and there was nowhere to put it.
--
-- One open action per person, deliberately. A queue of six things owed to the
-- same client is a queue nobody works; the next call is the only one that
-- matters and the rest are notes. Completing an action writes to the history,
-- so what was owed and when it was done stays auditable.
-- ============================================================================

alter table rift_leads add column if not exists next_action text;
alter table rift_leads add column if not exists next_due date;

-- An action with no date is a wish, and a date with no action is an alarm
-- nobody can act on. They travel together or not at all.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_next_action_dated') then
    alter table rift_leads add constraint rift_leads_next_action_dated
      check ((next_action is null) = (next_due is null));
  end if;
end $$;

-- Ordered by what is owed soonest, and only for people still being worked.
create index if not exists rift_leads_due_idx
  on rift_leads (agent_id, next_due)
  where next_due is not null and archived_at is null;

comment on column rift_leads.next_action is
  'The one thing owed to this person next. Cleared when done; the completion is written to rift_lead_notes.';
