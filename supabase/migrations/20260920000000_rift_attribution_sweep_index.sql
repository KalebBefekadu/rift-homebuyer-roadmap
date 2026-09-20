-- The index the retention sweep has always needed and never had.
--
-- `rift_attributions` is keyed on session_id, which serves every read in the
-- product except one: the sweep deletes by (agent_id, first_at), and the
-- health check asks the same question to find out whether the sweep is still
-- running. Both are sequential scans today.
--
-- It does not hurt yet, because the analytics window is twenty-four months and
-- the table is small. It starts hurting on the first day that window fires
-- against a table with real traffic in it, which is exactly the day nobody
-- will be watching the retention job — and a deletion job that times out is a
-- deletion job that silently stops keeping the promise printed at the bottom
-- of every readout.
--
-- No RLS change: the policy on this table is unchanged and still the one from
-- 20260907000000_rift_core.sql. An index is not a grant.
create index if not exists rift_attributions_sweep_idx
  on rift_attributions (agent_id, first_at);
