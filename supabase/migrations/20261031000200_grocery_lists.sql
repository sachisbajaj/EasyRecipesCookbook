begin;
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null check (week_start between date '0001-01-01' and date '9999-12-25' and extract(isodow from week_start)=1),
  name text not null check (name ~ '[^[:space:]]'),
  quantity numeric check (quantity > 0 and quantity < 'Infinity'::numeric),
  unit text not null check (unit ~ '[^[:space:]]'),
  checked boolean not null default false,
  position integer not null default 0 check (position >= 0)
);
create index grocery_owner_week_idx on public.grocery_items(user_id, week_start, position, id);
alter table public.grocery_items enable row level security;
revoke all on public.grocery_items from public, anon, authenticated;
grant select, delete on public.grocery_items to authenticated;
grant insert(user_id, week_start, name, quantity, unit, checked, position) on public.grocery_items to authenticated;
grant update(name, quantity, unit, checked, position) on public.grocery_items to authenticated;
grant all on public.grocery_items to service_role;
create policy grocery_owner on public.grocery_items for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.generate_grocery_list(p_week date) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sign in to generate a list' using errcode='42501'; end if;
  if p_week is null or not (p_week between date '0001-01-01' and date '9999-12-25') or extract(isodow from p_week)<>1 then
    raise exception 'Choose a complete Monday-based week' using errcode='22023';
  end if;
  -- Repeated generation for one owner/week cannot interleave delete and insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || p_week::text, 0));
  delete from public.grocery_items where user_id=v_owner and week_start=p_week;
  insert into public.grocery_items(user_id,week_start,name,quantity,unit,position)
  with scaled as (
    select lower(btrim(regexp_replace(i.name, '\s+', ' ', 'g'))) as name_key,
      lower(btrim(regexp_replace(i.unit, '\s+', ' ', 'g'))) as unit_key,
      btrim(regexp_replace(i.name, '\s+', ' ', 'g')) as label,
      i.quantity * m.servings::numeric / r.servings as amount,
      i.quantity is null as unknown
    from public.meal_plan_entries m
    join public.recipes r on r.id=m.recipe_id and r.user_id=v_owner
    join public.ingredients i on i.recipe_id=r.id
    where m.user_id=v_owner and m.planned_date between p_week and p_week+6
  ), combined as (
    select name_key,unit_key,unknown,min(label) as label,sum(amount) as amount
    from scaled group by name_key,unit_key,unknown
  )
  select v_owner,p_week,label,amount,unit_key,
    (row_number() over(order by name_key,unit_key,unknown)-1)::integer
  from combined;
end;
$$;
revoke all on function public.generate_grocery_list(date) from public, anon;
grant execute on function public.generate_grocery_list(date) to authenticated;
commit;
