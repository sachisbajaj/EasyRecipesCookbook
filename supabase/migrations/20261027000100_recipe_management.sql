begin;

-- Invoker security preserves grants and RLS. The caller supplies recipe values,
-- never an owner; auth.uid() is the only source of ownership.
create function public.save_recipe(p_recipe jsonb, p_ingredients jsonb, p_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  saved_id uuid;
  item jsonb;
  item_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save recipes.' using errcode = '42501';
  end if;
  if p_recipe is null or jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'Recipe must be an object.' using errcode = '22023';
  end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'Ingredients must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_ingredients) = 0 then
    raise exception 'Add at least one ingredient.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.recipes (user_id, title, instructions, servings, minutes, store, source_url, rating)
    values (auth.uid(), btrim(p_recipe->>'title'), btrim(p_recipe->>'instructions'),
      (p_recipe->>'servings')::integer, (p_recipe->>'minutes')::integer,
      nullif(btrim(p_recipe->>'store'), ''), nullif(btrim(p_recipe->>'source_url'), ''),
      (p_recipe->>'rating')::integer)
    returning id into saved_id;
  else
    -- UPDATE locks the recipe for the transaction, serializing ingredient replacements.
    update public.recipes set
      title = btrim(p_recipe->>'title'), instructions = btrim(p_recipe->>'instructions'),
      servings = (p_recipe->>'servings')::integer, minutes = (p_recipe->>'minutes')::integer,
      store = nullif(btrim(p_recipe->>'store'), ''), source_url = nullif(btrim(p_recipe->>'source_url'), ''),
      rating = (p_recipe->>'rating')::integer
    where id = p_id and user_id = auth.uid()
    returning id into saved_id;
    if saved_id is null then
      raise exception 'Recipe not found.' using errcode = 'P0002';
    end if;
    delete from public.ingredients where recipe_id = saved_id;
  end if;

  for item in select value from jsonb_array_elements(p_ingredients) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'name') is distinct from 'string' then
      raise exception 'Each ingredient needs a name.' using errcode = '22023';
    end if;
    insert into public.ingredients (recipe_id, name, quantity, unit, position)
    values (saved_id, btrim(item->>'name'), (item->>'quantity')::numeric,
      coalesce(nullif(btrim(item->>'unit'), ''), 'item'), item_position);
    item_position := item_position + 1;
  end loop;
  return saved_id;
end;
$$;
revoke execute on function public.save_recipe(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.save_recipe(jsonb, jsonb, uuid) to authenticated;

-- Check at transaction end so a recipe and its ingredients can be saved together.
-- This also protects the invariant if a client writes to tables directly.
create function public.require_recipe_ingredient()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'recipes' then target_id := new.id;
  else target_id := old.recipe_id;
  end if;
  if exists (select 1 from public.recipes where id = target_id)
    and not exists (select 1 from public.ingredients where recipe_id = target_id) then
    raise exception 'A recipe needs at least one ingredient.' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke execute on function public.require_recipe_ingredient() from public, anon, authenticated;
create constraint trigger recipes_require_ingredient
  after insert or update on public.recipes deferrable initially deferred
  for each row execute function public.require_recipe_ingredient();
create constraint trigger ingredients_preserve_recipe
  after delete or update on public.ingredients deferrable initially deferred
  for each row execute function public.require_recipe_ingredient();

-- A parent write serializes direct ingredient removals as well as RPC saves.
-- Updating a row (rather than only locking it) also prevents write skew at
-- repeatable-read isolation: a conflicting transaction must retry.
create function public.serialize_ingredient_removal()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.recipes set title = title where id = old.recipe_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function public.serialize_ingredient_removal() from public, anon, authenticated;
create trigger ingredients_lock_parent before delete or update on public.ingredients
  for each row execute function public.serialize_ingredient_removal();

commit;
