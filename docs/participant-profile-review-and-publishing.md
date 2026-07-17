# Participant Profile review and publishing

Phase 4 adds a staff-authorized lifecycle: `draft → submitted → changes-requested → draft` or `submitted → approved`. Owners and participant admins can save and submit their assigned participant’s drafts. Only an authenticated user with a current `user_roles` row of `staff` or `superadmin` can inspect the queue, request changes, approve, or publish. Email and Google identity never grant that authority.

Approval is atomic and rejects self-approval, stale requests, missing participant consent, invalid identity/contact/social payloads, and any revision that is not submitted. Request Changes requires sanitized plain-text notes. An approved revision is immutable; a later proposal is a new numbered draft. Historical approved revisions remain intact while `participant_profiles.published_revision_id` identifies the single current publication.

The anonymous boundary is `get_public_participant_profile(text)`. Anonymous users have no direct profile-table access. The security-definer function uses a fixed safe search path, requires the referenced revision to be approved, and projects only visibility-approved data. It omits consent internals, review notes, user IDs, audit data, routes, endpoints, and arbitrary URLs. Social output is structured as allowlisted platform plus validated handle; the browser constructs known HTTPS platform URLs.

The DJR renderer treats Supabase as optional. Static contact/footer content remains on fetch error or an empty response. A successful projection replaces only its applicable contact card and adds validated social links. Hidden or disabled values never enter the DOM.

Audit events contain only revision number, review-request ID, and status transition for submission, changes requested, approval, and published-revision changes. They contain no profile content, email, or phone.

## Deployment and rollback

Apply SQL in this order:

1. `supabase/studio-auth-schema.sql`
2. `supabase/studio-participant-profile-schema.sql`
3. `supabase/studio-participant-profile-review-schema.sql`
4. `supabase/studio-participant-profile-djr-bootstrap.example.sql` if the DJR profile was not seeded
5. `supabase/studio-staff-reviewer-bootstrap.example.sql` after replacing its placeholder in the SQL Editor

The Phase 4 migration is additive and preserves profile, revision, review, access, invite, participant, user, and audit data. To roll back public rendering, remove the DJR module tags first. Revoke anonymous execution on `get_public_participant_profile(text)` to close the public boundary. Do not delete historical revisions; repoint or clear `published_revision_id` through a reviewed operational change.

## Production acceptance checklist

- Sign in as an owner: save, preview, consent, and submit; confirm the revision becomes read-only.
- Sign in as unrelated, contributor, or owner-only users: confirm `/studio/reviews/` is denied and no Staff Reviews link appears.
- Sign in as staff: inspect queue/detail and request changes with required notes.
- As owner: see notes, create a revised draft, and confirm the prior revision is unchanged.
- Submit again; as a different staff user approve after the confirmation dialog.
- Confirm the approved revision is published, cannot be edited, and repeat approval fails.
- Visit `/djr/` and `/djr/contact.html`: only visible approved fields appear.
- Disable Supabase/network access and confirm static DJR content remains.
- Query as anonymous: the public RPC works and direct table reads remain denied.
- Confirm no Cody route, navigation, template, or participant artifact exists.
