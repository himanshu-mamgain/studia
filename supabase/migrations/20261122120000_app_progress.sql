-- Studia accounts: one progress row per user per app (Structura, Schemata, DSA Atlas).
-- One Supabase project serves all three apps. Run this once in the project's SQL editor
-- (or with `supabase db push`). Each app reads and writes only the signed-in user's own
-- row; row-level security enforces that, so the publishable key in the browser can't
-- reach anyone else's data.

create table if not exists public.app_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('structura', 'schemata', 'dsa-atlas')),
  -- The app's own progress object, as it keeps it in localStorage. Capped at 500 KB.
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) < 512000),
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.app_progress enable row level security;

create policy "Users read their own progress" on public.app_progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own progress" on public.app_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update their own progress" on public.app_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete their own progress" on public.app_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-in users only; visitors who aren't signed in get nothing.
grant select, insert, update, delete on public.app_progress to authenticated;
revoke all on public.app_progress from anon;
