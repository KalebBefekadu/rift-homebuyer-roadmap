-- Clients send documents too (manual review WS11.3).
--
-- Documents only went agent to client: a buyer could not send a pre-approval
-- letter or proof of funds, so the agent collected them by email, outside
-- the record. A household member's upload is now a rift_documents row like
-- any other (same quarantine, same structural checks, same private bucket),
-- with the member who sent it named here. Null is the agent's own upload.
--
-- NO ACTION, not SET NULL: rift_documents is history and refuses updates, so
-- a SET NULL would make deleting a member fail on the trigger. NO ACTION is
-- checked at the end of the statement, so erasing a journey (which removes
-- its members and documents together) still works; deleting one member who
-- sent a document is refused, which is right: their document would otherwise
-- lose its sender.
alter table public.rift_documents
  add column if not exists from_member_id uuid references public.rift_journey_members (id) on delete no action;

create index if not exists rift_documents_from_member_idx on public.rift_documents (from_member_id) where from_member_id is not null;

comment on column public.rift_documents.from_member_id is
  'The household member who uploaded it from the client portal (manual review WS11.3). Null: the agent uploaded it.';
