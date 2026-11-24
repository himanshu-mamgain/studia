# Studia

The family repo for Structura, Schemata and DSA Atlas: what they share. No app code lives here;
each app's code is in its own repo.

- `ecosystem.json`: the app list. When it changes, update the copy in all three apps
  (Structura `apps/web/src/ecosystem.ts`, Schemata `src/ecosystem.ts`, DSA Atlas
  `packages/shared/src/ecosystem.ts`).
- `docs/accounts.md`: the Studia account contract (Supabase project, `studia-auth` cookie,
  `app_progress` table, sync by read-merge-write) and the owner's setup steps. A change to the
  contract must land in all three apps.
- `docs/domain.md`: the move to `studia.dev`.
- `supabase/migrations/`: the database, the source of truth for all three apps.
- **The daily plan** (`web/src/plan.ts`, page `/today` in `web/src/today.ts`): one checklist a day across the
  three apps, from 25 Nov 2026 to the owner's goal on 1 Aug 2027, in four phases. A queue, not a calendar:
  each day takes the next unfinished items at its weekday's quota, so missed items come back by themselves.
  Items tick themselves from each app's synced row; Studia keeps its own row (`app = 'studia'`: each day's
  list, hand ticks, history). The study lists come from each app's published JSON (Structura `/topics.json`,
  DSA Atlas `/checklist.json`, Schemata `/plan.json`), refreshed into `web/src/content.json` by
  `web/scripts/content.mjs` before each build. `npm test --prefix web` checks the plan.
- **Reminders** (`web/src/notify.ts`, `web/public/sw.js`, `netlify/functions`): 11:00, 17:00 and 21:30 in
  the learner's time. The Today page works out the texts for today and the next 7 days and sends only those
  to `/api/push`, which keeps them in Netlify Blobs; `push-send` sends what's due every 15 minutes. Never
  send progress to the functions. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in
  Netlify's environment variables (set by the owner; never in this repo). `npm test` at the root checks both.
- **Look and app** (`web/src/sketch.ts`, `web/public/manifest.webmanifest`, `web/public/sw.js`): hand-drawn
  outlines with rough.js, like Structura's diagrams (cards, buttons, tasks, the ring, bars and ticks); an
  installable app (manifest, icons, an Install button; on iPhone, Share → Add to Home Screen) that opens offline;
  dark mode; and `web/public/studia-plan.ics`, three daily calendar events (11:00, 17:00, 21:30 to 1 Aug 2027).
- `web/`: the **Studia site** (`studia-hub.netlify.app`, later `studia.dev`): the home page, the
  shared login (`/login?app=<id>&next=<page>`) and sign-out (`/logout`). Vite and TypeScript, no
  framework. `netlify.toml` at the root builds it. `npm test --prefix web` checks where the login
  may send people (`safeNext` in `web/src/apps.ts`: only the apps' own sites and their previews).

## Rules

- Work on a branch and open a pull request, then merge it with a merge commit. Never push to `main`.
- **Migrations only grow.** Never edit a migration that may have run; add a new, timestamped file
  (`YYYYMMDDHHMMSS_what.sql`). Every table gets row-level security and policies that limit each
  user to their own rows, and grants only to `authenticated` unless the owner asks otherwise.
- **No secrets in this repo**: no Supabase secret (service role) key, database password, or GitHub
  client secret. The Project URL and the publishable key are public and may appear in docs.
- **Signing in is a switch, owned by the owner.** He chose to put the apps behind the Studia login
  (`VITE_REQUIRE_SIGN_IN=true` in an app's Netlify settings). Keep it a switch: with it off, every
  page works signed out. Either way an app still opens offline, and search engines still read it.
- The login sends people only to the apps' own addresses. Never loosen `safeNext`, and never put a
  session token in a query string (only in the `#fragment`, which never reaches a server).
- Write docs in Simple English: short sentences, everyday words, explain every term and
  abbreviation the first time it appears (the same rules as Structura's notes).
