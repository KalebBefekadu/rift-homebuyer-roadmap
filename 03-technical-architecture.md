# 03. Technical Architecture

Built on the Veltro stack for pattern reuse: Next.js App Router, Supabase (Postgres + Auth + RLS), Vercel.

## Principles (same as Veltro)

- RLS is the real security boundary, not UI guards.
- Normalize before data accretes.
- Build thin structure now.
- The calculation engine is a pure, unit-tested module. No math in components.

## Data model

Tables (all owned by an agent, RLS-scoped to `agent_id = auth.uid()`).

### agents_settings
Per-agent branding and calc defaults, one row per agent.
- `agent_id` uuid pk (fk auth.users)
- `display_name` text
- `brand_name` text
- `role_line` text
- `phone` text, `email` text
- `mark_letter` text
- `brand_color` text, `accent_color` text
- `default_rate` numeric, `default_tax_pct` numeric, `default_insurance_yr` numeric, `default_closing_pct` numeric, `default_pmi_pct` numeric
- `created_at`, `updated_at`

### clients
The person. One per human.
- `id` uuid pk
- `agent_id` uuid (fk)
- `first_name` text, `last_name` text
- `email` text, `phone` text
- `time_to_buy` text check in ('0-3','3-9','9+')
- `stage` text check in ('lead','roadmap_done','working_gap','mortgage_ready','shopping','closed','nurture') default 'lead'
- `crm_external_id` text null (Follow Up Boss id, V2)
- `created_at`, `updated_at`

### roadmaps
A versioned snapshot of one intake. Inputs and computed outputs stored together so a regenerate is reproducible.
- `id` uuid pk
- `client_id` uuid (fk clients)
- `agent_id` uuid (fk)
- `version` int
- `inputs` jsonb  (all form fields: preferences, numbers, credit, income notes, moves, note)
- `outputs` jsonb (computed: down, loan, monthly breakdown, cash_to_close, gap, dpa_total)
- `pdf_url` text null (Supabase Storage path, V2 server render)
- `created_at`

### dpa_programs
Reference table Kaleb maintains. Seed with Georgia programs.
- `id` uuid pk
- `agent_id` uuid null  (null = global/shared seed; non-null = agent's custom)
- `name` text
- `amount` numeric
- `type` text (grant / forgivable / deferred / second-lien)
- `county` text null (null = statewide)
- `notes` text
- `active` bool default true

### roadmap_dpa (join, optional)
Which programs were attached to a given roadmap version. Or store selected programs inside `roadmaps.inputs` for simplicity in MVP. MVP: store in jsonb. Normalize later if reporting needs it.

## RLS (sketch)

```sql
alter table clients enable row level security;
create policy "own clients" on clients
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());
-- same shape for roadmaps and agents_settings.
-- dpa_programs: readable if active and (agent_id is null or agent_id = auth.uid());
--               writable only where agent_id = auth.uid().
```

Add a pgTAP test for each policy, consistent with the Veltro infra agenda.

## API surface (Next.js Route Handlers or Server Actions)

- `POST /clients` create client
- `PATCH /clients/:id` update stage, bucket, contact
- `GET /clients` list (pipeline view), filter by stage/bucket
- `POST /clients/:id/roadmaps` create roadmap version (server computes outputs from inputs, do not trust client math)
- `GET /clients/:id/roadmaps/latest`
- `GET /dpa?county=` list programs
- `POST /pdf` (V2) server-render a roadmap to PDF, store, return url
- `POST /crm/sync` (V2) upsert client into Follow Up Boss

Compute on the server on save. The client-side calc is for live preview only; the stored `outputs` are computed server-side from `inputs` so they are trustworthy and consistent.

## Calculation module

- Location: `lib/roadmap/calc.ts`. Pure functions, no framework imports.
- Exports one `computeRoadmap(inputs): outputs`.
- Fully specified in `04-calculation-spec.md`.
- Unit tested (Vitest or Jest). Snapshot a few known cases.

## PDF strategy

Two phases.

**MVP: client-side (port the prototype).**
- html2pdf.js on the rendered roadmap DOM. Fast to ship, reuses existing layout and branding.
- Downside: html2canvas rasterizes text (slightly soft, larger file). Acceptable for one to two pages.

**V2: server-side render, stored per version.**
- Option A: `@react-pdf/renderer`. Vector text, crisp, Vercel-friendly, no headless browser. Cost: rebuild the layout in react-pdf primitives (View/Text/StyleSheet). Recommended.
- Option B: Puppeteer/Playwright rendering an HTML template to PDF via `@sparticuz/chromium` on a serverless function. Highest visual fidelity to the current design, heavier cold starts and bundle. Use only if pixel-matching the HTML matters more than crispness.
- Store to Supabase Storage, save `pdf_url` on the roadmap row, email via Resend or similar.

Recommendation: ship MVP client-side, move to `@react-pdf/renderer` for V2.

## Property criteria handoff (not an alert engine)

- Do NOT build MLS alerts. Push the intake criteria (beds, baths, areas, price band) into KW Command or the IDX platform's saved search so branded alerts fire from there.
- If the IDX platform has an API, a thin `POST /criteria/handoff` can create the saved search. Otherwise this is a manual 5-minute step in that tool, documented in the intake checklist.

## Auth

- Supabase Auth, single agent (Kaleb) for MVP. Email magic link or password.
- Every table RLS-scoped to `auth.uid()`. No admin bypass in app code.

## Deployment

- Vercel, pin region as with Veltro (pdx1) for latency consistency.
- Env: Supabase URL + anon/service keys, Resend key (V2), Follow Up Boss key (V2).
- Keep this as its own route group inside the existing app, or a separate app that shares the Supabase project. Decide based on whether it shares auth with anything else. Default: route group in the existing agent site.
