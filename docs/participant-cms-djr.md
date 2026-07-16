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
- `content/participant-brand-kits/djr.json` records reusable DJR identity, voice, messaging, visual direction, and constrained design presets.
- `js/participant-pages/brandKit.js` safely loads and normalizes Brand Kits through an explicit allowlist.
- `js/participant-pages/albumImages.js` loads public Supabase album images from albums created in `/albums.html`.

The DJR Participant Page references the DJR Brand Kit with `"brandKit": "djr"`. Version 1 loads that metadata but does not apply visual presets or redesign the page. Existing DJR content and styles remain the public fallback and visible source.

## CMS workflow

Participant Pages is the main participant-facing CMS workflow.

Editors should use:

```text
/admin/ -> Participant Pages -> DJR Participant Page
```

That screen exposes grouped DJR page sections where a participant or support person can:

- Turn supported sections on or off.
- Use custom text per section.
- Edit safe copy fields that are populated with the current DJR page text.
- Use album images per section.
- Paste Supabase album UUIDs from `/albums.html`.
- Choose album order, manual selected photos, or a single selected photo for supported image sections.
- Use the visual Selected Photos widget to load album thumbnails and choose photos for manual or single-photo selection.
- Manage DJR service offerings, which are the public photography/gallery types shown on the homepage.

The Decap preview pane for Participant Pages uses `admin/preview-templates/participant-page-preview.js` and scoped preview CSS. It writes the current draft participant page config to same-origin `sessionStorage`, then renders the real `/djr/` page in an iframe at `/djr/?cmsPreview=participant-pages&previewSlug=djr`. The public `/djr/` URL does not read draft preview data.

The preview auto-updates as editors change fields before publishing. `Refresh Preview` only reloads the iframe when the embedded page looks stale; it does not change form data. Actual publishing still happens through the Decap save/publish workflow.

To revert text for a section without deleting draft text, turn off `Use custom text for this section`. To revert images for a section without deleting the album UUID, turn off `Use album images for this section`.

The old `DJR Photography` collection is hidden and labeled as an advanced/admin legacy fallback. It is not the normal participant editing workflow.

## Service offerings

The DJR homepage service cards represent David's photography offering types:

- Behind the Lens
- Human Moments
- Creative Details
- Sports Energy
- The Bigger Dream
- Point of View

Each card links to a public DJR service offering page at `/djr/service.html?service=<serviceId>`. These pages are visual public pages, not raw albums and not media-hub/admin screens. They use the DJR chrome, a visual gallery grid, a service description, package bullets, and a contact CTA.

Service offering pages use slideshow as the default public "see the work" experience. Editors can still choose `grid` for a service item when a tiled gallery is a better fit.

In Participant Pages, the `services` section can safely edit:

- Services section visibility, eyebrow, and title.
- Each service's `serviceId`, title, category/icon, summary, description, package bullets, album UUID, image mode, selected photo UUIDs, image limit, display mode, and CTA label.

Service images come from `/albums.html` and Supabase albums. To connect a service card to images:

1. Create or manage the album in `/albums.html`.
2. Copy the Album UUID.
3. Paste it into that service offering's `Album UUID`.
4. Leave `Image Mode` as `Album order`, or choose manual/single-photo mode and paste Photo UUIDs copied from the opened photo detail view.
5. In `Selected Photos`, load the Album UUID and click thumbnails to choose or reorder the photos shown on the service page.

Blank, invalid, private, missing, empty, or blocked service albums fall back to the default DJR service card image from `content/djr/home.json`. Button URLs remain admin-owned; the participant-facing CTA label links to the DJR contact page.

## Media model

`/albums.html` and Supabase albums are the media source of truth.

Participant Pages does not upload media and does not create Decap JSON albums. It stores UUID references only:

- `defaultAlbumId`
- `sections.hero.albumId`
- `sections.story.albumId`
- `sections.featured.albumId`
- `sections.about.albumId`
- `sections.creative.albumId`
- `sections.*.imageMode`
- `sections.*.selectedPhotoIds`
- `services.items.*.albumId`
- `services.items.*.imageMode`
- `services.items.*.selectedPhotoIds`

For each section, album overlays apply only when `allowParticipantAlbum` is true. A section album UUID wins over `defaultAlbumId`. Blank, invalid, private, missing, empty, or blocked albums preserve the default images from `content/djr/home.json`.

`imageMode` controls how section photos are selected:

- `albumOrder` uses the album's ordered photos up to `imageLimit`.
- `manualSelection` uses `selectedPhotoIds` in the listed order, then fills any remaining slots from album order.
- `singlePhoto` uses the first `selectedPhotoIds` value and treats `imageLimit` as 1.

Photo IDs are resolved inside the selected Album UUID. The Album UUID and Photo UUID must match: if a selected photo is not in the resolved album, it is skipped. Unknown, blocked, missing, or non-image photo IDs are skipped. If manual selection is empty, the renderer falls back to album order. The current Decap editor uses native text/list fields for photo IDs; a visual album photo picker is the recommended next UX improvement.

New selections should use Photo UUIDs copied from the opened photo detail view in `/albums.html`. The renderer also preserves older album-scoped selected photo IDs already saved in CMS content so existing draft selections are not discarded during Participant Pages updates.

Participant Pages includes a visual Selected Photos widget for `selectedPhotoIds`. It loads thumbnails from the album, writes selected `photos.id` values into the page config, preserves selected order, and keeps an advanced/manual ID details area for fallback troubleshooting.

Examples:

- One image: set `imageMode` to `singlePhoto`, paste the section's Album UUID, then add one Photo UUID to `selectedPhotoIds`. The renderer uses that one photo and ignores `imageLimit`.
- Multiple images: set `imageMode` to `manualSelection`, paste the section's Album UUID, add Photo UUIDs to `selectedPhotoIds` in the order they should appear, and set `imageLimit` to the desired count.
- Album order: set `imageMode` to `albumOrder`, paste the Album UUID, leave `selectedPhotoIds` empty, and set `imageLimit`.

In `/albums.html`, open an album to copy the Album UUID from Page Builder Info. Open an individual photo to copy the Album UUID and Photo UUID together for Participant Pages.

## Safe participant fields

Participant Pages can safely expose:

- Page identity: `name`, `slug`, `template`.
- Page media default: `defaultAlbumId`.
- Section visibility: `sections.*.enabled`.
- Participant edit gate: `sections.*.allowParticipantEdit`.
- Album edit gate: `sections.*.allowParticipantAlbum`.
- Album UUIDs: `sections.*.albumId`.
- Image mode: `sections.*.imageMode`.
- Selected photo UUIDs: `sections.*.selectedPhotoIds`.
- Image limits for supported image sections.
- Hero tagline.
- Story eyebrow, title, lead, body, and quote.
- Featured eyebrow, title, body, and button label.
- About eyebrow, title, and body.
- Creative feature eyebrow, title, and body.
- CTA title, supporting text, and button label.
- Service offering eyebrow, title, category/icon, summary, description, package bullets, image selection settings, display mode, and CTA label.

Text fields are intentionally populated with the current DJR copy so editors can revise what is already on the page. Blank text fields do not erase fallback content. Text overlays apply only when `allowParticipantEdit` is true.

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
7. Links service cards to `/djr/service.html?service=<serviceId>` when a safe service ID exists.

For `/djr/service.html`, the same renderer:

1. Reads the `service` query parameter.
2. Loads the default DJR home content plus the Participant Pages service overlay.
3. Finds the matching enabled service offering.
4. Loads album images through `js/participant-pages/albumImages.js`.
5. Renders a visual public service page with no UUIDs, upload controls, or media-hub/admin UI.

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
- Image mode is `albumOrder`, `manualSelection`, or `singlePhoto`.
- Selected photo IDs are valid Supabase UUIDs.
- Slugs, raw URLs, Google Photos URLs, and `/album.html?album=` URLs are rejected as album IDs.
- The DJR homepage does not load the old CMS album card script.
- DJR service IDs are slug-safe.
- DJR service album IDs are blank or valid Supabase UUIDs.
- DJR service display modes are allowlisted.
- The advanced DJR collection is hidden/de-emphasized.
- Decap does not expose `content/djr-albums` as participant media.
