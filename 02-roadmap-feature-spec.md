# 02. Roadmap Feature Spec

The roadmap generator as a feature inside the site, not a standalone file.

## Users

- **Primary: Kaleb (agent).** Logs in, creates a client, fills intake live, generates the branded PDF, saves the client into the pipeline.
- **Secondary (V2+): the client.** Receives a link to a read-only branded roadmap that updates as they progress. Optional.

## Primary flow (MVP)

1. Agent logs in.
2. New Client: first name, last name, email, phone, time-to-buy bucket.
3. Intake form: the same fields as the prototype (preferences, the numbers, credit, income notes, DPA programs, next moves, personal note).
4. Live preview renders the branded roadmap as fields fill.
5. Generate PDF. Download and/or email to client.
6. Save: client lands in the pipeline at stage Roadmap Done, bucket set.

## What is new vs the prototype

- **Persistence.** Clients and roadmaps are saved, not lost on refresh. Pull anyone back up.
- **Versioning.** Each regenerate creates a new roadmap version so progress is visible over time ("here is where you were in March, here is now").
- **DPA database.** Programs are picked from a maintained list filtered by county, with dollar amounts prefilled, instead of typed from memory.
- **Agent settings.** Branding (name, brand, colors, contact), default rate, tax, insurance stored once per agent.
- **Auth + isolation.** Each agent sees only their own clients (RLS).

## Fields (carried from prototype)

- Client: first name, last name, prepared date.
- Preferences: target timeline (dropdown), home type (dropdown), beds, baths, target areas, must-have features (checkboxes + other).
- The numbers: target price, down payment %, interest rate, term, current savings, property tax %, insurance/yr, HOA/mo, closing %, PMI %.
- Computed: down payment $, loan amount, monthly P&I, taxes, insurance, PMI, HOA, total monthly, cash to close, remaining gap.
- Credit: score now, target, by when.
- Income and documentation notes.
- DPA programs: name, amount, note (now from the database).
- Next moves: text + due date.
- Personal note.

## MVP scope (ship this first)

- Auth, one agent (Kaleb).
- Create/edit/save client + roadmap.
- The full calculation engine (see calc spec).
- Branded PDF generation (client-side to start).
- DPA database, seeded with Georgia programs, filter by county.
- Pipeline list view with stage + bucket.

## Advanced (the "little advanced" asks, V2+)

Ranked by value:

1. **Affordability solver (reverse calc).** Client gives a monthly budget, tool returns the max price they can target. High value at intake.
2. **Shareable client roadmap link.** Branded read-only page, updates as milestones change. Doubles as a soft microsite from Kaleb.
3. **Server-side PDF.** Crisper text, stored copy per version, emailable without the client-side render step.
4. **CRM sync.** On save, push/update the client in Follow Up Boss via API. One source of truth.
5. **Milestone automation hooks.** Stage change to Mortgage Ready fires a personal-touch reminder to Kaleb.
6. **Property criteria handoff.** Push beds/baths/areas/price into the KW Command or IDX saved search, so alerts start from the same intake. Do not build the alert engine (see technical doc).
7. **Multi-agent.** Only if the program ever expands past Kaleb.

## Explicitly out of scope

- Building an MLS listing-alert engine. Use KW Command or an IDX platform. Licensed data, solved problem, zero differentiation.
- Building a CRM. Buy Follow Up Boss.
- A public marketing site. That is a separate, lighter build.

## Success criteria

- Kaleb can run a full intake and hand over a branded PDF in under 30 minutes.
- No client data is lost. Anyone can be pulled back up and their roadmap updated.
- The remaining-cash-gap number is correct and defensible.
