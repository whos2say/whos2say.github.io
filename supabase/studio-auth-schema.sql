-- Who's to Say Studio auth and authorization foundation (draft).
-- Review and test in a non-production Supabase project before applying.
-- Google OAuth authenticates users through Supabase Auth; these tables authorize access.
-- This migration is additive and does not alter the existing albums/photos schema.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Studio-facing profile for an authenticated Supabase user; never grants authorization by itself.';

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  registry_id text not null unique check (registry_id ~ '^participant-[a-z0-9]+(?:-[a-z0-9]+)*$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.participants is
  'Database participant identity mapped to content/participants registry_id; does not create a public route.';

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin', 'staff')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (user_id, role)
);

comment on table public.user_roles is
  'Small set of global Studio roles. Participant owner/contributor access belongs in participant_user_access.';

create table if not exists public.participant_user_access (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null check (access_role in ('participant_owner', 'participant_admin', 'contributor')),
  can_edit_page boolean not null default false,
  can_edit_brand_kit boolean not null default false,
  can_select_media boolean not null default false,
  can_edit_services boolean not null default false,
  can_edit_profile boolean not null default false,
  can_submit_review boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (participant_id, user_id, access_role),
  check (expires_at is null or expires_at > starts_at)
);

comment on table public.participant_user_access is
  'Participant-scoped authorization. OAuth identity or email alone never creates one of these rows.';

create table if not exists public.participant_album_access (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  album_id uuid not null,
  access_level text not null default 'select' check (access_level in ('view', 'select', 'manage')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (participant_id, album_id)
);

comment on table public.participant_album_access is
  'Participant-to-Media-Hub album assignment. album_id intentionally has no new FK in this draft so existing album tables are untouched.';

create table if not exists public.participant_access_invites (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null check (
    email_normalized = lower(btrim(email_normalized))
    and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  participant_id uuid not null references public.participants(id) on delete cascade,
  access_role text not null check (access_role in ('participant_owner', 'participant_admin', 'contributor')),
  can_edit_page boolean not null default false,
  can_edit_brand_kit boolean not null default false,
  can_select_media boolean not null default false,
  can_edit_services boolean not null default false,
  can_edit_profile boolean not null default false,
  can_submit_review boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (email_normalized, participant_id, access_role),
  check (expires_at is null or expires_at > starts_at)
);

comment on table public.participant_access_invites is
  'Admin-created, email-matched invitations. Email identity alone grants nothing without an active invite claimed by the matching authenticated user.';

create table if not exists public.audit_events (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  participant_id uuid references public.participants(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Append-only audit target for trusted Studio server actions. No client insert policy is granted in this draft.';

create index if not exists participant_user_access_user_idx
  on public.participant_user_access(user_id, participant_id);
create index if not exists participant_album_access_participant_idx
  on public.participant_album_access(participant_id, album_id);
create index if not exists participant_access_invites_email_idx
  on public.participant_access_invites(email_normalized, starts_at, expires_at)
  where revoked_at is null;
create index if not exists audit_events_participant_time_idx
  on public.audit_events(participant_id, occurred_at desc);

alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.user_roles enable row level security;
alter table public.participant_user_access enable row level security;
alter table public.participant_album_access enable row level security;
alter table public.participant_access_invites enable row level security;
alter table public.audit_events enable row level security;

-- SECURITY DEFINER helpers centralize authorization checks. Keep execute access
-- limited to authenticated users and do not accept a user ID from the client.
create or replace function public.is_studio_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.has_participant_access(target_participant_id uuid)
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
  );
$$;

revoke all on function public.is_studio_superadmin() from public;
revoke all on function public.has_participant_access(uuid) from public;
grant execute on function public.is_studio_superadmin() to authenticated;
grant execute on function public.has_participant_access(uuid) to authenticated;

-- Claiming takes no identity arguments. The function derives both user ID and
-- verified email from auth.users for auth.uid(), locks matching invite rows,
-- and copies only admin-approved role/capability values.
-- Drop first so rerunning this migration can upgrade databases that already
-- have the older zero-argument RETURNS TABLE shape.
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
      participant_id,
      user_id,
      access_role,
      can_edit_page,
      can_edit_brand_kit,
      can_select_media,
      can_edit_services,
      can_edit_profile,
      can_submit_review,
      starts_at,
      expires_at,
      revoked_at,
      created_by
    ) values (
      invite_record.participant_id,
      current_user_id,
      invite_record.access_role,
      invite_record.can_edit_page,
      invite_record.can_edit_brand_kit,
      invite_record.can_select_media,
      invite_record.can_edit_services,
      invite_record.can_edit_profile,
      invite_record.can_submit_review,
      invite_record.starts_at,
      invite_record.expires_at,
      null,
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
      select
        participants.id,
        participants.registry_id,
        participants.slug,
        invite_record.access_role,
        invite_record.can_edit_page,
        invite_record.can_edit_brand_kit,
        invite_record.can_select_media,
        invite_record.can_edit_services,
        invite_record.can_edit_profile,
        invite_record.can_submit_review
      from public.participants participants
      where participants.id = invite_record.participant_id;
  end loop;
end;
$$;

revoke all on function public.claim_my_participant_access_invites() from public;
grant execute on function public.claim_my_participant_access_invites() to authenticated;

-- Explicit grants pair with RLS. Anonymous receives no Studio table grants.
revoke all on public.profiles from anon;
revoke all on public.participants from anon;
revoke all on public.user_roles from anon;
revoke all on public.participant_user_access from anon;
revoke all on public.participant_album_access from anon;
revoke all on public.participant_access_invites from anon;
revoke all on public.audit_events from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.participant_user_access to authenticated;
grant select, insert, update, delete on public.participant_album_access to authenticated;
grant select, insert, update, delete on public.participant_access_invites to authenticated;
grant select on public.audit_events to authenticated;

-- Starter policies are intentionally conservative. There are no anonymous
-- policies and no client policies that create roles, access, or audit events.
create policy "profiles_read_own"
  on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_studio_superadmin());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "participants_read_assigned"
  on public.participants for select to authenticated
  using (public.has_participant_access(id));

create policy "participants_superadmin_write"
  on public.participants for all to authenticated
  using (public.is_studio_superadmin())
  with check (public.is_studio_superadmin());

create policy "user_roles_read_own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_studio_superadmin());

create policy "user_roles_superadmin_write"
  on public.user_roles for all to authenticated
  using (public.is_studio_superadmin())
  with check (public.is_studio_superadmin());

create policy "participant_access_read_own"
  on public.participant_user_access for select to authenticated
  using (user_id = auth.uid() or public.is_studio_superadmin());

create policy "participant_access_superadmin_write"
  on public.participant_user_access for all to authenticated
  using (public.is_studio_superadmin())
  with check (public.is_studio_superadmin());

create policy "album_access_read_assigned"
  on public.participant_album_access for select to authenticated
  using (public.has_participant_access(participant_id));

create policy "album_access_superadmin_write"
  on public.participant_album_access for all to authenticated
  using (public.is_studio_superadmin())
  with check (public.is_studio_superadmin());

create policy "participant_invites_superadmin_read"
  on public.participant_access_invites for select to authenticated
  using (public.is_studio_superadmin());

create policy "participant_invites_superadmin_write"
  on public.participant_access_invites for all to authenticated
  using (public.is_studio_superadmin())
  with check (public.is_studio_superadmin());

create policy "audit_events_read_authorized"
  on public.audit_events for select to authenticated
  using (
    public.is_studio_superadmin()
    or (participant_id is not null and public.has_participant_access(participant_id))
  );

-- Intentionally omitted in this phase:
-- - review_requests and publish_events (required before publishing is enabled)
-- - participant page or Brand Kit draft tables
-- - policies modifying existing albums/photos
-- - automatic authorization based on Google/email identity
