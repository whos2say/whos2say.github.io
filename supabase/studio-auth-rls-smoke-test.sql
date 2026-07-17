-- Transaction-based Studio authorization smoke test.
-- Run only in a disposable/non-production Supabase project after applying
-- studio-auth-schema.sql. Every fixture is rolled back.

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'Studio RLS assertion failed: %', message;
  end if;
end;
$$;

-- Stable test identities.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-studio-test@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other-studio-test@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin-studio-test@example.invalid', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());

insert into public.participants (id, registry_id, slug, display_name, status) values
  ('20000000-0000-4000-8000-000000000001', 'participant-djr', 'djr', 'DJR Photography', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'participant-cody', 'cody', 'Cody draft', 'draft');

insert into public.participant_user_access (
  participant_id, user_id, access_role, can_select_media
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'participant_owner',
  true
);

insert into public.participant_album_access (participant_id, album_id, access_level) values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'select'),
  ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'select');

insert into public.user_roles (user_id, role) values
  ('10000000-0000-4000-8000-000000000003', 'superadmin');

insert into public.participant_access_invites (
  email_normalized, participant_id, access_role, can_select_media
) values (
  'owner-studio-test@example.invalid',
  '20000000-0000-4000-8000-000000000001',
  'participant_owner',
  true
);

-- Anonymous has no table-level read grants.
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.participants', 'select')
  and not has_table_privilege('anon', 'public.participant_user_access', 'select')
  and not has_table_privilege('anon', 'public.participant_access_invites', 'select'),
  'anonymous must not have Studio table read privileges'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"owner-studio-test@example.invalid","role":"authenticated"}',
  true
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.participants where registry_id = 'participant-djr'),
  'assigned owner must read DJR'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.participants where registry_id = 'participant-cody'),
  'assigned owner must not read Cody'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.participant_album_access),
  'assigned owner must read only DJR album access'
);

-- Participant cannot self-create authority or audit events.
do $$
begin
  begin
    insert into public.user_roles (user_id, role)
    values ('10000000-0000-4000-8000-000000000001', 'superadmin');
    raise exception 'participant created a global role';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.participant_user_access (participant_id, user_id, access_role)
    values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'participant_owner');
    raise exception 'participant created participant access';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.participant_access_invites (email_normalized, participant_id, access_role)
    values ('owner-studio-test@example.invalid', '20000000-0000-4000-8000-000000000002', 'participant_owner');
    raise exception 'participant created an invitation';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.audit_events (actor_user_id, event_type, entity_type)
    values ('10000000-0000-4000-8000-000000000001', 'unsafe', 'test');
    raise exception 'participant inserted an audit event';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- RLS-filtered update cannot revoke an invisible invitation.
update public.participant_access_invites set revoked_at = now();
reset role;
select pg_temp.assert_true(
  (select bool_and(revoked_at is null) from public.participant_access_invites),
  'participant must not revoke invitations'
);

-- Revocation immediately blocks participant and album reads.
update public.participant_user_access
set revoked_at = now()
where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"owner-studio-test@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true((select count(*) = 0 from public.participants), 'revoked access must block participant reads');
select pg_temp.assert_true((select count(*) = 0 from public.participant_album_access), 'revoked access must block album reads');

-- Expiration also blocks reads.
reset role;
update public.participant_user_access
set revoked_at = null, starts_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"owner-studio-test@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true((select count(*) = 0 from public.participants), 'expired access must block participant reads');

-- A different verified email cannot claim the owner's invitation.
reset role;
update public.participant_user_access
set revoked_at = null, starts_at = now(), expires_at = null
where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","email":"other-studio-test@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.claim_my_participant_access_invites()),
  'invite cannot be claimed by a different email'
);

-- Matching owner claim is idempotent and does not add a second/escalated role.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"owner-studio-test@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.claim_my_participant_access_invites()),
  'matching verified email must claim its active invitation'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.claim_my_participant_access_invites()),
  'repeated matching claim must be idempotent'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.participant_user_access where access_role = 'participant_owner'),
  'invite reuse must not create extra or escalated access rows'
);

-- SuperAdmin behavior is controlled by user_roles and remains separate.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","email":"admin-studio-test@example.invalid","role":"authenticated"}',
  true
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.participants),
  'SuperAdmin must read participants through the separate global role'
);

rollback;
