# 05. Build Plan

Phased so something usable ships fast and the advanced parts layer on. Time is the binding constraint. Do not build past what the program needs right now.

## Phase 0: port the prototype (fastest path to usable)

- Drop the calc module (`04-calculation-spec.md`) into `lib/roadmap/calc.ts`. Unit test it with the seed cases.
- Rebuild the intake form and live preview as a React route in the existing app, reading from the calc module.
- Keep PDF client-side (html2pdf) for now.
- No database yet. This alone replaces the standalone HTML file and lives in the app.
- Outcome: Kaleb runs intakes inside the site, generates the PDF. No persistence.

## Phase 1: persistence + auth (the real MVP)

- Supabase Auth (single agent).
- Tables: `agents_settings`, `clients`, `roadmaps`. RLS on all three, pgTAP tests per policy.
- Save client + roadmap version on generate. Compute outputs server-side from inputs.
- Pipeline list view: clients by stage and time-to-buy bucket.
- Agent settings page: branding + calc defaults stored once.
- Outcome: nothing is lost, anyone can be pulled back up, pipeline is visible.

## Phase 2: the DPA database

- `dpa_programs` table, seeded with Georgia programs (Georgia Dream and metro Atlanta county/city programs, with amounts and county tags).
- Intake picks programs from the list filtered by county instead of typing them.
- Outcome: assistance numbers are accurate and fast, not recalled from memory.

## Phase 3: advanced, in value order

1. Affordability solver (reverse calc) in the same module.
2. Server-side PDF via `@react-pdf/renderer`, stored per version, emailable.
3. Shareable read-only client roadmap link that updates on progress.
4. Follow Up Boss sync on save.
5. Milestone automation hooks (stage to Mortgage Ready pings Kaleb).
6. Property criteria handoff into KW Command / IDX saved search.

## Deliberately not built

- MLS listing-alert engine. KW Command or IDX handles it.
- A CRM. Follow Up Boss.
- Public marketing site. Separate lighter build.

## Definition of done for the MVP (Phases 0 to 2)

- Full intake to branded PDF in under 30 minutes.
- Client and roadmap persisted, RLS-isolated, pull-back-up works.
- DPA amounts pulled from the maintained list.
- Cash-gap number correct against the seed test cases.

## Notes for whoever builds it (likely Kaleb + coding agent)

- Human-in-the-loop review pattern as with Veltro: forward the migration/implementation plan for honest review before applying.
- Reuse Veltro's RLS and testing conventions directly.
- The calc module is the one piece that must be exactly right and fully tested. Everything else is standard CRUD.
