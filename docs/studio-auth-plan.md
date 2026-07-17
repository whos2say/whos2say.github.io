# Who's to Say Studio Auth Foundation

## Decision

Studio will use Supabase Auth and support Google OAuth as its primary planned identity provider. Google answers **who is signing in**. Who's to Say participant access records answer **what that user may view, edit, review, or publish**.

Google OAuth is not the authorization system. A verified Google identity, email address, email domain, or OAuth claim must never independently grant access to a participant, album, draft, review, or publishing action.

The static `/studio/` shell supports authentication plus a read-only view of participant assignments. Participant editing remains in the staff-operated Decap workflow until the app tables, row-level security policies, and review workflow are reviewed, deployed, and tested.

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

## Current read-only dashboard behavior

`/studio/` can:

- Start Google sign-in through the existing Supabase client.
- Display the authenticated user's email.
- Sign out.
- Query `participant_user_access` for the authenticated user and rely on RLS to limit visible `participants` rows.
- Count RLS-visible `participant_album_access` assignments.
- Enrich authorized cards with safe page and Brand Kit references from the static Participant Registry.
- Show public-page and local JSON view links without edit actions.
- Claim only active, admin-created invitations for the current authenticated and verified email through `claim_my_participant_access_invites()`.

If the Supabase access tables are unavailable, production displays **Participant access could not be verified** and shows no participant cards. It never silently converts registry metadata into production authorization.

Static registry preview is available only on localhost or with the explicit `registryPreview=1` diagnostic query. It still requires the signed-in Supabase user UUID to appear in a registry access array and is labeled **Development registry preview — not enforced authorization**. Current registry access arrays are empty, so preview does not grant demo access by default.

The dashboard cannot edit Participant Pages, Brand Kits, registries, albums, contact details, or social profiles. It does not pretend that successful Google sign-in grants participant access. Empty and error states remain locked, and Decap remains the staff-operated editor.

## Next phase

The next planned phase is participant profile drafts behind reviewed RLS and a review workflow. Draft schema and permissions must be approved before any contact/social fields are introduced. Contact/social editing remains intentionally disabled in the current phase.

## Deterministic PKCE callback

The shared browser client uses PKCE with URL session detection, persisted sessions, and automatic token refresh. Google sign-in still requests only `openid email profile`.

`/studio/auth/callback/`:

1. Safely handles provider `error` and `error_description` values.
2. Exchanges a `code` with `exchangeCodeForSession(code)`.
3. Accepts an already-detected session if the shared client completed the same exchange first.
4. Checks the existing session when no code exists.
5. Clears OAuth query parameters after success.
6. Redirects only to the fixed internal path `/studio/`.

Studio does not store or display Google provider tokens, access tokens, refresh tokens, or full JWTs.

## Safe diagnostics

Open `/studio/?debug=1` to display the safe Auth readiness panel. It includes:

- Current origin and expected callbacks.
- Supabase project host/reference and public reachability.
- Session presence and, when signed in, user UUID/email.
- Assignment query status and access source.
- Sanitized error code/message.
- Whether registry preview is enabled.
- Copy buttons for user UUID/email and both expected callbacks.

The panel never displays the publishable anon key, secret/service-role key, Google Client Secret, OAuth tokens, provider tokens, full JWT, or private user metadata.

## Participant invitation and DJR bootstrap

`participant_access_invites` is an admin-created authorization bridge. Email identity alone grants nothing. The no-argument SECURITY DEFINER RPC `claim_my_participant_access_invites()` derives `auth.uid()` and the confirmed email from `auth.users`, locks only matching active invites, copies only admin-approved role/capabilities, and marks the invite claimed by that user. Authenticated clients cannot create or revoke invites through RLS.

One-time DJR setup:

1. In a non-production project first, apply `supabase/studio-auth-schema.sql`.
2. Review and run `supabase/studio-auth-rls-smoke-test.sql`; it rolls back its fixtures.
3. Open `supabase/studio-auth-djr-bootstrap.example.sql` locally.
4. Replace `REPLACE_WITH_PARTICIPANT_EMAIL` with the participant's exact Google email. Do not commit that local value.
5. Run the edited bootstrap in Supabase SQL Editor.
6. Sign in at `/studio/` using that same verified Google email.
7. Studio claims the pre-authorized invite and displays only DJR.

The bootstrap upserts `participant-djr`, all DJR registry album assignments, and one participant-owner invitation. It is idempotent and contains no real email or secret.

## One-time external configuration checklist

### Google Cloud

- Create or select a **Web application** OAuth client.
- Add Authorized JavaScript origin: `https://www.whostosay.org`.
- Add Authorized redirect URI: `https://oiiluqrpzhujbvrblsko.supabase.co/auth/v1/callback`.
- Configure only `openid`, `email`, and `profile`.
- Add the participant test email to the OAuth testing audience when the app is not published.
- Do not add Google Photos or Google Drive scopes.

### Supabase

- Enable the Google provider under Authentication → Providers.
- Enter the Google Client ID and Client Secret only in the Supabase Dashboard.
- Set Site URL to `https://www.whostosay.org`.
- Add Redirect URL `https://www.whostosay.org/studio/auth/callback/`.
- Add only controlled staging/localhost callback URLs when needed.
- Apply `supabase/studio-auth-schema.sql`.
- Run the RLS smoke test in a non-production project.
- Apply a locally edited copy of `supabase/studio-auth-djr-bootstrap.example.sql`.
- Confirm no secret/service-role key is present in browser code.

Repository code cannot configure or prove Dashboard-only Site URL and redirect allowlist values without administrative access. Public Auth settings can report whether the Google provider is enabled, and public REST responses can establish whether Studio tables are exposed.

## Troubleshooting matrix

| Symptom | Likely cause | Safe response |
|---|---|---|
| “Google sign-in is not enabled” | Google provider disabled in Supabase | Enable Google and save Client ID/secret only in Dashboard |
| `redirect_uri_mismatch` at Google | Supabase provider callback missing in Google Cloud | Add `https://oiiluqrpzhujbvrblsko.supabase.co/auth/v1/callback` exactly |
| Callback not allowed by Supabase | App callback missing from Supabase redirect allowlist | Add `https://www.whostosay.org/studio/auth/callback/` exactly |
| No session on callback | Missing/reused PKCE code, storage issue, or callback mismatch | Return to `/studio/` and begin a new sign-in; inspect `?debug=1` |
| OAuth app blocks participant | Google app remains in testing or user is outside audience | Add the test user or publish the consent configuration as appropriate |
| “Participant access could not be verified” with table error | Studio schema not applied or PostgREST schema cache not refreshed | Apply the schema, then verify table HTTP responses |
| RLS denial | Missing/invalid policy or no active participant assignment | Run the RLS smoke test and inspect safe debug error details |
| Signed in but no assignment | No matching active invite/access row | Run the DJR bootstrap with the exact verified email; do not authorize by email alone |
| Registry preview appears in production | `registryPreview=1` was explicitly added | Remove the query parameter; production fallback is otherwise disabled |

## Acceptance and test commands

```bash
npm run test:studio-auth
node scripts/test-djr-content-contract.mjs
node --check studio/js/studio-auth-core.js
node --check studio/js/participant-dashboard-core.js
node --check studio/js/studio-auth.js
node --check studio/js/auth-callback.js
node --check studio/js/participant-dashboard.js
git diff --check
```

Human OAuth acceptance still requires configured dashboards and real accounts:

1. Sign in with the pre-authorized participant email and confirm DJR appears, Cody does not, and sign-out succeeds.
2. Sign in with an unassigned account and confirm identity succeeds with no participant cards or production registry fallback.

## Explicitly deferred

- Direct participant editing.
- Participant contact or social profile fields.
- Moving Participant Pages out of Decap.
- Public Brand Kit design preset application.
- Cody route, navigation, page, or template.
- Google Photos or Drive integration.
- Review/publish UI and production publishing authority.
