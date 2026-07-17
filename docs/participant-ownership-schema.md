# Participant Ownership Registry Schema

## Purpose

The ownership registry records which page, Brand Kit, and Media Hub albums belong to a participant and which authenticated users may eventually be assigned to that participant. Version 1 is governance metadata only. It does not authenticate users, enforce authorization, expose participant contact or social fields, or change public rendering.

Registry files live at `content/participants/{slug}.json`. Participant Pages remain in `content/participant-pages`, Brand Kits remain in `content/participant-brand-kits`, and Supabase Media Hub albums remain the source of truth for images.

Version 1 includes an active DJR registry and a draft Cody registry. DJR connects to its existing Participant Page, Brand Kit, and assigned albums. Cody connects only to its draft Brand Kit and has a blank page reference, no assigned albums, and no public route or template.

## Version 1 fields

- `schemaVersion`: Must be `1`.
- `participantId`: Stable, immutable identifier using the `participant-{slug}` format. Public slugs may change later; this identifier should not.
- `slug`: Registry filename slug.
- `displayName`: Plain-text administrative label.
- `status`: `draft`, `active`, `inactive`, or `archived`.
- `resources.pageSlug`: Existing Participant Page slug, or blank when no page is authorized. Cody remains blank and draft.
- `resources.brandKitSlug`: Existing Brand Kit slug.
- `resources.albumIds`: Supabase album UUIDs assigned to the participant. Albums and photos continue to be managed in the Media Hub.
- `access`: Future authenticated user assignments. These arrays stay empty until Studio identity records exist and are not authorization in the static repository.
- `reviewRequirements`: Review policy for page copy, Brand Kit work, media selections, service claims, and publishing.

The safe normalizer accepts only these fields. It discards routes, navigation, templates, forms, URLs, HTML, CSS, scripts, layout instructions, contact data, social profiles, and other public behavior controls.

## Reference rules

1. `slug` must match the registry filename.
2. A nonblank `pageSlug` must resolve to `content/participant-pages/{pageSlug}.json` and that page must reference the same Brand Kit.
3. A nonblank `brandKitSlug` must resolve to `content/participant-brand-kits/{brandKitSlug}.json`.
4. Every nonblank album UUID used by a participant page must appear in that participant's assigned `albumIds`.
5. Draft registry data does not authorize a public route. Cody has no page reference and must not gain a route, navigation item, page, or template from this file.

## Authentication versus authorization

The next Studio phase should support Google OAuth through Supabase Auth. Google OAuth proves an external identity and helps users sign in; it is not the authorization system.

Authorization must come from Who's to Say data and Supabase row-level security using:

- `participants`
- `user_roles`
- `participant_user_access`
- `participant_album_access`
- `review_requests`
- `publish_events`
- `audit_events`

Studio must map a verified Supabase Auth user to those records before permitting access. A Google account, email domain, OAuth claim, hidden CMS field, or registry JSON entry must never independently grant participant access or publishing authority.

See `docs/studio-auth-plan.md` for provider and redirect configuration and `supabase/studio-auth-schema.sql` for the conservative additive schema/RLS draft.

## Participant Profile drafts

Participant contact/social editing now belongs to the separate private Participant Profile draft model, not the Registry, Participant Page, or Brand Kit. See `docs/participant-profile-schema.md`.

Registry JSON still does not store contact information, social links, route behavior, navigation, layout, raw HTML, raw CSS, or arbitrary URLs. Studio authorization for Profile drafts comes from `participant_user_access` plus RLS capabilities such as `can_edit_profile` and `can_submit_review`.

## Not included in version 1

- Authentication or authorization enforcement inside registry JSON. The separate Studio shell can establish a Supabase Auth identity, but registry files do not grant access.
- Participant-facing CMS access.
- Contact or social profile fields.
- Public renderer integration.
- Cody routes, navigation, pages, or templates.
- Album creation or image storage outside the Media Hub.

## Current operating model

Decap is operated by trusted staff as a temporary editing and review surface. Git history, previews, structured fields, and contract tests help governance, but Decap collection configuration does not enforce per-participant authorization. Registry `access` arrays remain empty until authenticated Studio user IDs and enforceable policies exist.

No public renderer loads the Participant Registry in version 1. The authenticated Studio dashboard may read it only to enrich authorized read-only cards or provide a clearly labeled registry preview filtered by the current Supabase user UUID. Adding or editing a registry record cannot create a route, publish a page, change navigation, expose contact/social data, or apply a Brand Kit preset.

Production registry fallback is disabled. Registry preview is limited to localhost or explicit `registryPreview=1` diagnostics and is never enforced authorization. Production participant access comes from RLS-filtered `participant_user_access`; admin-created `participant_access_invites` may create those rows only through the no-argument, verified-email claim RPC.
# Participant Profile review boundary

Participant ownership permits draft editing and submission only. Publishing is staff-only, enforced by `user_roles` and security-definer review RPCs; owners cannot self-approve.
