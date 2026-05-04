-- Photo Album App schema notes
-- Draft migration documentation inferred from the current static app.
-- Review policies before applying to production.

create extension if not exists pgcrypto;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete set null,
  cover_photo_id uuid null,
  is_private boolean not null default false,
  sort_order integer,
  music_url text,
  title_size text check (title_size is null or title_size in ('sm', 'md', 'lg'))
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  file_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  focal_point text default '50% 50%',
  sort_order integer
);

alter table public.albums
  add constraint albums_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos(id) on delete set null;

create table if not exists public.album_contributors (
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  comment text not null check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null
);

-- Present in album.js music tooling, though outside the initial Phase 1 table list.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  title text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists photos_album_id_created_at_idx on public.photos(album_id, created_at desc);
create index if not exists photos_album_id_sort_order_idx on public.photos(album_id, sort_order);
create index if not exists album_contributors_user_id_idx on public.album_contributors(user_id);
create index if not exists photo_comments_photo_id_created_at_idx on public.photo_comments(photo_id, created_at);

alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.album_contributors enable row level security;
alter table public.photo_comments enable row level security;
alter table public.site_settings enable row level security;
alter table public.music_tracks enable row level security;

-- Storage bucket notes:
-- - Bucket `photos`: public bucket used for image and video album assets.
-- - Object paths currently use `${album_id}/${timestamp}_${filename}`.
-- - Bucket `music`: public bucket used for uploaded album music tracks.
-- - Configure CORS so browser rendering, downloads, and crop/canvas flows work.

-- Draft RLS policy notes:
-- Public visitors can read public albums and photos for public albums.
-- Authenticated users can read albums they own, unowned public albums, or albums where they are contributors.
-- Owners/contributors can upload photos if app policy allows contribution; current UI primarily treats signed-in users as owners on album pages.
-- Admin operations currently assume auth.email() = 'joe@whostosay.org'; replace with role claims before platform reuse.
-- Comment reads follow photo visibility. Comment inserts require auth.uid(); deletes should allow comment owner or admin.
-- site_settings reads can be public; writes should be admin-only.

-- Example draft policies, intentionally conservative and incomplete:
-- create policy "albums_public_read" on public.albums
--   for select using (is_private = false);
-- create policy "albums_owner_read" on public.albums
--   for select using (auth.uid() = owner_id);
-- create policy "albums_contributor_read" on public.albums
--   for select using (exists (
--     select 1 from public.album_contributors ac
--     where ac.album_id = albums.id and ac.user_id = auth.uid()
--   ));
-- create policy "albums_owner_insert" on public.albums
--   for insert with check (auth.uid() = owner_id);
-- create policy "albums_owner_update" on public.albums
--   for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- create policy "albums_admin_all" on public.albums
--   using (auth.email() = 'joe@whostosay.org')
--   with check (auth.email() = 'joe@whostosay.org');

-- RPC helpers currently expected by admin UI:
-- - get_user_id_by_email(lookup_email text) returns uuid
-- - get_album_owner_emails(album_ids uuid[]) returns table(album_id uuid, owner_email text)
-- - get_album_contributors(p_album_id uuid) returns table(user_id uuid, user_email text, added_at timestamptz)
-- - get_album_users() returns table(user_id uuid, user_email text, album_count bigint)
