-- The Studia site's daily plan keeps its own row in app_progress (app = 'studia'): the list made
-- for each recent day, the items you tick by hand (mock interviews, revisions) and a summary of
-- older days. It lets the plan follow you to every device. Same row-level security as the apps'
-- rows: you read and write only your own. Run once in the project's SQL editor.
--
-- The first migration's check (app_progress_app_check) allowed only the three apps.

alter table public.app_progress drop constraint if exists app_progress_app_check;
alter table public.app_progress
  add constraint app_progress_app_check check (app in ('structura', 'schemata', 'dsa-atlas', 'studia'));
