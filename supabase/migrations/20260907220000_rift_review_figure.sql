-- ============================================================================
-- Link a review item to the figure it is about.
--
-- The trust ladder was described end to end and connected at neither end.
-- Promoting a review item changed the ITEM; the figure the customer is looking
-- at stayed "preliminary" forever, so "Kaleb has been through this" was a fact
-- recorded in Studio and invisible to the only person it was for.
--
-- With the link, advancing an item advances the figure, and a shared readout
-- can show which of its numbers somebody has actually checked.
-- ============================================================================

alter table rift_review_items
  add column if not exists figure_id uuid references rift_figures(id) on delete set null;

create index if not exists rift_review_figure_idx on rift_review_items (figure_id);

comment on column rift_review_items.figure_id is
  'The figure this review is about. Null for a request that predates figure tracking, or one about something not stored as a figure.';
