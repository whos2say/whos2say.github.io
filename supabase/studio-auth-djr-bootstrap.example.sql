-- DJR Studio bootstrap example.
-- 1. Apply supabase/studio-auth-schema.sql first.
-- 2. Replace REPLACE_WITH_PARTICIPANT_EMAIL locally in Supabase SQL Editor.
-- 3. Run this file, then sign in to Studio with that exact verified Google email.
-- This file contains no secret and is safe to run repeatedly.

begin;

do $$
begin
  if lower('REPLACE_WITH_PARTICIPANT_EMAIL') = lower('replace_with_participant_email') then
    raise exception 'Replace REPLACE_WITH_PARTICIPANT_EMAIL before running the DJR bootstrap.';
  end if;
end;
$$;

insert into public.participants (registry_id, slug, display_name, status)
values ('participant-djr', 'djr', 'DJR Photography', 'active')
on conflict (registry_id) do update
  set slug = excluded.slug,
      display_name = excluded.display_name,
      status = excluded.status,
      updated_at = now();

with target_participant as (
  select id from public.participants where registry_id = 'participant-djr'
),
assigned_albums(album_id) as (
  values
    ('fe027096-7084-4f96-974a-315b98b484b2'::uuid),
    ('49d8c743-75e3-4371-9547-5a645327e81f'::uuid),
    ('8d183fdd-8ca4-4c2f-8537-d5a7ce7f5054'::uuid),
    ('890289d8-897a-4c0d-b753-49da84c93f84'::uuid),
    ('3918b612-b15a-4757-bab4-0051795277d1'::uuid),
    ('c30fafb8-c49c-4380-81ce-9837ae433415'::uuid),
    ('f4c8061b-fff1-43c8-8504-9c649ca05af0'::uuid)
)
insert into public.participant_album_access (participant_id, album_id, access_level)
select target_participant.id, assigned_albums.album_id, 'select'
from target_participant
cross join assigned_albums
on conflict (participant_id, album_id) do update
  set access_level = excluded.access_level;

insert into public.participant_access_invites (
  email_normalized,
  participant_id,
  access_role,
  can_edit_page,
  can_edit_brand_kit,
  can_select_media,
  can_edit_services,
  can_submit_review,
  revoked_at
)
select
  lower(btrim('REPLACE_WITH_PARTICIPANT_EMAIL')),
  participants.id,
  'participant_owner',
  false,
  false,
  true,
  false,
  false,
  null
from public.participants participants
where participants.registry_id = 'participant-djr'
on conflict (email_normalized, participant_id, access_role) do update
  set can_edit_page = excluded.can_edit_page,
      can_edit_brand_kit = excluded.can_edit_brand_kit,
      can_select_media = excluded.can_select_media,
      can_edit_services = excluded.can_edit_services,
      can_submit_review = excluded.can_submit_review,
      revoked_at = null;

commit;
