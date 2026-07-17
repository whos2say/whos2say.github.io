-- DJR Participant Profile bootstrap example.
-- Apply studio-auth-schema.sql and studio-participant-profile-schema.sql first.
-- Replace placeholders only in the Supabase SQL Editor. Never commit private values.

begin;

do $$
begin
  if 'REPLACE_WITH_PUBLIC_EMAIL' = 'REPLACE_WITH_PUBLIC_EMAIL'
    or 'REPLACE_WITH_PUBLIC_PHONE' = 'REPLACE_WITH_PUBLIC_PHONE' then
    raise notice 'Placeholders retained; contact values will be seeded as blank.';
  end if;
end;
$$;

with target_participant as (
  select id from public.participants where registry_id = 'participant-djr'
)
insert into public.participant_profiles (participant_id, lifecycle_status)
select id, 'draft' from target_participant
on conflict on constraint participant_profiles_participant_id_key do nothing;

with target_profile as (
  select profiles.id
  from public.participant_profiles profiles
  join public.participants participants on participants.id = profiles.participant_id
  where participants.registry_id = 'participant-djr'
)
insert into public.participant_profile_revisions (
  profile_id, revision_number, revision_status, public_identity,
  contact_profile, social_profiles, visibility, consent, created_by
)
select
  target_profile.id,
  1,
  'draft',
  '{"displayName":"David J. Richards","professionalName":"DJR Photography","pronouns":"","locationText":""}'::jsonb,
  jsonb_build_object(
    'enabled', false,
    'publicEmail', case when 'REPLACE_WITH_PUBLIC_EMAIL' = 'REPLACE_WITH_PUBLIC_EMAIL' then '' else 'REPLACE_WITH_PUBLIC_EMAIL' end,
    'publicPhoneDisplay', case when 'REPLACE_WITH_PUBLIC_PHONE' = 'REPLACE_WITH_PUBLIC_PHONE' then '' else 'REPLACE_WITH_PUBLIC_PHONE' end,
    'preferredContactMethod', 'contact-form',
    'availabilityText', '',
    'responseTimeText', ''
  ),
  '[]'::jsonb,
  '{"showLocation":false,"showEmail":false,"showPhone":false,"showSocialProfiles":false}'::jsonb,
  '{"participantApproved":false,"approvedAt":null,"approvedByUserId":null,"reviewRequired":true}'::jsonb,
  (select user_id from public.participant_user_access access
    join public.participants participants on participants.id = access.participant_id
    where participants.registry_id = 'participant-djr'
      and access.access_role in ('participant_owner', 'participant_admin')
      and access.can_edit_profile
      and access.revoked_at is null
    order by access.created_at limit 1)
from target_profile
where exists (
  select 1 from public.participant_user_access access
  join public.participants participants on participants.id = access.participant_id
  where participants.registry_id = 'participant-djr'
    and access.access_role in ('participant_owner', 'participant_admin')
    and access.can_edit_profile
    and access.revoked_at is null
)
on conflict on constraint participant_profile_revisions_profile_id_revision_number_key do nothing;

commit;
