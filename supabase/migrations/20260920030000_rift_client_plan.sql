-- ============================================================================
-- The client's half of the product.
--
-- Rift is described as a client-experience platform. Until now everything it
-- holds points one way: the agent can see the person, the person can see one
-- frozen readout at /r/<token> and nothing after it. From the moment somebody
-- becomes a client, the product they were sold goes dark.
--
-- This is the first surface that points the other way — a plan they can open
-- and read: what has been agreed, who owes what, and by when.
--
-- TWO DECISIONS WORTH STATING.
--
-- No accounts. The whole funnel works without one and it would be strange to
-- demand a password at the moment somebody starts trusting you. Reached by an
-- unguessable token, like the shared readout, and the page is noindex — a link
-- unguessable to a person is trivially findable by a crawler given it.
--
-- The agent's notes are NOT here and must never be. rift_lead_notes is his
-- record of the relationship, including the parts that are his judgement about
-- somebody. A plan item is written to be read by the client; a note is not,
-- and a product that blurs the two teaches an agent to stop writing honestly.
-- ============================================================================

-- The client's door. Nullable: it exists only once the agent has decided to
-- open one, and a token minted for everybody would be a link to a plan nobody
-- has written.
alter table rift_leads add column if not exists client_token text;

create unique index if not exists rift_leads_client_token_idx
  on rift_leads (client_token) where client_token is not null;

comment on column rift_leads.client_token is
  'Unguessable handle for this person''s own plan at /plan/<token>. Null until the agent opens one. Revoked by setting it back to null, which breaks every copy of the link at once.';

create table if not exists rift_plan_items (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  lead_id     uuid not null references rift_leads(id) on delete cascade,

  -- Written for the client to read. Length-bounded because it is rendered on
  -- their page and a paragraph in a checklist is a paragraph nobody reads.
  title       text not null check (length(btrim(title)) between 3 and 160),

  -- Who it is waiting on. Three values and no default: an item with no owner
  -- is the thing every plan dies of, and making the agent choose is the point.
  -- 'other' carries a name, because "waiting on the county" and "waiting on
  -- your lender" are different kinds of waiting to the person reading it.
  owner       text not null check (owner in ('client','agent','other')),
  owner_name  text check (owner <> 'other' or length(btrim(coalesce(owner_name,''))) > 0),

  -- Optional. A date invented to look organised is worse than no date, because
  -- the client then measures you against it.
  due_on      date,
  done_at     timestamptz,

  -- The agent's order, not a computed one. He knows what comes first.
  sort        integer not null default 0,

  created_at  timestamptz not null default now()
);

create index if not exists rift_plan_items_lead_idx
  on rift_plan_items (lead_id, sort, created_at);

comment on table rift_plan_items is
  'One step of a client''s plan, written to be read by them. Not the agent''s notes — see rift_lead_notes, which stays private.';

alter table rift_plan_items enable row level security;

-- The agent owns them. The client reads through the service role by token, the
-- same way the shared readout does: there is no client session to write a
-- policy against, and inventing one would mean accounts.
drop policy if exists rift_plan_items_owner on rift_plan_items;
create policy rift_plan_items_owner on rift_plan_items for all
  using (agent_id in (select id from rift_agents where auth_user_id = auth.uid()))
  with check (agent_id in (select id from rift_agents where auth_user_id = auth.uid()));
