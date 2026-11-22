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
