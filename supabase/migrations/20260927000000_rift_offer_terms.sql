-- Submit an offer, Blueprint v5 §5.9 (Kaleb, R2).
--
-- Two terms the public form now asks for. Both are nullable: every offer
-- received before today has neither, and an offer on file is never rewritten
-- to look as if it said something it did not.
--
-- No new table, so no new policy: rift_offers keeps the row-level security
-- it shipped with in 20260921060000_rift_inbound_offers.sql.

-- What "Other" financing actually is. The form refuses "Other" without it.
alter table rift_offers add column if not exists financing_detail text;

-- Days of due diligence asked for. Null means the sender did not say, which
-- is different from zero, a real and aggressive term.
alter table rift_offers add column if not exists due_diligence_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_offers_financing_detail_check') then
    alter table rift_offers add constraint rift_offers_financing_detail_check
      check (financing_detail is null or char_length(financing_detail) between 2 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rift_offers_due_diligence_days_check') then
    alter table rift_offers add constraint rift_offers_due_diligence_days_check
      check (due_diligence_days is null or due_diligence_days between 0 and 60);
  end if;
end $$;
