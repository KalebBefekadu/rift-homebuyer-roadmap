-- ============================================================================
-- Store what the score was computed FROM, not only what it came to.
--
-- `score` and `signals` were written once at capture and never revisited. One
-- of the six signals is recency, and recency decays — so a lead captured three
-- weeks ago kept the 100 it earned on the day and went on outranking somebody
-- who arrived this morning.
--
-- The ranking is the entire argument for Studio. A ranking that silently goes
-- stale is worse than none: it still costs the agent attention, and it spends
-- it on the wrong people while looking exactly as authoritative as it did when
-- it was right.
--
-- Keeping the inputs lets the score be recomputed on read. The stored score
-- stays as the value at capture, which is worth having — it is what the lead
-- looked like when it arrived, and the difference between the two is itself
-- information.
-- ============================================================================

alter table rift_leads add column if not exists lead_input jsonb;

comment on column rift_leads.lead_input is
  'The LeadInput the score was computed from. Recomputed on read so recency decays; see lib/db/leads.ts.';
comment on column rift_leads.score is
  'The score AT CAPTURE. Studio recomputes for display — do not treat this as current.';
