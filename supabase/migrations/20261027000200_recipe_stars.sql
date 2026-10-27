begin;
create table public.stars (
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
-- The composite PK supports each user's stars; this index supports recipe cascades.
create index stars_recipe_id_idx on public.stars(recipe_id);
alter table public.stars enable row level security;
revoke all on public.stars from public, anon, authenticated;
grant select, delete on public.stars to authenticated;
grant insert (user_id, recipe_id) on public.stars to authenticated;
grant all on public.stars to service_role;
create policy stars_read_own on public.stars for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())
  ));
create policy stars_insert_own on public.stars for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())
  ));
create policy stars_delete_own on public.stars for delete to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())
  ));
-- No client UPDATE grant or policy: ownership and parent cannot be changed.
commit;
