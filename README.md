# NoRegret

Next.js 15 + Supabase + Vercel. Personal day planner and prep tracker. Everything saves to Postgres (RLS on every table); nothing important lives in the browser.

## Features

| Milestone | Status |
|---|---|
| 1 Foundation: auth (`@supabase/ssr` + middleware), migrations + RLS, sidebar / mobile tab bar, light/dark, PWA manifest | Built |
| 2 Schedule + Today: editable timetable, Now/Next, tick + log minutes, start/stop timer, bad-day minimum, streak | Built |
| 3 Habits + Home + Night check: checkbox / counter / duration / sleep habits, 28-day heatmap, streaks, mom tasks, 1-5 regret check | Built |
| 4 Tracker engine: groups, status, filters, search, notes, add/delete, CSV import + export, revision queue; seeded Aptitude, SQL, Web Dev, CS, Interview Prep | Built |
| 5 DSA roadmap: 60 Day cards, current-day pointer, pace indicator, family filter/edit, resources, spaced revision | Built |
| CSES phase: sync/import problem list, configurable section priority, Today queue and revision marking | Built |
| Dashboard: activity, category and weekly charts, summaries and revision queue | Built |
| AWS / ML / Projects: practice logs, resources, exam countdown, project and contribution tracking | Built |
| Contests: synced/manual contests, attendance, results, upsolves and trend charts | Built |
| Explore / Blog / Weekly Review | Built |
| Push reminders and embroidery tracker | Embroidery tracker built; automatic push delivery is not scheduled |
| Tracker drag-to-reorder and offline app shell | Built |
| Playwright E2E suite | Not included; testing was declined for this implementation |

The app uses Tailwind, server actions and TanStack Query. It includes a small shadcn-style Button component, not the full shadcn/ui component set. Database types are not generated. Problems solved on the DSA card do not create time entries; log the DSA block's minutes separately.

## Setup

1. **Supabase project**: create one at supabase.com.
2. **Schema**: run both `supabase/migrations/0001_init.sql` and `supabase/migrations/0002_pending_features.sql` (or `supabase db push` with the CLI).
3. **Owner account**: Authentication > Users > Add user (email + password, tick auto-confirm). Then Authentication > Sign In / Providers > turn **off** "Allow new users to sign up".
4. **Env**: copy `.env.example` to `.env.local` and fill in the project URL, anon key, service-role key (Project Settings > API) and `SEED_USER_EMAIL` (the owner's email). The service-role key is needed by the seed script; never prefix it with `NEXT_PUBLIC_`. Push delivery additionally requires VAPID keys and `VAPID_SUBJECT`; generate keys with `npx web-push generate-vapid-keys`.
5. **Install + seed + run**:
   ```bash
   npm install
   npm run seed      # idempotent: safe to re-run, never resets progress
   npm run dev       # http://localhost:3000
   npm test          # unit tests
   npm run sync:cses # optional: refresh the CSES problem list for the seed owner
   ```
6. **Deploy to Vercel**:
   - Push the project to GitHub, import the repository in Vercel, and set the app folder as the Root Directory if the repository contains multiple projects.
   - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project Settings > Environment Variables. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it is only needed in Vercel if you add a server-side operation that uses it. Push reminders require `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`, plus a scheduler to invoke delivery.
   - Apply both SQL migrations and seed the owner account before relying on database-backed pages. Do not put `SEED_USER_EMAIL` in Vercel unless you plan to run the seed script there.
   - Deploy. No Vercel Cron jobs are configured. Contest syncing remains available from the app; push notifications will not be sent automatically unless you configure an external scheduler.

The CSES list can also be synced by an authenticated user in Settings or imported from CSV with `tracker,group,title,url` columns. Offline support caches only the app shell; private Supabase data is not available offline.

`npm run build` succeeds. `npm audit` reports no known vulnerabilities. Unit and browser tests were not run.

## Rules baked in

- "Today" is computed in the user's timezone (default `Asia/Kolkata`), not the server's.
- **Bad-day minimum** = DSA block (on days that have one) + exercise + at least 5 study hours (configurable). A day that meets it counts toward the streak. Weekends have no DSA block, so it needs exercise + hours.
- **Roadmap pointer**: finishing every problem of the current day moves it to the next unfinished day. Finishing a day that is not current never moves it. Day 60 does not auto-switch phase; a "Start CSES phase" button appears.
- **Pace**: target is `days_per_week` roadmap days per 5 weekdays since `roadmap_started_on`.
- **Revision**: a done problem becomes due after 14 days; flagging it makes it due now; "Revised" reschedules at +1, +3, +7, then +21 days.

## Verify RLS

With the anon key and no session, `GET /rest/v1/tracker_items` must return `[]` (and inserts must fail). Policies are owner-only (`user_id = auth.uid()`) on the app's user-owned tables.
