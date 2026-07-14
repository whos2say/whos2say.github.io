# DJR Participant CMS Status

This document describes the current DJR participant CMS boundary after consolidating participant-facing edits under Participant Pages.

## Current architecture

The DJR page is a static participant microsite under `/djr/`.

- `djr/index.html` is the public DJR landing page.
- `djr/galleries.html` and `djr/contact.html` are supporting static pages.
- `djr/js/djr-content.js` loads default DJR content from `content/djr/*.json`.
- `content/djr/home.json` remains the fallback/default homepage content.
- `content/djr/site.json` remains the admin-owned DJR chrome, nav, footer, contact, and partner content.
- `content/djr/galleries.json`, `content/djr/contact.json`, and `content/djr/section-gallery-map.json` remain advanced/admin fallback files.
- `content/participant-pages/djr.json` is the participant-facing page configuration and safe overlay source.
- `js/participant-pages/albumImages.js` loads public Supabase album images from albums created in `/albums.html`.

## CMS workflow

Participant Pages is the main participant-facing CMS workflow.

Editors should use:

```text
/admin/ -> Participant Pages -> DJR Participant Page
```

That screen exposes grouped DJR page sections where a participant or support person can:

- Turn supported sections on or off.
- Allow or block participant text edits per section.
- Edit safe non-empty copy fields.
- Allow or block participant album overrides per section.
- Paste Supabase album UUIDs from `/albums.html`.

The Decap preview pane for Participant Pages uses `admin/preview-templates/participant-page-preview.js` and scoped preview CSS. It renders the DJR participant page as section-by-section editing context, including status badges, safe text fields, album UUID references, image limits, and fallback notes for blank fields. The preview may load `/content/djr/home.json` for default copy context, but it does not fetch Supabase albums or render live thumbnails.

The old `DJR Photography` collection is hidden and labeled as an advanced/admin legacy fallback. It is not the normal participant editing workflow.

## Media model

`/albums.html` and Supabase albums are the media source of truth.

Participant Pages does not upload media and does not create Decap JSON albums. It stores UUID references only:

- `defaultAlbumId`
- `sections.hero.albumId`
- `sections.story.albumId`
- `sections.featured.albumId`
- `sections.about.albumId`
- `sections.creative.albumId`

For each section, album overlays apply only when `allowParticipantAlbum` is true. A section album UUID wins over `defaultAlbumId`. Blank, invalid, private, missing, empty, or blocked albums preserve the default images from `content/djr/home.json`.

## Safe participant fields

Participant Pages can safely expose:

- Page identity: `name`, `slug`, `template`.
- Page media default: `defaultAlbumId`.
- Section visibility: `sections.*.enabled`.
- Participant edit gate: `sections.*.allowParticipantEdit`.
- Album edit gate: `sections.*.allowParticipantAlbum`.
- Album UUIDs: `sections.*.albumId`.
- Image limits for supported image sections.
- Hero tagline.
- Story eyebrow, title, lead, body, and quote.
- Featured eyebrow, title, body, and button label.
- About eyebrow, title, and body.
- Creative feature eyebrow, title, and body.
- CTA title, supporting text, and button label.

Blank text fields do not erase fallback content. Text overlays apply only when `allowParticipantEdit` is true.

## Admin-only fields

These remain admin-owned:

- Global navigation and site settings.
- DJR nav, footer, social links, partner link/logo, and contact details.
- DJR contact form action and session type routing.
- Button hrefs and route URLs.
- Raw HTML fields.
- Layout controls.
- Upload widgets for participant page images.
- Photo Gallery App IDs and Google Photos URLs.
- Legacy `content/djr/section-gallery-map.json` source type mapping.
- JSON album media in `content/djr-albums`.

## Renderer behavior

For `/djr/`, `djr/js/djr-content.js`:

1. Loads default content from `content/djr/home.json`.
2. Loads `content/participant-pages/djr.json`.
3. Applies section visibility toggles where the existing renderer supports hiding.
4. Applies safe non-empty text overlays only when `allowParticipantEdit` is true.
5. Applies section album images only when `allowParticipantAlbum` is true.
6. Falls back to default content whenever participant fields are blank or album loading fails.

The renderer does not append new sections or cards. The old `djr/js/djr-section-galleries.js` card path is not loaded by `/djr/`.

## Validation

Run:

```bash
node scripts/test-djr-content-contract.mjs
```

The contract checks:

- The participant page config exists.
- Participant Pages exposes only approved safe fields.
- `enabled`, `allowParticipantEdit`, and `allowParticipantAlbum` are booleans.
- Album IDs are blank or valid Supabase UUIDs.
- Slugs, raw URLs, Google Photos URLs, and `/album.html?album=` URLs are rejected as album IDs.
- The DJR homepage does not load the old CMS album card script.
- The advanced DJR collection is hidden/de-emphasized.
- Decap does not expose `content/djr-albums` as participant media.
