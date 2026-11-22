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

## Rules

- Work on a branch and open a pull request, then merge it with a merge commit. Never push to `main`.
- **Migrations only grow.** Never edit a migration that may have run; add a new, timestamped file
  (`YYYYMMDDHHMMSS_what.sql`). Every table gets row-level security and policies that limit each
  user to their own rows, and grants only to `authenticated` unless the owner asks otherwise.
- **No secrets in this repo**: no Supabase secret (service role) key, database password, or GitHub
  client secret. The Project URL and the publishable key are public and may appear in docs.
- The apps work without an account. Nothing here may make signing in required.
- Write docs in Simple English: short sentences, everyday words, explain every term and
  abbreviation the first time it appears (the same rules as Structura's notes).
