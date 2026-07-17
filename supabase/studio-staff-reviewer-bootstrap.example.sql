-- Replace the placeholder only in the Supabase SQL Editor. Never commit email values.
do $$
declare target_user_id uuid;
begin
  if 'REPLACE_WITH_STAFF_EMAIL' = 'REPLACE_WITH_STAFF_EMAIL' then
    raise exception 'Replace REPLACE_WITH_STAFF_EMAIL before running this bootstrap';
  end if;
  select users.id into target_user_id from auth.users users
    where lower(users.email) = lower('REPLACE_WITH_STAFF_EMAIL');
  if target_user_id is null then raise exception 'No existing auth.users row matches the staff email'; end if;
  insert into public.user_roles(user_id, role)
  values (target_user_id, 'staff')
  on conflict (user_id, role) do nothing;
end;
$$;
