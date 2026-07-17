-- Who's to Say Studio Participant Profile review and safe publishing.
-- Additive Phase 4 migration. Apply studio-auth-schema.sql and
-- studio-participant-profile-schema.sql first.

begin;

-- Role activity is represented by the continued existence of the global role.
-- Authorization is always derived from auth.uid(), never from email identity.
create or replace function public.is_studio_staff_reviewer()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles roles
    where roles.user_id = auth.uid()
      and roles.role in ('superadmin', 'staff')
  );
$$;

create or replace function public.profile_review_note_is_safe(value text, required boolean default false)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when value is null then not required
    when required and btrim(value) = '' then false
    else char_length(btrim(value)) between 1 and 2000
      and value !~ '<[^>]*>'
      and value !~* '(javascript:|data:text/html)'
  end;
$$;

drop function if exists public.list_submitted_participant_profile_reviews();
create function public.list_submitted_participant_profile_reviews()
returns table (
  review_request_id uuid, participant_id uuid, participant_name text,
  registry_id text, revision_id uuid, revision_number integer,
  request_status text, revision_status text, submitted_at timestamptz,
  submitted_by_name text, completeness jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_studio_staff_reviewer() then
    raise exception 'Staff review access denied' using errcode = '42501';
  end if;
  return query
    select requests.id, participants.id, participants.display_name,
      participants.registry_id, revisions.id, revisions.revision_number,
      requests.status, revisions.revision_status,
      coalesce(revisions.submitted_at, requests.created_at),
      coalesce(profiles.display_name, 'Studio user'),
      jsonb_build_object(
        'identity', coalesce(nullif(btrim(revisions.public_identity->>'displayName'), ''), '') <> '',
        'contactEnabled', coalesce((revisions.contact_profile->>'enabled')::boolean, false),
        'socialCount', jsonb_array_length(revisions.social_profiles),
        'visibleFieldCount',
          (coalesce((revisions.visibility->>'showLocation')::boolean, false))::int +
          (coalesce((revisions.visibility->>'showEmail')::boolean, false))::int +
          (coalesce((revisions.visibility->>'showPhone')::boolean, false))::int +
          (coalesce((revisions.visibility->>'showSocialProfiles')::boolean, false))::int
      )
    from public.review_requests requests
    join public.participants participants on participants.id = requests.participant_id
    join public.participant_profile_revisions revisions on revisions.id = requests.revision_id
    left join public.profiles profiles on profiles.user_id = requests.submitted_by
    where requests.entity_type = 'participant_profile'
      and requests.status in ('pending', 'changes-requested', 'approved')
    order by case requests.status when 'pending' then 0 when 'changes-requested' then 1 else 2 end,
      requests.created_at desc;
end;
$$;

drop function if exists public.get_participant_profile_review(uuid);
create function public.get_participant_profile_review(target_review_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare result jsonb;
begin
  if not public.is_studio_staff_reviewer() then
    raise exception 'Staff review access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'request', jsonb_build_object(
      'id', requests.id, 'status', requests.status, 'createdAt', requests.created_at,
      'updatedAt', requests.updated_at, 'notes', requests.notes
    ),
    'participant', jsonb_build_object(
      'displayName', participants.display_name, 'registryId', participants.registry_id
    ),
    'revision', jsonb_build_object(
      'id', revisions.id, 'revisionNumber', revisions.revision_number,
      'revisionStatus', revisions.revision_status, 'publicIdentity', revisions.public_identity,
      'contactProfile', revisions.contact_profile, 'socialProfiles', revisions.social_profiles,
      'visibility', revisions.visibility, 'consent', revisions.consent,
      'createdAt', revisions.created_at, 'submittedAt', revisions.submitted_at,
      'reviewedAt', revisions.reviewed_at
    ),
    'submitter', jsonb_build_object('displayName', coalesce(profiles.display_name, 'Studio user'))
  ) into result
  from public.review_requests requests
  join public.participants participants on participants.id = requests.participant_id
  join public.participant_profile_revisions revisions on revisions.id = requests.revision_id
  left join public.profiles profiles on profiles.user_id = requests.submitted_by
  where requests.id = target_review_request_id
    and requests.entity_type = 'participant_profile';
  if result is null then raise exception 'Review request not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.request_participant_profile_changes(
  target_review_request_id uuid, review_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare request_record public.review_requests%rowtype;
declare revision_record public.participant_profile_revisions%rowtype;
declare clean_notes text := btrim(review_notes);
begin
  if not public.is_studio_staff_reviewer() then
    raise exception 'Staff review access denied' using errcode = '42501';
  end if;
  if not public.profile_review_note_is_safe(clean_notes, true) then
    raise exception 'Review notes must be plain text between 1 and 2000 characters' using errcode = '22023';
  end if;
  select requests.* into request_record from public.review_requests requests
    where requests.id = target_review_request_id for update;
  select revisions.* into revision_record from public.participant_profile_revisions revisions
    where revisions.id = request_record.revision_id for update;
  if request_record.id is null or request_record.entity_type <> 'participant_profile'
    or request_record.status <> 'pending' or revision_record.revision_status <> 'submitted' then
    raise exception 'Review request is not open' using errcode = '55000';
  end if;
  update public.participant_profile_revisions
    set revision_status = 'changes-requested', reviewed_by = auth.uid(),
      reviewed_at = now(), review_notes = clean_notes, updated_at = now()
    where id = revision_record.id;
  update public.review_requests
    set status = 'changes-requested', reviewed_by = auth.uid(), notes = clean_notes, updated_at = now()
    where id = request_record.id;
  update public.participant_profiles set lifecycle_status = 'draft', updated_at = now()
    where id = revision_record.profile_id;
  insert into public.audit_events(actor_user_id, participant_id, event_type, entity_type, entity_id, metadata)
    values (auth.uid(), request_record.participant_id, 'participant_profile_changes_requested',
      'participant_profile_revision', revision_record.id::text,
      jsonb_build_object('revisionNumber', revision_record.revision_number,
        'reviewRequestId', request_record.id, 'transition', 'submitted:changes-requested'));
  return jsonb_build_object('reviewRequestId', request_record.id, 'status', 'changes-requested');
end;
$$;

create or replace function public.approve_participant_profile_revision(
  target_review_request_id uuid, review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare request_record public.review_requests%rowtype;
declare revision_record public.participant_profile_revisions%rowtype;
declare previous_published uuid;
declare clean_notes text := nullif(btrim(review_notes), '');
begin
  if not public.is_studio_staff_reviewer() then
    raise exception 'Staff review access denied' using errcode = '42501';
  end if;
  if not public.profile_review_note_is_safe(clean_notes, false) then
    raise exception 'Review notes must be plain text and at most 2000 characters' using errcode = '22023';
  end if;
  select requests.* into request_record from public.review_requests requests
    where requests.id = target_review_request_id for update;
  select revisions.* into revision_record from public.participant_profile_revisions revisions
    where revisions.id = request_record.revision_id for update;
  if request_record.id is null or request_record.entity_type <> 'participant_profile'
    or request_record.status <> 'pending' or revision_record.revision_status <> 'submitted' then
    raise exception 'Review request is not an active submitted revision' using errcode = '55000';
  end if;
  if revision_record.created_by = auth.uid() or request_record.submitted_by = auth.uid() then
    raise exception 'A submitter cannot approve their own revision' using errcode = '42501';
  end if;
  if coalesce((revision_record.consent->>'participantApproved')::boolean, false) is not true
    or coalesce((revision_record.consent->>'reviewRequired')::boolean, true) is not true then
    raise exception 'Participant consent and staff review are required' using errcode = '23514';
  end if;
  if coalesce(nullif(btrim(revision_record.public_identity->>'displayName'), ''),
      nullif(btrim(revision_record.public_identity->>'professionalName'), '')) is null
    or not public.participant_profile_payload_is_safe(
      revision_record.public_identity, revision_record.contact_profile,
      revision_record.social_profiles, revision_record.visibility, revision_record.consent) then
    raise exception 'Participant Profile validation failed' using errcode = '23514';
  end if;
  select profiles.published_revision_id into previous_published
    from public.participant_profiles profiles where profiles.id = revision_record.profile_id for update;
  update public.participant_profile_revisions
    set revision_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      review_notes = clean_notes, updated_at = now()
    where id = revision_record.id;
  update public.review_requests
    set status = 'approved', reviewed_by = auth.uid(), notes = clean_notes, updated_at = now()
    where id = request_record.id;
  update public.participant_profiles
    set lifecycle_status = 'approved', published_revision_id = revision_record.id, updated_at = now()
    where id = revision_record.profile_id;
  insert into public.audit_events(actor_user_id, participant_id, event_type, entity_type, entity_id, metadata)
  values
    (auth.uid(), request_record.participant_id, 'participant_profile_approved',
      'participant_profile_revision', revision_record.id::text,
      jsonb_build_object('revisionNumber', revision_record.revision_number,
        'reviewRequestId', request_record.id, 'transition', 'submitted:approved')),
    (auth.uid(), request_record.participant_id, 'participant_profile_published_revision_changed',
      'participant_profile', revision_record.profile_id::text,
      jsonb_build_object('revisionNumber', revision_record.revision_number,
        'reviewRequestId', request_record.id, 'transition',
        case when previous_published is null then 'unpublished:published' else 'published:published' end));
  return jsonb_build_object('reviewRequestId', request_record.id, 'status', 'approved',
    'revisionNumber', revision_record.revision_number);
end;
$$;

drop function if exists public.get_public_participant_profile(text);
create function public.get_public_participant_profile(target_registry_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'displayName', nullif(revisions.public_identity->>'displayName', ''),
    'professionalName', nullif(revisions.public_identity->>'professionalName', ''),
    'pronouns', nullif(revisions.public_identity->>'pronouns', ''),
    'locationText', case when coalesce((revisions.visibility->>'showLocation')::boolean, false)
      then nullif(revisions.public_identity->>'locationText', '') end,
    'contact', case when coalesce((revisions.contact_profile->>'enabled')::boolean, false) then
      jsonb_strip_nulls(jsonb_build_object(
        'email', case when coalesce((revisions.visibility->>'showEmail')::boolean, false)
          then nullif(revisions.contact_profile->>'publicEmail', '') end,
        'phone', case when coalesce((revisions.visibility->>'showPhone')::boolean, false)
          then nullif(revisions.contact_profile->>'publicPhoneDisplay', '') end,
        'availabilityText', nullif(revisions.contact_profile->>'availabilityText', ''),
        'responseTimeText', nullif(revisions.contact_profile->>'responseTimeText', '')
      )) end,
    'socialProfiles', case when coalesce((revisions.visibility->>'showSocialProfiles')::boolean, false)
      then coalesce((select jsonb_agg(jsonb_build_object(
        'platform', social->>'platform', 'handle', social->>'handle'))
        from jsonb_array_elements(revisions.social_profiles) social
        where coalesce((social->>'enabled')::boolean, false)
          and social->>'platform' in ('instagram','youtube','facebook','tiktok','linkedin','x')
          and social->>'handle' !~* '(https?://|www\.|[/?#])'), '[]'::jsonb)
      else '[]'::jsonb end
  ))
  from public.participants participants
  join public.participant_profiles profiles on profiles.participant_id = participants.id
  join public.participant_profile_revisions revisions
    on revisions.id = profiles.published_revision_id and revisions.profile_id = profiles.id
  where participants.registry_id = target_registry_id
    and revisions.revision_status = 'approved'
    and public.participant_profile_payload_is_safe(
      revisions.public_identity, revisions.contact_profile, revisions.social_profiles,
      revisions.visibility, revisions.consent)
  limit 1;
$$;

-- Approved revisions are immutable even for staff. Draft edits retain Phase 3 RLS.
drop policy if exists "profile_revisions_staff_manage" on public.participant_profile_revisions;
create policy "profile_revisions_staff_manage"
  on public.participant_profile_revisions for update to authenticated
  using (public.is_studio_staff_reviewer() and revision_status <> 'approved')
  with check (public.is_studio_staff_reviewer());

-- Phase 3 submission audit was intentionally deferred; replace the RPC to add it.
create or replace function public.record_participant_profile_submission(
  target_participant_id uuid, target_revision_id uuid, target_revision_number integer,
  target_review_request_id uuid
)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.audit_events(actor_user_id, participant_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), target_participant_id, 'participant_profile_submitted',
    'participant_profile_revision', target_revision_id::text,
    jsonb_build_object('revisionNumber', target_revision_number,
      'reviewRequestId', target_review_request_id, 'transition', 'draft:submitted'));
end;
$$;

-- Refresh the Phase 3 submission RPC so submission and its audit event are
-- committed together. The return signature is unchanged.
create or replace function public.submit_my_participant_profile_revision(target_revision_id uuid)
returns setof public.participant_profile_revisions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_revision public.participant_profile_revisions%rowtype;
  target_participant_id uuid;
  target_review_request_id uuid;
begin
  select revisions.* into target_revision
    from public.participant_profile_revisions revisions
    where revisions.id = target_revision_id for update of revisions;
  if target_revision.id is not null then
    select profiles.participant_id into target_participant_id
      from public.participant_profiles profiles where profiles.id = target_revision.profile_id;
  end if;
  if target_revision.id is null or target_revision.created_by <> auth.uid()
    or target_revision.revision_status <> 'draft'
    or not public.has_participant_profile_edit_access(target_participant_id)
    or not exists (
      select 1 from public.participant_user_access access
      where access.participant_id = target_participant_id and access.user_id = auth.uid()
        and access.can_submit_review and access.revoked_at is null
        and access.starts_at <= now()
        and (access.expires_at is null or access.expires_at > now())
    ) then
    raise exception 'Profile revision cannot be submitted' using errcode = '42501';
  end if;
  update public.participant_profile_revisions
    set revision_status = 'submitted', submitted_at = now(), updated_at = now()
    where id = target_revision_id returning * into target_revision;
  insert into public.review_requests(participant_id, entity_type, revision_id, submitted_by)
    values (target_participant_id, 'participant_profile', target_revision_id, auth.uid())
    on conflict on constraint review_requests_entity_type_revision_id_key do update
      set status = 'pending', submitted_by = excluded.submitted_by, reviewed_by = null,
        notes = null, updated_at = now()
    returning id into target_review_request_id;
  update public.participant_profiles set lifecycle_status = 'in-review', updated_at = now()
    where id = target_revision.profile_id;
  insert into public.audit_events(actor_user_id, participant_id, event_type, entity_type, entity_id, metadata)
    values (auth.uid(), target_participant_id, 'participant_profile_submitted',
      'participant_profile_revision', target_revision.id::text,
      jsonb_build_object('revisionNumber', target_revision.revision_number,
        'reviewRequestId', target_review_request_id, 'transition', 'draft:submitted'));
  return next target_revision;
end;
$$;

revoke all on function public.is_studio_staff_reviewer() from public;
revoke all on function public.profile_review_note_is_safe(text, boolean) from public;
revoke all on function public.list_submitted_participant_profile_reviews() from public;
revoke all on function public.get_participant_profile_review(uuid) from public;
revoke all on function public.request_participant_profile_changes(uuid, text) from public;
revoke all on function public.approve_participant_profile_revision(uuid, text) from public;
revoke all on function public.get_public_participant_profile(text) from public;
revoke all on function public.record_participant_profile_submission(uuid, uuid, integer, uuid) from public;
grant execute on function public.is_studio_staff_reviewer() to authenticated;
grant execute on function public.list_submitted_participant_profile_reviews() to authenticated;
grant execute on function public.get_participant_profile_review(uuid) to authenticated;
grant execute on function public.request_participant_profile_changes(uuid, text) to authenticated;
grant execute on function public.approve_participant_profile_revision(uuid, text) to authenticated;
grant execute on function public.get_public_participant_profile(text) to anon, authenticated;
grant execute on function public.submit_my_participant_profile_revision(uuid) to authenticated;

commit;
