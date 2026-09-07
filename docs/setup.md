# Rift — Setup

Everything needed to go from a fresh clone to a running development environment, and
everything that must exist before the first production surface ships.

---

## 1. Run the specification — zero configuration

```bash
npm install
npm run dev
```

Open **http://localhost:3000/prototype**. No Supabase, no `.env`, no accounts. If this needs
configuration, something has been wired wrong.

Entry points:

| Route | What |
| --- | --- |
| `/prototype/buy` | Buyer product — landing, assessment, readout |
| `/prototype/sell` | Seller product |
| `/prototype/studio` | The agent surface |
| `/prototype/studio/queue` | Follow-up cadence, review queue, publishing seam |
| `/prototype/app` | Client portal |
| `/prototype/kaleb` | The agent's public site |

## 2. Verify before touching anything

```bash
npx tsc --noEmit    # must be clean
npm test            # 14 tests, must pass
npm run build       # must compile
```

If any of these fail on a fresh clone, fix that before starting work. All three pass today.

## 3. Configure the services

```bash
cp .env.example .env.local
```

`.env.example` documents every variable, grouped by service, with what happens when each is
absent. `.env.local` is gitignored and must stay that way — it has never been committed and
that record should hold.

| Service | Needed for | Blocking? |
| --- | --- | --- |
| Supabase | Anything with an account or a database | **Phase 1** |
| Sentry | Error capture | **Phase 1** — failures must surface from the first deploy |
| Brevo | Email delivery, contact sync | Phase 3 |
| Calendar | Real consultation booking | Phase 3 |
| SMS | Text steps in the nurture cadence | Phase 7 — degrades to email until then |
| E-signature | Representation agreements | Phase 5 |

Details, costs, and degradation behaviour: [integrations.md](integrations.md).

## 4. Accounts to create

Existing: **Supabase** (`uxcflubscmkbibepjmqj`), **Sentry**
(`ziid-development/value-first-realestate`), **Brevo** (free), **Vercel**
(`rift-homebuyer-roadmap`), **Calendar**.

Still to open, with lead times worth knowing now:

- **SMS provider.** Twilio or equivalent. US A2P traffic needs **10DLC brand registration**,
  which takes days rather than minutes — start it well before phase 7.
- **E-signature.** Dropbox Sign (~$20/mo) or DocuSign (~$25/mo).
- **A mortgage-rate source.** Not an account so much as a decision. Every monthly figure in
  the product currently rests on a hard-coded 6.5%. See [integrations.md](integrations.md) §7.

## 5. Before the first customer-facing deploy

Non-negotiable, and each one is cheap now and expensive later:

- [ ] **A Georgia attorney has read the TCPA consent wording** in `lib/prototype/privacy.ts`.
      It is written, unticked by default, specific, separate, and versioned — and it is
      marked in-product as not reviewed by counsel.
- [ ] **The broker has confirmed the client-record retention period.** It is the one business
      rule with a legal floor, currently defaulted to 5 years.
- [ ] **Sentry alerts exist** on readout delivery and consent recording.
- [ ] **Every table has an RLS policy.** Check, do not assume.
- [ ] **The deletion job runs and actually deletes.** A retention rule with no job behind it
      is a paragraph.
- [ ] **The rate assumption has a source and a date** displayed with every figure it touches.
- [ ] **Fair-housing check on the lead model.** The scoring inputs in `lib/prototype/lead.ts`
      are documented as the complete list, with no proxy for a protected class. Confirm that
      is still true of whatever ships.

## 6. Deployment

Vercel, project `rift-homebuyer-roadmap`. Set the same variables in the Vercel dashboard;
`SENTRY_AUTH_TOKEN` there enables source-map upload, and without it `next.config.ts` disables
upload rather than failing the build.

Supabase migrations apply with `scripts/apply-sql-migration.sh`. `scripts/bootstrap-supabase.sh`
provisions a project from scratch — useful for a staging environment, and worth having one
before there is real client data in production.

## 7. Repository map

```
app/
  page.tsx           development index — replaced by the real landing in phase 2
  prototype/         THE SPECIFICATION — 30 routes, no dependencies
  auth/callback/     Supabase auth callback
  actions/           server actions
components/rift/     the specification's component kit
lib/
  prototype/         domain logic — pure, I/O-free, unit-tested
  auth/              Supabase auth with a localStorage fallback
  supabase/          client, server, middleware
  brevo/             contact sync
  monitoring/        Sentry capture
supabase/
  migrations/        applied — currently the RETIRED MVP's schema, see schema.md
  seed/
scripts/             supabase bootstrap, migration apply, brevo attributes
docs/                read in the order given in AGENTS.md
```
