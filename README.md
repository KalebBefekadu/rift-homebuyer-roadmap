# Rift Homebuyer Roadmap — App

Working MVP of the client-readiness roadmap generator.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s live

- **Public landing** (`/`) — client-facing program overview + Log in / Sign up
- **Auth** — local email/password accounts with roles `admin` (agent) or `client` (buyer)
- **Admin portal** (`/portal/admin/...`) — pipeline, roadmap generator, PDF, settings
- **Client portal** (`/portal/client`) — placeholder for the shared living roadmap (next)

Sign up as **Agent** to use the intake tools. Sign up as **Homebuyer** to see the client portal shell.

## Persistence

Roadmap data still uses browser **localStorage**. Auth users are stored locally too (free / solo). Supabase SQL in `supabase/` is ready when you want cloud auth + sync.

## Optional: Supabase later

SQL is ready in `supabase/migrations/` and `supabase/seed/`. Create a free Supabase project, run the migration + seed, add keys to `.env.local` from `.env.example`, then we can wire cloud auth/sync.

## Docs

Strategy and specs remain in the numbered markdown files at the repo root (`01`–`06`). Start with [`06-vision-stack-operating-system.md`](06-vision-stack-operating-system.md) for the locked vision, stack (Brevo Free + Rift), workflows, and edge cases. Prototype reference: `roadmap-generator.html`.
