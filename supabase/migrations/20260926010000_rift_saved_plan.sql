-- Blueprint v5 §5.5: "Save my plan". A person who has used the values keeps
-- them together as a plan they can reopen on any device, by a private link.
--
-- Stored on the lead the save creates, because that is what it is: the
-- values they found, with the figures as they were shown and the day, and the
-- answers behind them. It is deleted with the lead ("delete all of it"), and
-- it is what the agent's lead summary and a later client brief read (§5.5,
-- LEAD-04). The link token is the credential, like a shared readout's, and is
-- never shown in Operations.
--
-- Additive only. Nothing reads these columns until the code that writes them
-- is deployed, and the capture path does not depend on them.

alter table rift_leads add column if not exists plan jsonb;
alter table rift_leads add column if not exists plan_token text;
alter table rift_leads add column if not exists plan_saved_at timestamptz;

create unique index if not exists rift_leads_plan_token_key on rift_leads (plan_token) where plan_token is not null;

alter table rift_leads drop constraint if exists plan_is_an_object;
alter table rift_leads add constraint plan_is_an_object check (plan is null or jsonb_typeof(plan) = 'object');
alter table rift_leads drop constraint if exists plan_token_is_long;
alter table rift_leads add constraint plan_token_is_long check (plan_token is null or length(plan_token) >= 32);
