# Branching Choice-Node Threads

A Next.js + Supabase application for branching, choice-driven stories.

## Current status

The uploaded source files have been moved into their expected Next.js folders. This repository is **not ready to deploy yet** because the current upload is missing parts required for a working Next.js application and the initial database schema.

### Still missing
- `app/page.tsx` and the other route/page components
- `app/layout.tsx` and `app/globals.css`
- `tsconfig.json` (including the `@/*` path alias used by the source)
- `supabase/migrations/0001_core.sql` (the base schema required by migration 0002)
- `app/auth/callback/route.ts` (Supabase email confirmation / OAuth code exchange)
- Tailwind and PostCSS configuration files, if not generated during setup

**Do not run `0002_hardening.sql` until the matching `0001_core.sql` has been restored and reviewed.** Migration 0002 depends on tables and functions from the base schema.

## Setup after restoring the missing files

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase and Upstash values.
4. Create/configure the Supabase project and apply migrations in order: `0001_core.sql`, then `0002_hardening.sql`.
5. Configure Supabase Auth site URL and redirect URLs, including `/auth/callback`.
6. Run `npm run build` and fix any reported errors before deploying.

## Environment variables

See `.env.example`. Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY` in browser code.

## Scheduled node locking

`vercel.json` schedules `/api/cron/lock` once per minute. Configure `CRON_SECRET` in the deployment environment. If your Vercel plan does not support the required cron frequency, use a supported database scheduler instead.
