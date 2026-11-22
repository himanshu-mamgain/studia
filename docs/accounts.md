# Studia accounts

One account for Structura, Schemata and DSA Atlas: **sign in with GitHub once**, and your progress
follows you to every device and every app. Signing in is always optional: every page of every app
works without an account.

The accounts live in **one Supabase project** (Supabase is a hosted Postgres database with sign-in
built in). Supabase Auth handles the GitHub sign-in. One table, `app_progress`, keeps each user's
progress, one row per app.

This page is the **contract** every app follows, then the **setup steps** for the owner.

## The contract

Each app keeps its own copy of the code (a few small files), but these details must be the same
everywhere, or the apps won't share a sign-in:

| Detail | Value | Why |
| --- | --- | --- |
| Supabase project | one project, `studia`, in Mumbai (`ap-south-1`) | One user list for all three apps |
| Sign-in | GitHub, through Supabase Auth, PKCE flow (a one-time code only this browser can redeem) | No passwords to keep |
| Client library | `@supabase/ssr`'s `createBrowserClient` | It keeps the session in a cookie, which subdomains can share |
| Session cookie name | `studia-auth` | All apps read the same cookie |
| Cookie domain | `.studia.dev` once the apps live there; not set before that | A cookie on `.studia.dev` is sent to every subdomain |
| Cookie settings | `path=/`, `SameSite=Lax`, `Secure` on HTTPS, kept 400 days | The same in every app |
| Progress table | `public.app_progress (user_id, app, data, updated_at)` | One row per user per app |
| App ids | `structura`, `schemata`, `dsa-atlas` | The `app` column; the table refuses others |
| Signing out | `supabase.auth.signOut({ scope: 'local' })` | Signs out of this browser (and every subdomain sharing the cookie), not every device |

### How an app uses it

1. **Only load Supabase when needed.** At start-up, load the client only if the `studia-auth`
   cookie is there or the address has `?code=` (coming back from GitHub). Otherwise wait until the
   learner taps "Continue with GitHub". This keeps the Supabase code (about 60 KB gzipped) out of
   every page load.
2. **Sign in:** `signInWithOAuth({ provider: 'github', options: { redirectTo: <this page> } })`.
   When the learner comes back, the client swaps the code for a session by itself; then remove
   `?code=` from the address.
3. **Sync progress by read, merge, write.** Fetch the account's row, merge it with this device's
   progress, save the result locally and to the row. Do this after sign-in and a few seconds after
   each change. Never just overwrite the row: another device may have saved something meanwhile.
4. **Merge so nobody loses work.** Combine anything that only grows (sections read, lessons done,
   best scores). Things a learner can switch off again (a bookmark) come from whichever copy changed
   last, so each item needs an `updatedAt` time.
5. **Sync only progress.** Settings, drafts and secrets (such as Structura's notes key) stay on the
   device.

Structura's version is the reference: `apps/web/src/account/` in
[structura](https://github.com/himanshu-mamgain/structura) (`config.ts`, `client.ts`, `account.ts`,
`merge.ts`, `AccountButton.tsx`).

### Settings each app needs

These are read when the site is built, so they go in each Netlify site's environment variables.

| Setting | Structura and DSA Atlas (Vite) | Schemata (Next.js) |
| --- | --- | --- |
| Project URL | `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Cookie domain (after the move) | `VITE_AUTH_COOKIE_DOMAIN=.studia.dev` | `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.studia.dev` |

The **publishable key** (it may be called the anon key) is meant to be public: it ships in the
browser. Row-level security decides what each user can read or write. The **secret key** (service
role) is never used by the apps: never put it in an app, a variable or this repo.

## Setup (once, by the owner)

### 1. Create the Supabase project

1. On [supabase.com](https://supabase.com), create a new project:
   - **Name:** `studia`.
   - **Database password:** use the generated one and keep it in a password manager. The apps don't
     need it.
   - **Region:** choose a specific region, **Asia-Pacific (Mumbai)** (`ap-south-1`). It can't be
     changed later.
   - **Enable Data API:** on (the apps save progress through it).
   - **Grant API access to new tables automatically:** off. The migration grants access itself.
   - **Enable RLS on new tables automatically:** on.
2. Open **SQL Editor**, paste [`supabase/migrations/20261122120000_app_progress.sql`](../supabase/migrations/20261122120000_app_progress.sql)
   and run it. **Table Editor** should now show `app_progress` with RLS enabled.
3. In **Project Settings → API Keys**, note the **Project URL** (`https://<project-ref>.supabase.co`)
   and the **publishable key**.

On the free plan, Supabase may pause a project after a week with no activity; check
[Supabase's pricing](https://supabase.com/pricing). A paused project wakes up from the dashboard.

### 2. Create the GitHub OAuth app

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Application name:** `Studia`. **Homepage URL:** `https://structura-web.netlify.app` for now
   (`https://studia.dev` after the move).
3. **Authorization callback URL:** `https://<project-ref>.supabase.co/auth/v1/callback` (your Project
   URL plus `/auth/v1/callback`).
4. Create it, then **Generate a new client secret**. Keep the **Client ID** and **Client secret** for
   the next step only; don't paste them anywhere else.

### 3. Turn on GitHub sign-in in Supabase

1. **Authentication → Sign In / Providers → GitHub:** enable it, paste the Client ID and Client
   secret, and save.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://structura-web.netlify.app` (later `https://studia.dev`).
   - **Redirect URLs** (where Supabase may send people back to after GitHub):

     ```text
     https://structura-web.netlify.app/**
     https://**--structura-web.netlify.app/**
     https://schemata-web.netlify.app/**
     https://**--schemata-web.netlify.app/**
     https://dsa-atz.netlify.app/**
     https://**--dsa-atz.netlify.app/**
     http://localhost:5173/**
     http://localhost:3000/**
     ```

     The `**--…netlify.app` lines are each site's deploy previews. Port 5173 is Vite (Structura,
     DSA Atlas) and 3000 is Next.js (Schemata). After the move, add `https://studia.dev/**` and
     `https://*.studia.dev/**`.

### 4. Give the apps their settings

In Netlify, for each site that has the account code, open **Site configuration → Environment
variables** and add the Project URL and the publishable key, with the names from the table above.
Then trigger a new deploy: the values are read at build time.

Today that's **Structura**. Schemata and DSA Atlas get theirs when their account code lands.

### 5. Check it

Open Structura, tap the person icon in the top bar, then **Continue with GitHub**. You should come
back to the same page with your GitHub picture in the top bar, and "Progress synced just now" in
its panel. In Supabase's **Table Editor**, `app_progress` should have one row for you with
`app = structura`.

## Moving to studia.dev

See [domain.md](domain.md). Until then each app signs in separately (the same account, but you
sign in once per app), because browsers don't let one `netlify.app` site set a cookie for another.
