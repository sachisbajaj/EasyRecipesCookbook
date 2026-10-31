begin;
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  planned_date date not null check (planned_date between date '0001-01-01' and date '9999-12-31'),
  servings integer not null check (servings > 0)
);
create index meal_plan_owner_date_idx on public.meal_plan_entries(user_id, planned_date, id);
create index meal_plan_recipe_idx on public.meal_plan_entries(recipe_id);
alter table public.meal_plan_entries enable row level security;
revoke all on public.meal_plan_entries from public, anon, authenticated;
grant select, delete on public.meal_plan_entries to authenticated;
grant insert(user_id, recipe_id, planned_date, servings) on public.meal_plan_entries to authenticated;
grant update(recipe_id, planned_date, servings) on public.meal_plan_entries to authenticated;
grant all on public.meal_plan_entries to service_role;
create policy meal_plan_owner on public.meal_plan_entries for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())));
-- Repeated recipes and multiple entries on a date are intentional.
commit;
