# Who's to Say Studio Auth Foundation

## Decision

Studio will use Supabase Auth and support Google OAuth as its primary planned identity provider. Google answers **who is signing in**. Who's to Say participant access records answer **what that user may view, edit, review, or publish**.

Google OAuth is not the authorization system. A verified Google identity, email address, email domain, or OAuth claim must never independently grant access to a participant, album, draft, review, or publishing action.

The initial static `/studio/` shell supports authentication state only. Participant editing remains in the staff-operated Decap workflow until the app tables and row-level security policies are reviewed, deployed, and tested.

## Identity providers

### Google OAuth

Configure Google as a provider in Supabase Auth. Studio requests only:

```text
openid email profile
```

This phase does not request Google Photos, Google Drive, Calendar, contacts, offline access, or other Google API scopes. It does not read or import Google Photos.

### Optional magic-link fallback

Supabase email magic links may remain available as an optional fallback. A magic-link user is subject to the same Who's to Say access tables and RLS policies as a Google user. Authentication method does not change authorization.

## Authorization records

The draft SQL in `supabase/studio-auth-schema.sql` introduces:

- `public.profiles`: app profile associated with `auth.users`.
- `public.participants`: database participant identity mapped to the static registry ID.
- `public.user_roles`: global `superadmin` and `staff` assignments.
- `public.participant_user_access`: participant-scoped owner, staff-admin, contributor, and capability assignments.
- `public.participant_album_access`: participant-to-album access assignments.
- `public.audit_events`: append-only application audit targets.

Future review and publication migrations should add `review_requests` and `publish_events` before participant publishing is enabled. The current SQL intentionally does not alter the existing album tables.

## RLS expectations

- Anonymous users cannot read Studio ownership or access data.
- Authenticated users can read and maintain only their own profile.
- A user sees a participant only through an active `participant_user_access` row or a global `superadmin` role.
- A user sees only their own participant and album access rows unless they are a SuperAdmin.
- Client code cannot assign its own global role or participant access.
- Participant, role, access, and audit writes require trusted server-side or SuperAdmin operations.
- Published public pages continue using their existing renderers; Studio tables do not change `/djr/`.
- RLS must be exercised with anonymous, owner, contributor, staff, and SuperAdmin test users before editing is enabled.

The SQL policies are a conservative draft, not an instruction to run unreviewed against production. Apply through the normal Supabase migration process after reviewing existing policies and testing in a non-production project.

## Supabase and Google configuration

The repository already exposes the Supabase project URL and publishable anon key through `js/supabase.js`. A publishable/anon key is intended for browser use and relies on RLS. Never place a Supabase service-role key, Google client secret, or other privileged credential in repository files or browser code.

Required dashboard settings:

1. Confirm the Supabase project URL and public publishable/anon key.
2. In Supabase Auth, enable the Google provider.
3. Create a Google OAuth web client and enter its Client ID and Client Secret only in the Supabase dashboard.
4. Add the Supabase-provided Google callback URL to Google Cloud's authorized redirect URIs. This is normally `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Add Studio destinations to the Supabase Auth URL configuration allowlist.

Recommended Studio redirect destinations:

```text
https://www.whostosay.org/studio/auth/callback/
https://<approved-staging-host>/studio/auth/callback/
http://localhost:4173/studio/auth/callback/
```

Also set the production Site URL to the approved canonical origin. Add only controlled staging preview origins; avoid unrestricted wildcard redirect patterns. The static callback route completes the browser session and returns the user to `/studio/`.

## Current shell behavior

`/studio/` can:

- Start Google sign-in through the existing Supabase client.
- Display the authenticated user's email.
- Sign out.
- Explain that “My Participants” remains locked until authorization policies are deployed.

It cannot edit Participant Pages, Brand Kits, registries, albums, contact details, or social profiles. It does not query participant access tables yet and does not pretend that successful Google sign-in grants participant access.

## Explicitly deferred

- Direct participant editing.
- Participant contact or social profile fields.
- Moving Participant Pages out of Decap.
- Public Brand Kit design preset application.
- Cody route, navigation, page, or template.
- Google Photos or Drive integration.
- Review/publish UI and production publishing authority.
