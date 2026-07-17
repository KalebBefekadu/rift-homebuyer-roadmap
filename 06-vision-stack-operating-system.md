# Rift Homebuyer Program — Vision, Goals, Stack & Operating System

**Status:** Working reference (locked decisions from strategy + architecture sessions)  
**Audience:** Kaleb + coding agents building and operating the system  
**Last updated:** July 2026

---

## 1. Vision

Rift helps renters become qualified, confident, well-financed first-time homeowners — with interests stated out loud. Kaleb only wins when they win. Transparency is the strategy, not a risk.

The north star is simple: **provide as much value as possible.** More useful diagnosis, more free resources, more clarity, more support stacked over time — not less held back to create artificial scarcity. Value is the product. Closings are the natural result when that value works.

The product anchor is a **personalized Homeownership Roadmap**: a plan the client keeps that shows where they stand (payment, cash to close, remaining gap after savings and assistance), what money they may qualify for, and the next concrete moves. That plan is the **trust-earner** and the **switching cost**. Every future check-in is “let’s update your roadmap,” not a cold restart.

**Not the vision:** a bloated CRM, MLS alert engine, or multi-tool marketing empire. The vision is a thin, highly effective readiness engine for one pathway — first-time buyers who are renting today — run by a solo agent without drowning in software, while continuously **adding more value on top** (resources, workshops, partners, portal, updates) as the program matures.

---

## 1b. Value proposition

### Promise

> You leave with a real plan and ongoing help to execute it — not a sales pitch. We give away the diagnosis freely and keep adding tools, education, and support so you can actually reach the closing table.

### How we maximize value (now and over time)

| Layer | What they get | Cost to them |
|-------|----------------|--------------|
| **Diagnosis (core)** | Full Homeownership Roadmap PDF — numbers, gap, DPA, next moves | Free to keep |
| **Education** | Workshops (incl. Amharic), newsletter tips, resource vault | Free |
| **Community** | Group accountability / monthly standing event | Free |
| **Guidance over time** | “Update your roadmap” check-ins; staged help (lender, DPA, CPA, credit) as they progress | Free until they buy (execution is sequenced, not withheld as a tease) |
| **Living plan (build)** | Portal / shareable roadmap that updates as they move | Free |
| **Add-ons over time** | More free resources, better DPA data, affordability tools, partner intros when ready — stacked, not rationed | Keep adding |

### Operating principles for value

1. **Maximize value first.** When choosing what to build or send next, ask: does this make the client more qualified, confident, or clearer? If yes, bias toward shipping it.
2. **Give the diagnosis away.** The roadmap and core clarity are never paywalled or drip-teased.
3. **Stack free resources.** Workshops, vault, newsletter, templates, Amharic-accessible education — expand the free layer over time.
4. **Sequence execution, don’t starve it.** Lender/DPA/CPA help unlock as they progress so personal time stays sustainable — still real help, not bait.
5. **Add on top, don’t replace.** New value (portal, solver, verified DPA, partner playbooks) compounds the roadmap; it doesn’t reset the relationship.
6. **Aligned motive, said out loud.** More value → more ready buyers → more closings. Hoarding value would fight the business model.

### What “a lot of value” looks like in practice

- They understand their number and gap better than before they met you.  
- They have written next moves and due dates, not vague encouragement.  
- They can return to the plan (PDF, then living link/portal) without starting over.  
- They get ongoing education and community without buying anything.  
- When they are ready, the next doors (lender, assistance, docs) open with you — because you already earned trust with generosity.

---

## 2. Business goals

### Year-one outcomes

| Goal | Target |
|------|--------|
| Incremental closings (on top of normal business) | **6** |
| Genuinely engaged people in the pipeline | **~50** (≈10–20% conversion) |
| Closing window bias | **3–12 months** (protect personal time) |
| Intake → branded roadmap | **Under 30 minutes** |

### Value posture

- **Maximize value.** Default bias: give more free clarity and resources, then keep adding on top.
- **Generous with the diagnosis.** Full roadmap at intake: numbers, gap, DPA amounts, three moves. Free to keep.
- **Sequenced on the execution.** Lender intro, DPA help, tax coordination, credit recheck happen as they progress — not teased to reel people in.
- **Time protection.** Free value is open to all. Personal time gated by honesty at intake (far-out → Long Nurture + automation) and effort (non-movers demote kindly). Exit is always kind and door-open.

### What “highly effective” means

| For the client | For Kaleb |
|----------------|-----------|
| Clear monthly payment and cash gap | 30-minute fill-in template, not research |
| Assistance amounts and next moves | Pipeline by stage + time-to-buy bucket |
| Free resources + community that keep helping | Leveraged delivery (workshop, vault, automation) |
| A plan worth keeping — and updating | Reason for every touchpoint |
| Would feel stupid starting over elsewhere | Near-zero personal time on 9+ month leads |

### Program constraints (non-software, still load-bearing)

- One pathway at launch: **first-time-buyer readiness for renters** (investor track later).
- Lead source: warm outreach, specific referrals, community workshops (incl. Amharic) — **not ads**.
- Partners: hard-cases **lender** and underwriting-aware **CPA** are launch gates.
- CRM/marketing: **buy/use one hub**, don’t build a messaging product inside the roadmap app.

---

## 3. How we develop (phased plan)

### Principles

1. **Maximize client value.** Prefer shipping free clarity, resources, and tools that make buyers more ready — then add more on top over time.
2. **Effectiveness over feature count.** Prove real intakes before infra sprawl.
3. **Source of truth is thin.** Roadmap + stage + bucket live in our app/DB; messaging lives in one free hub.
4. **Free to start is non-negotiable** for the marketing/automation layer.
5. **Automation for consistency** — enrollments and stage unlocks must not depend on memory.
6. **Hard-to-change seams first:** identity, sync direction, event names (don’t dual-write stages).

### Build sequence

| Phase | What ships | Outcome |
|-------|------------|---------|
| **A — Usable MVP (done / in progress)** | Calc engine, intake + live preview + PDF, pipeline, settings, landing, admin/client portal shells, local persistence | Kaleb can run an intake and hand a PDF |
| **B — Cloud truth** | Supabase Auth + tables + RLS; server-trusted outputs on save | Data not trapped in one browser |
| **C — Messaging spine (free)** | Brevo Free: contacts, lists, automations, newsletter; sync from Rift on save / stage change; Brevo MCP for AI ops | Consistent nurture without paying FUB yet |
| **D — Client value loop** | Shareable read-only roadmap link and/or portal showing their plan | Switching cost between sessions |
| **E — Intake leverage** | Affordability solver; verified Georgia DPA amounts | Faster, more trustworthy diagnosis |
| **F — Pay when it hurts** | Graduate messaging hub to Follow Up Boss if native SMS + RE inbox justify ~$69/mo | Same sync pattern; swap hub |

### Explicitly deferred / out of scope

- Building MLS listing alerts  
- Building a full CRM or ESP inside Next.js  
- Twilio/Sendblue as day-one products (use phone SMS until needed)  
- Ads-driven acquisition  
- Multi-agent tenancy  
- Investor / off-market tracks before 2–3 success stories  

### Definition of done for “program MVP”

- Full intake → branded PDF in under 30 minutes  
- Client + roadmap persisted; pull-back-up works  
- Cash-gap math correct (unit-tested)  
- New client auto-lands in Brevo nurture by bucket  
- Stage change can unlock the next touch pattern without manual list juggling  

---

## 4. Tech stack

### Application (roadmap product)

| Layer | Choice | Why |
|-------|--------|-----|
| App | **Next.js (App Router) + TypeScript** | One codebase; Vercel-ready |
| UI | **Tailwind** + Rift brand tokens | Fast, consistent with prototype |
| Hosting | **Vercel Hobby** (when deploying) | Free personal deploy |
| Calc | **`lib/roadmap/calc.ts`** (pure, Vitest) | No math in UI; testable |
| PDF (MVP) | **html2pdf.js** (client) | Free; good enough for 1–2 pages |
| Auth (target) | **Supabase Auth** | Free tier; RLS; single admin agent |
| Database (target) | **Supabase Postgres** | Source of truth for clients, roadmaps, settings, DPA |
| Persistence (current bridge) | **localStorage** until Supabase wired | Ships value before cloud keys |
| Error visibility | **Sentry Free** | Catch silent failures (sync drops, PDF errors, unhandled exceptions); free tier is enough at this scale |

### People + marketing (one hub — free start)

| Layer | Choice | Why |
|-------|--------|-----|
| Marketing / nurture / newsletter | **Brevo Free** | $0; contacts; automations (up to ~2k in workflows); ~300 emails/day; **official MCP** for Cursor |
| SMS (day one) | **Personal phone + templates** | Free; Tier-3 stays human |
| SMS (later, optional) | FUB built-in, or Twilio/Sendblue only if volume demands | Avoid tool sprawl |
| CRM upgrade path | **Follow Up Boss Grow (~$69/mo)** | When RE inbox + native SMS automation is worth paying for |

### AI / operator tooling

| Tool | Role |
|------|------|
| **Brevo MCP** | Campaigns, contacts, lists, analytics via Cursor |
| **Supabase MCP** | Pipeline truth (stages, buckets, clients) once cloud is live |
| Coding agents | Build Rift; do not invent a second CRM |

### What we are not using (for now)

HubSpot (freemium trap), Customer.io as primary ($100 + weak agent inbox), GoHighLevel as day-one (complexity / possible API tier jump), Mailchimp + separate SMS + separate CRM, building Resend/Twilio into the Next app as the marketing system.

---

## 5. System workflow

### Mental model: two brains, one direction of truth

```
┌─────────────────────────────────────┐
│  RIFT (plan brain)                  │
│  Intake → calc → PDF → versions     │
│  stage + time_to_buy (SOURCE OF     │
│  TRUTH)                             │
└─────────────────┬───────────────────┘
                  │ sync on save / stage change
                  ▼
┌─────────────────────────────────────┐
│  BREVO (people + messages brain)    │
│  Contacts, lists, automations,      │
│  newsletter, MCP                    │
└─────────────────────────────────────┘
                  │
                  ▼
         Client email (nurture)
         Kaleb phone (Tier-3 SMS)
```

**Rule:** Stage and bucket are edited in Rift (or Supabase-backed admin UI). Brevo is a **projection + messaging engine**, not a second place to invent pipeline truth. Avoid dual-write.

### Primary agent flow (intake)

1. Admin logs into Rift portal.  
2. Creates/fills client intake (preferences, numbers, credit, DPA, moves, note).  
3. Live preview updates; cash gap computed by pure calc module.  
4. Save → persist client + roadmap version; set stage (e.g. Roadmap Done) + bucket.  
5. Sync → Brevo: upsert contact; set attributes (`stage`, `time_to_buy`, name, phone); add to list / start automation for that bucket.  
6. Download branded PDF; hand to client (diagnosis is theirs to keep).  
7. Follow-up thereafter is “update your roadmap,” driven by Brevo drips + calendar/phone for human moments.

### Client-facing surfaces

| Surface | Purpose |
|---------|---------|
| Public landing | Trust, program story, signup/login |
| Client portal (evolving) | Eventually show their roadmap |
| Shareable link (planned) | Read-only plan without heavy auth |
| PDF | Offline switching cost at intake |

### Follow-up structure (automation + humans)

| Tier | Who | Channels | Automation |
|------|-----|----------|------------|
| **1 — 9+ months / Long Nurture** | Far-out or demoted | Newsletter + light drip | Fully automated; near-zero personal time |
| **2 — 3–9 months (core)** | Main pipeline | Email drip tied to moves; occasional check-in | Brevo automations + scheduled human “update roadmap” |
| **3 — Milestones** | Credit hit, pre-approval, found house, Mortgage Ready | **Personal** call/text from Kaleb | Brevo/Rift creates a **task/alert**; human sends the message |

### Message types (write once)

1. Broadcast newsletter (workshop, monthly tip)  
2. Education drip by bucket  
3. Move-due nudges (email first; SMS via phone if needed)  
4. Roadmap update invite  
5. Milestone personal touch (never fully automated empathy)  
6. Kind demotion / door-open  

### Stage × messaging unlocks (conceptual)

| Event in Rift | Brevo behavior |
|---------------|----------------|
| Contact created + Roadmap Done | Enroll bucket automation; add to Active list |
| Stage → Working the Gap | Tag/attribute update; continue or branch drip |
| Stage → Mortgage Ready | Exit soft drip; create “personal touch today” task/notification |
| Stage → Shopping | Pause education; optional short shopping cadence |
| Stage → Closed | Exit nurture; review/referral sequence later |
| Stage → Long Nurture | Move to newsletter-only segment |
| Roadmap v2 saved | Fire `roadmap_updated` (progress note) — **do not** restart full drip |

---

## 6. Edge cases and how the system sustains them

| # | Edge case | How we handle it |
|---|-----------|------------------|
| 1 | Dual systems invent different stages | **Rift/Supabase owns stage**; Brevo only receives sync |
| 2 | Re-saving roadmap restarts drip (spam) | Separate events: `roadmap_completed` vs `roadmap_updated` |
| 3 | Duplicate workshop signup + intake | Dedupe Brevo contact by **email** |
| 4 | Typo email / bounces | Bounce → fix contact in Rift; re-sync |
| 5 | Phone-only client (no email) | Rift still stores them; nurture via phone templates until email exists |
| 6 | Email ok, no SMS consent | Channel preference on contact; email-only automations |
| 7 | STOP / unsubscribe | Honor Brevo unsubscribe; never import into SMS blasts without consent |
| 8 | TCPA / texting rules | Day-one SMS is **personal phone**; capture consent before any bulk SMS later |
| 9 | “Found a house” inbound text | Human Tier-3; flip stage in Rift; sync pauses soft nurture |
| 10 | Couple, one roadmap, two phones | Automate **primary** contact only; partner manual CC |
| 11 | Two ignored nudges | Automation → Long Nurture + kind door-open email |
| 12 | Client angry / DNC | Hard suppress in Brevo; stage note in Rift |
| 13 | Sync API down | Queue/retry on save; **Sentry alert** if sync fails; no silent drop |
| 14 | Partial sync (contact ok, journey fail) | Idempotent re-sync; admin-visible error + **Sentry** with context |
| 15 | Holiday pause | Pause Brevo campaigns; don’t delete journeys |
| 16 | Workshop spike (many signups) | Email under 300/day free limit; batch next day; no SMS blast |
| 17 | AI agent mistakes a segment | Brevo MCP: prefer **read** + draft; human approves broadcasts |
| 18 | You on vacation | Tier-1 continues; Tier-3 tasks pile with backup rule (call coverage) |
| 19 | DPA amounts change | Update seed/list; don’t auto-email old PDFs as current truth |
| 20 | Later KW/internet leads | Separate source tag; don’t mix raw lead spam with roadmap nurture |
| 21 | Free Brevo limits hit | Upgrade Brevo send tier **or** migrate hub to FUB — same sync contract |
| 22 | Client portal empty | Clear empty state until roadmap linked; PDF still delivered at intake |
| 23 | Multi-device admin | Solved by Supabase (Phase B), not localStorage |
| 24 | Public “Agent” signup abuse | Seed **one admin**; clients invite-only or link-only (identity hardening) |

### Hard rules that prevent most failures

1. **One source of truth for stage/bucket.**  
2. **One messaging hub at a time** (Brevo now).  
3. **Automation for consistency; humans for Tier-3.**  
4. **Events are named carefully** so updates don’t re-enroll.  
5. **Free SMS = phone** until paid inbox is justified.  
6. **No silent failures.** Sync, PDF, and auth errors go to **Sentry** (and a user-visible message where it matters).  

---

## 6b. Error visibility (Sentry Free)

Silent drops were called out as edge cases; monitoring is part of the stack, not an afterthought.

| What | How |
|------|-----|
| Unhandled UI / server exceptions | `@sentry/nextjs` auto-capture |
| Brevo sync failure / partial sync | `Sentry.captureException` with client id, stage, event name |
| PDF export failure | Capture + user-facing retry message |
| Auth / Supabase errors (once live) | Capture with scrubbed PII |

**Cost:** Sentry Free developer tier (enough for solo volume).  
**Env:** `NEXT_PUBLIC_SENTRY_DSN` (and optional auth token for source maps on deploy).  
**Rule:** Prefer noisy failures we can fix over quiet data loss.

---

## 7. Success metrics (product vs program)

| Level | Metric |
|-------|--------|
| Value | Free resources shipped; workshops run; roadmaps kept; clients reporting clearer next steps |
| Program | Incremental closings; engaged pipeline size; time-to-close distribution |
| Product | Intakes completed under 30 min; roadmaps saved; sync success rate; **Sentry error rate near zero on sync/PDF** |
| Nurture | Automation enrollment rate; demotion rate; Tier-3 response time |
| Trust | DPA amounts verified; disclaimer always on PDF |

---

## 8. One-page summary

**Vision:** Transparent first-time-buyer readiness; give as much value as possible; roadmap as switching cost.  
**Value proposition:** Free diagnosis + stacked free resources/community + sequenced real help as they progress — keep adding on top.  
**Goal:** ~50 engaged → 6 incremental closings; protect Kaleb’s time without starving clients of value.  
**Build:** Thin Rift MVP → Supabase → Brevo sync → client roadmap access → pay for FUB only when needed.  
**Stack:** Next.js + Supabase + Brevo Free (+ MCP) + Sentry Free + phone SMS; Vercel when live.  
**Workflow:** Intake in Rift → sync attributes/events to Brevo → bucket/stage automations; Tier-3 is human.  
**Edge cases:** Single source of truth, careful events, dedupe, consent, no dual CRM, escalate hub when free limits or SMS inbox become the bottleneck.

---

## Related docs

- `01-program-strategy.md` — locked program decisions  
- `02-roadmap-feature-spec.md` — product MVP / V2  
- `03-technical-architecture.md` — data model / RLS  
- `04-calculation-spec.md` — calc formulas  
- `05-build-plan.md` — original engineering phases  
- GitHub: [rift-homebuyer-roadmap](https://github.com/KalebBefekadu/rift-homebuyer-roadmap)  
