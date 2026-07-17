# Participant Profile Draft Schema

Participant Profiles are private Studio records for participant-owned public identity, contact preferences, social handles, visibility choices, and review consent. They are separate from the Participant Registry, Participant Pages, Brand Kits, and Media Hub.

Phase 3 does not publish Profile data to `/djr/`, does not create a Cody public page, and does not move Decap editing into Studio.

## Files

Apply SQL manually in Supabase in this order:

1. `supabase/studio-auth-schema.sql`
2. `supabase/studio-participant-profile-schema.sql`
3. `supabase/studio-auth-djr-bootstrap.example.sql` after replacing `REPLACE_WITH_PARTICIPANT_EMAIL` locally
4. Optional: `supabase/studio-participant-profile-djr-bootstrap.example.sql` after the invited user has claimed profile access

Before using production data, run rollback-only smoke tests in a non-production project:

```bash
supabase/studio-auth-rls-smoke-test.sql
supabase/studio-participant-profile-rls-smoke-test.sql
```

## Tables

`participant_profiles` is the private one-row container for a participant. It stores lifecycle status and, later, a staff-controlled `published_revision_id`.

`participant_profile_revisions` stores structured private drafts and submitted revisions. A participant can save only their own active `draft` revision. Submitted or approved revisions cannot be silently overwritten.

`review_requests` is the submission queue for staff/SuperAdmin review. Participants can submit their own draft for review, but they cannot approve it.

## Safe Payload

The only profile payload areas are:

- `publicIdentity`
- `contactProfile`
- `socialProfiles`
- `visibility`
- `consent`

The schema rejects raw HTML, raw CSS, JavaScript, Markdown, route controls, navigation controls, form endpoints, layout controls, and arbitrary URLs. Social profiles use an allowlisted platform plus handle only. Google OAuth remains identity only; participant authorization comes from `participant_user_access` and RLS.

## Studio Behavior

`/studio/` shows an Open/Edit Profile link only when the signed-in user has participant-scoped access:

- `participant_owner`: can edit profile drafts and submit when `can_submit_review` is true.
- `participant_admin`: can edit only when `can_edit_profile` is true.
- `contributor`: cannot edit contact/social profile fields unless a later approved capability model changes this.
- Unassigned users: cannot read or edit private profile records.

The profile editor at `/studio/participants/profile/?participantId=participant-djr` provides Save Draft, Preview Draft, and Submit for Review. It has no approve controls.

## Human Acceptance

1. Apply the SQL files above in a non-production Supabase project.
2. Run the DJR auth bootstrap with the participant's verified Google email.
3. Sign in at `/studio/` with that email.
4. Confirm DJR appears once in My Participants and Cody does not appear.
5. Open DJR Profile, save a draft, preview it, and submit it for review.
6. Confirm hidden email, phone, and social fields do not appear in the private preview until their visibility toggles are enabled.
7. Sign in with an unassigned user and confirm no profile can be opened.

## Deferred

- Publishing Profile data to `/djr/`
- Public contact/social rendering
- Staff approval UI
- Participant Page or Brand Kit editing in Studio
- Cody route, navigation, page, or template
# Phase 4 review and publication

Staff review, approved-revision immutability, and the visibility-filtered anonymous projection are specified in [participant-profile-review-and-publishing.md](participant-profile-review-and-publishing.md). Apply `studio-participant-profile-review-schema.sql` after this Phase 3 schema.
