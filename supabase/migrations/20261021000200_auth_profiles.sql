begin;

-- The auth service owns account creation. A fixed search path prevents object
-- substitution in this privileged trigger; clients cannot execute it directly.
create function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_user_profile();

-- Preserve existing profiles and fill gaps for pre-existing accounts.
insert into public.users (id)
select id from auth.users
on conflict (id) do nothing;

-- Profiles are provisioned by Auth, not manually from the browser.
revoke insert (id, display_name) on public.users from authenticated;
drop policy users_insert_own on public.users;

commit;
