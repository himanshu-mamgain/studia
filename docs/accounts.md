# Studia accounts

One account for Structura, Schemata and DSA Atlas: **sign in with GitHub once**, and your progress
follows you to every device and every app.

You sign in on the **Studia site** (`studia-hub.netlify.app` for now, `studia.dev` later). Each app
can require it: open an app signed out and it sends you to Studia's login first, then straight back
to the page you asked for. That is a switch in each app (`VITE_REQUIRE_SIGN_IN`); with it off, the
app works without an account and offers the sign-in in its top bar.

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
| App ids | `structura`, `schemata`, `dsa-atlas`, and `studia` for the Studia site's daily plan | The `app` column; the table refuses others |
| Signing out | `supabase.auth.signOut({ scope: 'local' })` | Signs out of this browser (and every subdomain sharing the cookie), not every device |

### How signing in works

The Studia site has three pages:

| Page | What it does |
| --- | --- |
| `/` | Lists the apps. Signed out, it offers "Continue with GitHub". |
| `/login?app=<id>&next=<page>` | Signs you in to Studia, then sends you to `next`. Signed in already, it sends you on at once. |
| `/logout?app=<id>&next=<page>` | Signs you out of Studia, then offers to sign in again. |

`next` must be a page of one of the apps (its Netlify site, a deploy preview of it, or its
`studia.dev` address). Studia refuses anything else, so nobody can use its login to send people to
another site.

One sign-in, step by step, while the apps are on separate `netlify.app` sites:

1. You open `https://structura-web.netlify.app/topic/kafka/` with no `studia-auth` cookie.
2. Structura sends you to `https://studia-hub.netlify.app/login?app=structura&next=https%3A%2F%2Fstructura-web.netlify.app%2Ftopic%2Fkafka%2F`.
3. You tap **Continue with GitHub**. GitHub asks once whether Studia may see your profile.
4. Back on Studia's login, Studia now has its own session (in its own `studia-auth` cookie).
5. Studia makes a second, quick trip through GitHub for Structura (no click: GitHub already knows
   you said yes). Supabase sends you to the Kafka page with a new session in the address's
   fragment: `#access_token=…&refresh_token=…`. A fragment (the part after `#`) never reaches a
   server, not even Netlify's.
6. Structura keeps that session in its own cookie and removes the fragment from the address.

The next app you open does steps 2, 5 and 6 only: Studia is already signed in, so you see no
GitHub page. Each app gets its **own** session, because Supabase rotates refresh tokens: two apps
sharing one would sign each other out.

After the move to `studia.dev`, every app reads Studia's cookie, so step 5 isn't needed: the login
just sends you back.

**Signing out** in an app signs that app out, then opens Studia's `/logout`, so Studia doesn't sign
the app straight back in. On `netlify.app`, the other apps stay signed in until you sign out there
too; on `studia.dev` they share the cookie, so one sign-out covers them all.

### How an app uses it

1. **Only load Supabase when needed.** At start-up, load the client only if the `studia-auth`
   cookie is there, or the address has `?code=` or `#access_token=` (coming back from signing in).
   This keeps the Supabase code (about 60 KB gzipped) out of every page load.
2. **No session, sign-in required:** send the learner to
   `<Studia>/login?app=<id>&next=<this page without its #fragment>` before the app starts. Don't
   send them if they're offline (Studia can't load), if the address says signing in just failed
   (`error_description`: show it instead, or they go round in a loop), or if the visitor is a
   search engine or link-preview bot.
3. **Coming back from Studia:** create the client with `auth: { detectSessionInUrl: () => false }`
   (its PKCE mode would reject `#access_token`), read the tokens from the fragment, call
   `supabase.auth.setSession({ access_token, refresh_token })`, and remove the fragment from the
   address with `history.replaceState`.
4. **Sign-in button and sign-out:** with a Studia site set, "Sign in" opens Studia's login, and
   "Sign out" calls `signOut({ scope: 'local' })`, then opens `<Studia>/logout?app=<id>&next=<home>`.
5. **Sync progress by read, merge, write.** Fetch the account's row, merge it with this device's
   progress, save the result locally and to the row. Do this after sign-in and a few seconds after
   each change. Never just overwrite the row: another device may have saved something meanwhile.
6. **Merge so nobody loses work.** Combine anything that only grows (sections read, lessons done,
   best scores). Things a learner can switch off again (a bookmark) come from whichever copy changed
   last, so each item needs an `updatedAt` time.
7. **Sync only progress.** Settings, drafts and secrets (such as Structura's notes key) stay on the
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
| The Studia site | `VITE_STUDIA_URL=https://studia-hub.netlify.app` | `NEXT_PUBLIC_STUDIA_URL=https://studia-hub.netlify.app` |
| Require sign-in | `VITE_REQUIRE_SIGN_IN=true` | `NEXT_PUBLIC_REQUIRE_SIGN_IN=true` |

The Studia site itself needs the first three, with `VITE_` names.

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
     https://studia-hub.netlify.app/**
     https://**--studia-hub.netlify.app/**
     http://localhost:5173/**
     http://localhost:3000/**
     http://localhost:5180/**
     ```

     The `**--…netlify.app` lines are each site's deploy previews. Port 5173 is Vite (Structura,
     DSA Atlas), 3000 is Next.js (Schemata) and 5180 is the Studia site. After the move, add
     `https://studia.dev/**` and `https://*.studia.dev/**`.

### 4. Put the Studia site on Netlify

1. In Netlify: **Add new project → Import an existing project → GitHub**, and pick
   `himanshu-mamgain/studia`.
2. **Project name:** `studia-hub`, so the address is `https://studia-hub.netlify.app`. (`studia` and
   `studia-web` belong to other people. If you ever rename it, use the new address in step 5 and in
   the Redirect URLs above.)
3. Leave the build settings as they are: `netlify.toml` already says how to build (`web/`, publish
   `web/dist`).
4. Before the first deploy, add two environment variables: `VITE_SUPABASE_URL` (the Project URL)
   and `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable key). Leave **"Contains secret values"
   unticked** for both: they go into the page by design, so Netlify's secrets scan would stop the
   build, and Netlify can't untick it later (delete the variable and add it again). Then deploy.
5. Open the site: it should show the three apps and **Continue with GitHub**.

### 5. Give the apps their settings

In Netlify, for each site that has the account code, open **Site configuration → Environment
variables** and add the settings from the table above. Then trigger a new deploy: the values are
read at build time.

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`: turn the account on.
- `VITE_STUDIA_URL=https://studia-hub.netlify.app`: sign in and out on the Studia site.
- `VITE_REQUIRE_SIGN_IN=true`: send signed-out visitors to the Studia login first. Leave it out to
  keep the app open to everyone.

All three apps have the account code. Each Netlify site needs its own copy of the settings:

| Site | Names |
| --- | --- |
| Structura (`structura-web`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STUDIA_URL`, `VITE_REQUIRE_SIGN_IN` |
| DSA Atlas (`dsa-atz`) | the same `VITE_` names |
| Schemata (`schemata-web`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STUDIA_URL`, `NEXT_PUBLIC_REQUIRE_SIGN_IN` |

What each app saves in its `app_progress` row:

| App (`app`) | What syncs | Stays on the device |
| --- | --- | --- |
| Structura (`structura`) | sections read, lessons, videos watched, bookmarks, quiz bests, roadmap ticks | voice, code language, notes key |
| DSA Atlas (`dsa-atlas`) | problems (notes, code, revision history), checklist ticks, goals, solve-page work | theme, code language, reminder hour, notes key |
| Schemata (`schemata`) | solved questions, answers, designs, saved queries | playground and diagram drafts, theme, datasets |

### 6. Check it

1. In a private window, open a Structura topic, such as `/topic/kafka/`.
2. You should land on Studia's login: "Sign in to continue to Structura".
3. Tap **Continue with GitHub**. After GitHub, you should be back on the Kafka page with your GitHub
   picture in the top bar, and "Progress synced just now" in its panel.
4. In Supabase's **Table Editor**, `app_progress` should have one row for you with
   `app = structura`.
5. Sign out from Structura's panel: you should see Studia's "You're signed out" page.

## Moving to studia.dev

See [domain.md](domain.md). Until then each app signs in separately (the same account, but you
sign in once per app), because browsers don't let one `netlify.app` site set a cookie for another.
