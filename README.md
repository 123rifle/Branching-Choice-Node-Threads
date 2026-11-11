# Branching Choice-Node Threads

> **Status: incomplete source handoff — not deployable yet.**
>
> This repository contains the backend/server-action starter files supplied in the current Claude ZIP. It does not yet include the Next.js app entry points (`app/page.tsx`, `app/layout.tsx`), global styles, Tailwind/PostCSS configuration, or the auth callback route. A Vercel build will fail until those are added.

## Next steps

1. Complete the missing frontend and configuration files.
2. Add the reviewed Supabase core migration at `supabase/migrations/0001_core.sql` and verify both migrations on a fresh Supabase project.
3. Configure environment variables from `.env.example` in Vercel.
4. Connect this repository to Vercel for a live preview.

Do not add real secrets to this repository. Keep the Supabase service-role key server-side only.
