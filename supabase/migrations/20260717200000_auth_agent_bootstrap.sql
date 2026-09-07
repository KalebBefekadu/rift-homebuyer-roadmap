-- On agent signup, seed agents_settings (security definer bypasses RLS).
-- Role for routing still comes from user_metadata / agents_settings presence in app code.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', '') = 'admin' then
    insert into public.agents_settings (agent_id, display_name, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', ''),
      coalesce(new.email, '')
    )
    on conflict (agent_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
