begin;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  instructions text not null check (instructions ~ '[^[:space:]]'),
  servings integer not null check (servings > 0),
  minutes integer check (minutes > 0),
  store text,
  source_url text check (source_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null check (name ~ '[^[:space:]]'),
  quantity numeric check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null default 'item' check (unit ~ '[^[:space:]]'),
  position integer not null default 0 check (position >= 0)
);

create index recipes_user_id_idx on public.recipes(user_id);
create index ingredients_recipe_id_position_idx on public.ingredients(recipe_id, position);

create function public.touch_recipe_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_recipe_updated_at() from public, anon, authenticated;
create trigger recipes_updated_at before update on public.recipes
for each row execute function public.touch_recipe_updated_at();

alter table public.users enable row level security;
alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;

-- Explicit grants avoid depending on project default privileges.
revoke all on public.users, public.recipes, public.ingredients from public, anon, authenticated;
grant select on public.users, public.recipes, public.ingredients to authenticated;
grant insert (id, display_name) on public.users to authenticated;
grant update (display_name) on public.users to authenticated;
grant insert (id, user_id, title, instructions, servings, minutes, store, source_url, rating)
  on public.recipes to authenticated;
grant update (title, instructions, servings, minutes, store, source_url, rating)
  on public.recipes to authenticated;
grant delete on public.recipes to authenticated;
grant insert (id, recipe_id, name, quantity, unit, position) on public.ingredients to authenticated;
grant update (recipe_id, name, quantity, unit, position) on public.ingredients to authenticated;
grant delete on public.ingredients to authenticated;
grant all on public.users, public.recipes, public.ingredients to service_role;

create policy users_read_own on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_insert_own on public.users for insert to authenticated
  with check (id = (select auth.uid()));
create policy users_update_own on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy recipes_own on public.recipes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ingredients_own on public.ingredients for all to authenticated
  using (exists (select 1 from public.recipes r
    where r.id = ingredients.recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r
    where r.id = ingredients.recipe_id and r.user_id = (select auth.uid())));

commit;
