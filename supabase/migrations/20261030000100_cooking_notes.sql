begin;
create table public.cooking_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooked_on date not null check (cooked_on between date '0001-01-01' and date '9999-12-31'),
  what_worked text,
  next_time text,
  created_at timestamptz not null default now(),
  constraint cooking_notes_content check (
    coalesce(what_worked, '') ~ '[^[:space:]]' or coalesce(next_time, '') ~ '[^[:space:]]'
  )
);
create index cooking_notes_recipe_date_idx on public.cooking_notes(recipe_id, cooked_on desc, created_at desc, id desc);
alter table public.cooking_notes enable row level security;
revoke all on public.cooking_notes from public, anon, authenticated;
grant select, delete on public.cooking_notes to authenticated;
grant insert (recipe_id, cooked_on, what_worked, next_time) on public.cooking_notes to authenticated;
grant update (cooked_on, what_worked, next_time) on public.cooking_notes to authenticated;
grant all on public.cooking_notes to service_role;
create policy cooking_notes_owner on public.cooking_notes for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
-- Column grants keep id, recipe_id, and created_at immutable for clients.
commit;
