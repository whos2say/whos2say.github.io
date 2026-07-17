-- Who's to Say Studio Participant Profile draft workflow.
-- Additive Phase 3 migration. Apply studio-auth-schema.sql first.
-- Drafts remain private and are not connected to public participant rendering.

alter table public.participant_user_access
  add column if not exists can_edit_profile boolean not null default false;

alter table public.participant_access_invites
  add column if not exists can_edit_profile boolean not null default false;

-- Refresh the invitation claim RPC after adding can_edit_profile. Dropping the
-- previous signature is required because PostgreSQL cannot replace a function
-- with a changed RETURNS TABLE shape in place.
drop function if exists public.claim_my_participant_access_invites();

create or replace function public.claim_my_participant_access_invites()
returns table (
  participant_id uuid,
  registry_id text,
  participant_slug text,
  access_role text,
  can_edit_page boolean,
  can_edit_brand_kit boolean,
  can_select_media boolean,
  can_edit_services boolean,
  can_edit_profile boolean,
  can_submit_review boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  verified_email text;
  invite_record public.participant_access_invites%rowtype;
begin
  if current_user_id is null then
    return;
  end if;

  select lower(btrim(users.email))
    into verified_email
  from auth.users
  where users.id = current_user_id
    and users.email_confirmed_at is not null;

  if verified_email is null or verified_email = '' then
    return;
  end if;

  for invite_record in
    select invites.*
    from public.participant_access_invites invites
    where invites.email_normalized = verified_email
      and invites.revoked_at is null
      and invites.starts_at <= now()
      and (invites.expires_at is null or invites.expires_at > now())
      and (invites.claimed_at is null or invites.claimed_by = current_user_id)
    for update
  loop
    insert into public.participant_user_access (
      participant_id, user_id, access_role, can_edit_page,
      can_edit_brand_kit, can_select_media, can_edit_services,
      can_edit_profile, can_submit_review, starts_at, expires_at,
      revoked_at, created_by
    ) values (
      invite_record.participant_id, current_user_id, invite_record.access_role,
      invite_record.can_edit_page, invite_record.can_edit_brand_kit,
      invite_record.can_select_media, invite_record.can_edit_services,
      invite_record.can_edit_profile, invite_record.can_submit_review,
      invite_record.starts_at, invite_record.expires_at, null,
      invite_record.created_by
    )
    on conflict on constraint participant_user_access_participant_id_user_id_access_role_key do update
      set can_edit_page = excluded.can_edit_page,
          can_edit_brand_kit = excluded.can_edit_brand_kit,
          can_select_media = excluded.can_select_media,
          can_edit_services = excluded.can_edit_services,
          can_edit_profile = excluded.can_edit_profile,
          can_submit_review = excluded.can_submit_review,
          starts_at = excluded.starts_at,
          expires_at = excluded.expires_at,
          revoked_at = null;

    update public.participant_access_invites invites
      set claimed_at = coalesce(invites.claimed_at, now()),
          claimed_by = coalesce(invites.claimed_by, current_user_id)
    where invites.id = invite_record.id
      and (invites.claimed_by is null or invites.claimed_by = current_user_id);

    return query
      select participants.id, participants.registry_id, participants.slug,
        invite_record.access_role, invite_record.can_edit_page,
        invite_record.can_edit_brand_kit, invite_record.can_select_media,
        invite_record.can_edit_services, invite_record.can_edit_profile,
        invite_record.can_submit_review
      from public.participants participants
      where participants.id = invite_record.participant_id;
  end loop;
end;
$$;

create table if not exists public.participant_profiles (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft', 'in-review', 'approved', 'archived')),
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participant_profile_revisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.participant_profiles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  revision_status text not null default 'draft'
    check (revision_status in ('draft', 'submitted', 'changes-requested', 'approved', 'withdrawn')),
  public_identity jsonb not null default '{}'::jsonb,
  contact_profile jsonb not null default '{}'::jsonb,
  social_profiles jsonb not null default '[]'::jsonb,
  visibility jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  unique (profile_id, revision_number)
);

alter table public.participant_profiles
  drop constraint if exists participant_profiles_published_revision_id_fkey;
alter table public.participant_profiles
  add constraint participant_profiles_published_revision_id_fkey
  foreign key (published_revision_id) references public.participant_profile_revisions(id) on delete set null;

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  entity_type text not null check (entity_type = 'participant_profile'),
  revision_id uuid not null references public.participant_profile_revisions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes-requested', 'withdrawn')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, revision_id)
);

comment on table public.participant_profiles is
  'Private participant-owned Profile container. published_revision_id is staff-controlled and is not consumed by public pages in Phase 3.';
comment on table public.participant_profile_revisions is
  'Structured private Profile revisions. No raw HTML, CSS, scripts, routes, form endpoints, or arbitrary social URLs.';
comment on table public.review_requests is
  'Participant submission queue. Approval and changes-requested actions remain staff/SuperAdmin-only.';

create index if not exists participant_profile_revisions_profile_idx
  on public.participant_profile_revisions(profile_id, revision_number desc);
create index if not exists review_requests_participant_status_idx
  on public.review_requests(participant_id, status, created_at desc);

create or replace function public.has_participant_profile_edit_access(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_studio_superadmin() or exists (
    select 1
    from public.participant_user_access access
    where access.participant_id = target_participant_id
      and access.user_id = auth.uid()
      and access.revoked_at is null
      and access.starts_at <= now()
      and (access.expires_at is null or access.expires_at > now())
      and (
        access.access_role = 'participant_owner'
        or (access.access_role = 'participant_admin' and access.can_edit_profile)
      )
  );
$$;

create or replace function public.is_studio_staff_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('superadmin', 'staff')
  );
$$;

create or replace function public.profile_text_is_safe(value text, max_length integer)
returns boolean
language sql
immutable
set search_path = public
as $$
  select value is null or (
    char_length(value) <= max_length
    and value !~* '<[^>]*>'
    and value !~* '(javascript:|data:text/html|https?://|www\.)'
  );
$$;

create or replace function public.participant_profile_payload_is_safe(
  public_identity jsonb,
  contact_profile jsonb,
  social_profiles jsonb,
  visibility jsonb,
  consent jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  social jsonb;
  platform text;
  handle text;
begin
  if jsonb_typeof(public_identity) <> 'object'
    or jsonb_typeof(contact_profile) <> 'object'
    or jsonb_typeof(social_profiles) <> 'array'
    or jsonb_typeof(visibility) <> 'object'
    or jsonb_typeof(consent) <> 'object' then
    return false;
  end if;
  if public_identity - array['displayName','professionalName','pronouns','locationText'] <> '{}'::jsonb
    or contact_profile - array['enabled','publicEmail','publicPhoneDisplay','preferredContactMethod','availabilityText','responseTimeText'] <> '{}'::jsonb
    or visibility - array['showLocation','showEmail','showPhone','showSocialProfiles'] <> '{}'::jsonb
    or consent - array['participantApproved','approvedAt','approvedByUserId','reviewRequired'] <> '{}'::jsonb then
    return false;
  end if;
  if not public.profile_text_is_safe(public_identity->>'displayName', 100)
    or not public.profile_text_is_safe(public_identity->>'professionalName', 100)
    or not public.profile_text_is_safe(public_identity->>'pronouns', 50)
    or not public.profile_text_is_safe(public_identity->>'locationText', 120)
    or not public.profile_text_is_safe(contact_profile->>'availabilityText', 240)
    or not public.profile_text_is_safe(contact_profile->>'responseTimeText', 160) then
    return false;
  end if;
  if coalesce(contact_profile->>'publicEmail', '') <> ''
    and contact_profile->>'publicEmail' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return false;
  end if;
  if coalesce(contact_profile->>'publicPhoneDisplay', '') <> ''
    and (
      char_length(contact_profile->>'publicPhoneDisplay') > 30
      or contact_profile->>'publicPhoneDisplay' !~ '^[0-9+(). -]+$'
    ) then
    return false;
  end if;
  if coalesce(contact_profile->>'preferredContactMethod', 'contact-form')
    not in ('contact-form','email','phone','social') then
    return false;
  end if;
  if jsonb_array_length(social_profiles) > 12 then return false; end if;
  for social in select value from jsonb_array_elements(social_profiles)
  loop
    if jsonb_typeof(social) <> 'object'
      or social - array['platform','handle','enabled'] <> '{}'::jsonb then return false; end if;
    platform := social->>'platform';
    handle := social->>'handle';
    if platform not in ('instagram','youtube','facebook','tiktok','linkedin','x')
      or handle is null or char_length(handle) > 100
      or handle ~* '(https?://|www\.|[/?#])' then return false; end if;
    if platform in ('instagram','tiktok','x') and handle !~ '^[A-Za-z0-9._]{1,30}$' then return false; end if;
    if platform = 'youtube' and handle !~ '^@?[A-Za-z0-9._-]{1,100}$' then return false; end if;
    if platform in ('facebook','linkedin') and handle !~ '^[A-Za-z0-9._-]{1,100}$' then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.participant_profile_revisions
  drop constraint if exists participant_profile_revisions_safe_payload_check;
alter table public.participant_profile_revisions
  add constraint participant_profile_revisions_safe_payload_check check (
    public.participant_profile_payload_is_safe(
      public_identity, contact_profile, social_profiles, visibility, consent
    )
  );

alter table public.participant_profile_revisions
  drop constraint if exists participant_profile_revisions_no_self_review_check;
alter table public.participant_profile_revisions
  add constraint participant_profile_revisions_no_self_review_check check (
    reviewed_by is null or reviewed_by <> created_by
  );

alter table public.review_requests
  drop constraint if exists review_requests_no_self_review_check;
alter table public.review_requests
  add constraint review_requests_no_self_review_check check (
    reviewed_by is null or reviewed_by <> submitted_by
  );

create or replace function public.create_my_participant_profile_draft(target_participant_id uuid)
returns setof public.participant_profile_revisions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_profile public.participant_profiles%rowtype;
  source_revision public.participant_profile_revisions%rowtype;
  new_revision public.participant_profile_revisions%rowtype;
begin
  if auth.uid() is null or not public.has_participant_profile_edit_access(target_participant_id) then
    raise exception 'Participant profile access denied' using errcode = '42501';
  end if;
  insert into public.participant_profiles (participant_id)
  values (target_participant_id)
  on conflict on constraint participant_profiles_participant_id_key do nothing;
  select * into target_profile from public.participant_profiles
    where participant_id = target_participant_id for update;
  select * into new_revision from public.participant_profile_revisions
    where profile_id = target_profile.id and revision_status = 'draft' and created_by = auth.uid()
    order by revision_number desc limit 1;
  if found then return next new_revision; return; end if;
  select * into source_revision from public.participant_profile_revisions
    where profile_id = target_profile.id and revision_status in ('approved','changes-requested')
    order by revision_number desc limit 1;
  insert into public.participant_profile_revisions (
    profile_id, revision_number, public_identity, contact_profile,
    social_profiles, visibility, consent, created_by
  ) values (
    target_profile.id,
    coalesce((select max(revision_number) from public.participant_profile_revisions where profile_id = target_profile.id), 0) + 1,
    coalesce(source_revision.public_identity, '{}'::jsonb),
    coalesce(source_revision.contact_profile, '{}'::jsonb),
    coalesce(source_revision.social_profiles, '[]'::jsonb),
    coalesce(source_revision.visibility, '{}'::jsonb),
    jsonb_build_object('participantApproved', false, 'approvedAt', null, 'approvedByUserId', null, 'reviewRequired', true),
    auth.uid()
  ) returning * into new_revision;
  return next new_revision;
end;
$$;

create or replace function public.submit_my_participant_profile_revision(target_revision_id uuid)
returns setof public.participant_profile_revisions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_revision public.participant_profile_revisions%rowtype;
  target_participant_id uuid;
begin
  select revisions.*
    into target_revision
  from public.participant_profile_revisions revisions
  where revisions.id = target_revision_id
  for update of revisions;
  if target_revision.id is not null then
    select profiles.participant_id
      into target_participant_id
    from public.participant_profiles profiles
    where profiles.id = target_revision.profile_id;
  end if;
  if target_revision.id is null
    or target_revision.created_by <> auth.uid()
    or target_revision.revision_status <> 'draft'
    or not public.has_participant_profile_edit_access(target_participant_id)
    or not exists (
      select 1 from public.participant_user_access access
      where access.participant_id = target_participant_id
        and access.user_id = auth.uid()
        and access.can_submit_review
        and access.revoked_at is null
        and access.starts_at <= now()
        and (access.expires_at is null or access.expires_at > now())
    ) then
    raise exception 'Profile revision cannot be submitted' using errcode = '42501';
  end if;
  update public.participant_profile_revisions
    set revision_status = 'submitted', submitted_at = now(), updated_at = now()
    where id = target_revision_id returning * into target_revision;
  insert into public.review_requests (
    participant_id, entity_type, revision_id, submitted_by
  ) values (
    target_participant_id, 'participant_profile', target_revision_id, auth.uid()
  ) on conflict on constraint review_requests_entity_type_revision_id_key do update
    set status = 'pending', submitted_by = excluded.submitted_by, updated_at = now();
  update public.participant_profiles set lifecycle_status = 'in-review', updated_at = now()
    where id = target_revision.profile_id;
  return next target_revision;
end;
$$;

revoke all on function public.has_participant_profile_edit_access(uuid) from public;
revoke all on function public.is_studio_staff_reviewer() from public;
revoke all on function public.profile_text_is_safe(text, integer) from public;
revoke all on function public.participant_profile_payload_is_safe(jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.create_my_participant_profile_draft(uuid) from public;
revoke all on function public.submit_my_participant_profile_revision(uuid) from public;
revoke all on function public.claim_my_participant_access_invites() from public;
grant execute on function public.has_participant_profile_edit_access(uuid) to authenticated;
grant execute on function public.is_studio_staff_reviewer() to authenticated;
grant execute on function public.create_my_participant_profile_draft(uuid) to authenticated;
grant execute on function public.submit_my_participant_profile_revision(uuid) to authenticated;
grant execute on function public.claim_my_participant_access_invites() to authenticated;

alter table public.participant_profiles enable row level security;
alter table public.participant_profile_revisions enable row level security;
alter table public.review_requests enable row level security;
revoke all on public.participant_profiles, public.participant_profile_revisions, public.review_requests from anon;
grant select on public.participant_profiles, public.review_requests to authenticated;
grant select, update on public.participant_profile_revisions to authenticated;

create policy "participant_profiles_read_assigned"
  on public.participant_profiles for select to authenticated
  using (public.has_participant_access(participant_id));
create policy "participant_profiles_staff_manage"
  on public.participant_profiles for all to authenticated
  using (public.is_studio_staff_reviewer())
  with check (public.is_studio_staff_reviewer());
create policy "profile_revisions_read_assigned"
  on public.participant_profile_revisions for select to authenticated
  using (exists (
    select 1 from public.participant_profiles profiles
    where profiles.id = profile_id and public.has_participant_access(profiles.participant_id)
  ));
create policy "profile_revisions_update_own_draft"
  on public.participant_profile_revisions for update to authenticated
  using (
    created_by = auth.uid() and revision_status = 'draft'
    and exists (
      select 1 from public.participant_profiles profiles
      where profiles.id = profile_id
        and public.has_participant_profile_edit_access(profiles.participant_id)
    )
  )
  with check (
    created_by = auth.uid() and revision_status = 'draft'
    and reviewed_at is null and reviewed_by is null and review_notes is null
    and coalesce(consent->>'participantApproved', 'false') = 'false'
    and consent->>'approvedAt' is null and consent->>'approvedByUserId' is null
  );
create policy "profile_revisions_staff_manage"
  on public.participant_profile_revisions for all to authenticated
  using (public.is_studio_staff_reviewer())
  with check (public.is_studio_staff_reviewer());
create policy "review_requests_read_assigned"
  on public.review_requests for select to authenticated
  using (public.has_participant_access(participant_id) or public.is_studio_staff_reviewer());
create policy "review_requests_staff_manage"
  on public.review_requests for all to authenticated
  using (public.is_studio_staff_reviewer())
  with check (public.is_studio_staff_reviewer());

-- Phase 3 intentionally has no public/anonymous policies and no public renderer.
