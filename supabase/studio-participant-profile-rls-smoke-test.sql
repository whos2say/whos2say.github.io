-- Transaction-based Studio Participant Profile smoke test.
-- Run only in a disposable/non-production Supabase project after applying:
-- 1. supabase/studio-auth-schema.sql
-- 2. supabase/studio-participant-profile-schema.sql
-- Every fixture is rolled back.

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'Studio Profile RLS assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-owner@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-contributor@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'profile-admin@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'profile-other@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());

insert into public.participants (id, registry_id, slug, display_name, status) values
  ('21000000-0000-4000-8000-000000000001', 'participant-djr', 'djr', 'DJR Photography', 'active'),
  ('21000000-0000-4000-8000-000000000002', 'participant-cody', 'cody', 'Cody draft', 'draft');

insert into public.participant_user_access (
  participant_id, user_id, access_role, can_edit_profile, can_submit_review
) values
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'participant_owner', true, true),
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'contributor', false, false),
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 'participant_admin', true, true);

-- Anonymous has no profile table grants.
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.participant_profiles', 'select')
  and not has_table_privilege('anon', 'public.participant_profile_revisions', 'select')
  and not has_table_privilege('anon', 'public.review_requests', 'select'),
  'anonymous must not have Participant Profile table read privileges'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","email":"profile-owner@example.invalid","role":"authenticated"}',
  true
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.participants where registry_id = 'participant-djr'),
  'assigned owner should see only DJR'
);
select public.create_my_participant_profile_draft('21000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(
  (select count(*) = 1 from public.participant_profile_revisions),
  'owner should create a private draft'
);

do $$
begin
  begin
    update public.participant_profile_revisions
      set public_identity = '{"displayName":"<script>alert(1)</script>"}'::jsonb;
    raise exception 'raw HTML profile payload should be rejected';
  exception when check_violation then null;
  end;
end;
$$;

select public.submit_my_participant_profile_revision(
  (select id from public.participant_profile_revisions limit 1)
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.review_requests where status = 'pending'),
  'submit for review should create one review request'
);

update public.participant_profile_revisions
  set public_identity = '{"displayName":"Silent overwrite"}'::jsonb;
select pg_temp.assert_true(
  (select public_identity->>'displayName' from public.participant_profile_revisions limit 1) <> 'Silent overwrite',
  'submitted revisions must not be silently overwritten by participant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000002","email":"profile-contributor@example.invalid","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.create_my_participant_profile_draft('21000000-0000-4000-8000-000000000001');
    raise exception 'contributor must not create profile draft';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000003","email":"profile-admin@example.invalid","role":"authenticated"}',
  true
);
select public.create_my_participant_profile_draft('21000000-0000-4000-8000-000000000001');

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000004","email":"profile-other@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.participant_profiles),
  'unassigned user must not read private profiles'
);
do $$
begin
  begin
    perform public.create_my_participant_profile_draft('21000000-0000-4000-8000-000000000002');
    raise exception 'unassigned user must not create Cody profile';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
