# Setup
1. `npm i` · copy `.env.example` → `.env.local` and fill it in.
2. Supabase SQL editor: run `0001_core.sql` (done) then `0002_hardening.sql`.
3. Auth → URL config: Site URL + `…/auth/callback`; keep email confirmation ON.
4. Add `app/auth/callback/route.ts` (exchangeCodeForSession) — still to build.
5. Vercel: set all env vars. `vercel.json` cron runs every minute (needs Pro; on Hobby use pg_cron: `select cron.schedule('lock','* * * * *',$$select lock_expired_nodes()$$);`).
