-- ============================================================================
-- One outbox step at a time (Blueprint v5 §10.2; AUTO-02, AT13).
--
--   rift_outbox_events.seq  each step's place in its message's history.
--
-- approveAndSend read a message's history, decided it was approved, checked
-- the block list at Brevo, and only then wrote "running" and sent. Two
-- presses of Send (a double click, a second tab) both read "approved" and
-- both sent: the same email to a client twice, each recorded as succeeded.
-- Nothing in the table could refuse the second, because a history is only
-- ever appended to and every append looked valid on its own.
--
-- The writer sets seq to one more than the steps it read. The unique index
-- refuses a second step claiming the same place, so of two writers that read
-- the same history exactly one is recorded and the other is told the message
-- moved under it. Rows written before this have no seq; nulls never collide.
--
-- No new table, so no new policy: the table's RLS is unchanged. Additive:
-- code written before this never sends seq.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_outbox_events add column if not exists seq integer;
alter table public.rift_outbox_events drop constraint if exists rift_outbox_events_seq_check;
alter table public.rift_outbox_events add constraint rift_outbox_events_seq_check check (seq is null or seq >= 1);

create unique index if not exists rift_outbox_events_seq_key on public.rift_outbox_events (outbox_id, seq);

comment on column public.rift_outbox_events.seq is
  'This step''s place in its message''s history, set by lib/db/outbox.ts to one more than the steps it read. Unique per message, so two writers acting on the same history cannot both be recorded (a double press of Send sends once). Null on steps written before 20260929200000.';

commit;
