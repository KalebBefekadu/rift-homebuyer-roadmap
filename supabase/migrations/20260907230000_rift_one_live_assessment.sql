-- ============================================================================
-- One live assessment per session, per side.
--
-- `startAssessment` checked for an existing row and inserted if it found none.
-- Between the check and the insert, another request can do the same — and the
-- assessment page fires this on mount, so a double-render, a fast refresh, or a
-- flaky connection retrying is enough.
--
-- Measured before the fix: six concurrent starts produced six assessments for
-- one visitor. Nothing failed. The consequences are all quiet ones — the agent
-- sees six abandoned people where there was one, five sets of answers are
-- orphaned against ids the client discarded, and any completion rate computed
-- from assessments is wrong by whatever the retry rate happens to be.
--
-- A check-then-insert cannot be made safe in application code. Only the
-- database can refuse the second one.
-- ============================================================================

-- Deduplicate before adding the constraint: keep the oldest live assessment
-- per session and side, and delete the rest. Answers cascade with them, which
-- is correct — they are attached to rows the client already abandoned.
delete from rift_assessments a
using rift_assessments b
where a.completed_at is null
  and b.completed_at is null
  and a.agent_id = b.agent_id
  and a.session_id = b.session_id
  and a.side = b.side
  and a.started_at > b.started_at;

create unique index if not exists rift_one_live_assessment
  on rift_assessments (agent_id, session_id, side)
  where completed_at is null;

comment on index rift_one_live_assessment is
  'A visitor has one live assessment per side. startAssessment relies on this to make its check-then-insert safe under concurrency.';
