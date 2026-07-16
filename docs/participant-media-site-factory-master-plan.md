# Who's to Say Participant Media Site Factory — Master Plan

_Last updated: 2026-07-14_

## Purpose

This document is the working source of truth for the Who's to Say participant media-site system.

The project is no longer just a website-management task. The larger product direction is a repeatable system for creating media-rich personal websites for participants under the Who's to Say Foundation umbrella.

The core hook:

> Who's to Say can help participants build personal brands, organize media, tell their stories, and publish polished personal microsites quickly.

This should support the Foundation's mission by giving participants visible creative work, public-facing storytelling, and guided brand-first thinking.

---

## Product North Star

Build a **Participant Media Site Factory**.

The system should make it easy to:

1. Create/manage participant media in the Media Hub.
2. Create a participant page from a reusable template.
3. Apply a participant brand voice and design system.
4. Connect sections of the page to albums and selected photos.
5. Preview the page before publishing.
6. Publish through a safe review workflow.
7. Reuse the same structure for future participant templates.

The intended user experience is:

```text
Create/manage album → copy/select media → open Participant Pages → edit safe section copy → choose photos visually → preview actual page → publish
```

---

## Current Architecture

### 1. Media Hub

Current public/admin media surface:

```text
/albums.html
/album.html?album=<album-uuid>
```

Media source of truth:

```text
Supabase albums/photos/storage
```

The media hub is responsible for:

- Albums
- Album UUIDs
- Photo IDs
- Photo ordering
- Album slideshow/gallery views
- Uploads
- Public/private album logic
- Future album sections/chapters

Participant Pages should not upload duplicate images. They should consume media from the Media Hub.

### 2. Participant Pages CMS

Current CMS surface:

```text
/admin/ → Participant Pages → DJR Participant Page
```

Current data file:

```text
content/participant-pages/djr.json
```

Participant Pages is now the preferred participant-facing editing workflow.

Participant Pages supports:

- Participant name
- Slug
- Template
- Default Album ID
- Section on/off
- Custom text on/off
- Section text editing
- Album image override on/off
- Album UUID per section
- Image mode
- Selected photo IDs
- Image limit
- Service/gallery-type offerings

### 3. DJR Public Page

Current route:

```text
/djr/
```

The DJR page uses the existing DJR visual design and loads official/default fallback content from:

```text
content/djr/home.json
```

Participant Pages overlays can safely update selected fields and images without changing layout.

### 4. DJR Service Offering Pages

Current route pattern:

```text
/djr/service.html?service=<service-id>
```

Purpose:

- Public visual offering pages for types of photography David wants to shoot.
- Service/gallery type pages should surface the album slideshow as the primary way to see the work.

Examples:

```text
/djr/service.html?service=behind-the-lens
/djr/service.html?service=sports-energy
```

### 5. CMS Preview

Participant Pages uses a Decap CMS preview that embeds the actual DJR page in an iframe.

Preview mode uses:

```text
/djr/?cmsPreview=participant-pages&previewSlug=djr
```

Draft CMS data is written to sessionStorage for preview only. Public pages should not expose draft data unless the preview query is present.

---

## Key Design Decisions

### Albums are the source of truth for media

Use Supabase albums/photos, not Decap JSON albums.

Do not reintroduce the old JSON CMS Album card workflow.

### Participant Pages are overlays, not full layout editors

Participants/admins can edit safe fields:

- Titles
- Eyebrows
- Body copy
- Quotes
- Service summaries
- Package descriptions
- Album UUIDs
- Selected photo IDs
- Section toggles

Participants/admins should not edit:

- Raw HTML
- Layout code
- Script paths
- Global navigation
- Form actions unless explicitly safe
- Storage internals

### Fallbacks are required

If participant overlay content is blank, invalid, or unavailable, the live site should preserve official/default content.

Fallback content currently lives primarily in:

```text
content/djr/home.json
```

### Section-level media control matters

Each participant page section should be able to have its own album and selected images.

Current media controls include:

```text
allowParticipantAlbum
albumId
imageMode
selectedPhotoIds
imageLimit
displayMode
```

### Service/gallery type cards are offerings

The DJR "services" section is not generic services. It represents gallery/service types David wants to shoot or offer.

Participant-facing language may include:

```text
What David Sees
Photography With a Point of View
Photography Services / Gallery Types
```

Each service offering can connect to its own service page and album slideshow.

---

## Current DJR Sections

Current participant-editable sections should include:

```text
Hero
Story / The Photographer
Featured Story
About David
Creative Feature
What David Sees / Photography Services
CTA / Contact
```

The section formerly known internally as `services` powers:

```text
What David Sees
Photography With a Point of View
```

It contains service/gallery-type cards such as:

- Behind the Lens
- Human Moments
- Creative Details
- Sports Energy
- The Bigger Dream
- Point of View

---

## Media Selection Model

### Album-level selection

A section can use an album UUID and image limit:

```json
{
  "allowParticipantAlbum": true,
  "albumId": "<album-uuid>",
  "imageMode": "albumOrder",
  "imageLimit": 4
}
```

### Manual photo selection

A section can use selected photo IDs from the same album:

```json
{
  "allowParticipantAlbum": true,
  "albumId": "<album-uuid>",
  "imageMode": "manualSelection",
  "selectedPhotoIds": ["<photo-id-1>", "<photo-id-2>"],
  "imageLimit": 4
}
```

### Single photo selection

A section can use one selected photo:

```json
{
  "allowParticipantAlbum": true,
  "albumId": "<album-uuid>",
  "imageMode": "singlePhoto",
  "selectedPhotoIds": ["<photo-id>"],
  "imageLimit": 1
}
```

### Important rule

Selected photo IDs must belong to the selected album.

If a photo does not belong to the album or cannot be resolved, the renderer should skip it and fall back safely.

---

## Known Current State

Completed:

- Participant Pages CMS exists.
- DJR Participant Page config exists.
- Section-level album controls exist.
- Text boxes are seeded with current DJR copy.
- Live page preview iframe exists.
- Service offering pages exist.
- Service pages can use slideshow/grid display modes.
- Visual photo selector has been implemented for selectedPhotoIds.
- Media Hub exposes Album UUID and Photo ID copy controls, with recent UX adjustment to avoid cluttering the grid.

Areas still needing QA / polish:

- Confirm the visual photo selector is reliable in Decap after hard refresh.
- Confirm service pages use slideshow as the main public "see the work" experience.
- Confirm photo detail view exposes Photo ID without cluttering the gallery grid.
- Confirm selected photos update `/djr/` and `/djr/service.html` previews as expected.
- Confirm no raw UUIDs show on public-facing service pages except in admin/media-hub contexts.

---

## Platform Direction

### Stay the course short-term

Continue using the current static site + Decap + Supabase + Vercel setup while validating the product model.

Short-term goal is not to build a perfect CMS. It is to prove the participant media-site workflow.

### Do not rebuild in Drupal yet

Drupal may become useful later if the Foundation needs:

- Formal editorial roles
- Complex permissions
- Revisions/audit trails
- Structured content governance
- Larger team workflows

But a Drupal rebuild now would slow validation.

### Consider a future Studio app

A future Who's to Say Studio could be a dedicated app, potentially Next.js + Supabase, for:

- Participant profiles
- Media Hub
- Template creation
- Brand kits
- AI-assisted page drafting
- Preview/approval
- Publishing

For now, continue abstracting toward that future while shipping useful improvements in the current repo.

---

## Next Phase: Brand Voice / Design System

The next major phase should introduce participant brand-first thinking.

This is not just visual styling. It should teach participants:

- Who am I publicly?
- What story am I telling?
- What do I want people to feel?
- What kind of images represent me?
- What words sound like me?
- What services, projects, or ideas do I want to be known for?

### Brand Kit version 1 architecture

Brand Kit version 1 uses a hybrid ownership model:

```text
content/participant-brand-kits/{slug}.json → identity, audience, voice, messaging, visual direction, approved presets
content/participant-pages/{slug}.json      → template, page sections, Media Hub album/photo selections
participant template                      → route, structure, layout, safe links, and preset implementation
```

Participant Pages reference a kit by slug. The safe normalizer returns only allowlisted metadata and cannot override routes, forms, navigation, albums, scripts, HTML, raw CSS, arbitrary URLs, or layout. See `docs/participant-brand-kit-schema.md`.

The initial DJR kit records existing direction without changing `/djr/`. Cody's kit is draft planning data only and does not create a route, navigation item, page, or template.

### Brand Kit Visual Workshop v1

The CMS now turns the Brand Kit into a guided workshop with progress, comfort, skip-for-now, and staff-support choices for each major brand area. A visual Brand Board helps participants see identity, voice, palette, typography, buttons, cards, photo direction, CTA intent, and overall progress together.

Colors are selected from curated, accessible palettes rather than raw hex inputs. Palette token examples exist only in the closed design registry and CMS presentation code. They are not applied to public participant pages yet. The Brand Board is a workshop artifact, not a Cody or DJR public-page preview.

### Brand Kit concept

Each participant should eventually have a brand kit:

```json
{
  "participantId": "cody",
  "brandName": "The Accidental Advocate",
  "tagline": "A voice that found its way forward.",
  "voice": "direct, warm, bold, reflective",
  "colors": {
    "primary": "deep navy",
    "accent": "gold",
    "background": "warm white"
  },
  "typeStyle": "bold editorial",
  "photoStyle": "documentary, candid, public voice",
  "toneWords": ["clear", "human", "steady", "brave"],
  "avoid": ["pity language", "overly polished corporate tone"]
}
```

### Brand Voice fields

Recommended fields:

```text
Brand name
Tagline
Short bio
Long bio
Voice/tone
Audience
Key message
Words to use
Words to avoid
Calls to action
Service/story themes
Photo style notes
Color mood
Design style
```

### Design System fields

Recommended fields:

```text
Primary color
Accent color
Background style
Typography style
Button style
Card style
Image treatment
Logo/wordmark style
Section rhythm
Motion/interaction preference
```

These should be constrained by template-safe options, not raw CSS.

---

## Next Participant Template: Cody — The Accidental Advocate

Cody should not use the DJR Photography template.

Cody's page should be advocacy/story/public voice focused.

Working template name:

```text
accidental-advocate
```

Possible route:

```text
/participants/cody/
```

or, if a branded microsite is desired:

```text
/cody/
```

Recommended sections:

```text
Hero
Origin Story
What I Advocate For
In My Own Words
Moments That Matter
Speaking / Community
Invite / Connect
```

Possible media mapping:

```text
Hero → portrait album
Origin Story → personal/family album
What I Advocate For → advocacy/community album
In My Own Words → video/audio later
Moments That Matter → mixed media album
Speaking / Community → event album
CTA → no album required
```

### Cody template goals

Cody's page should communicate:

- His public voice
- His advocacy identity
- His lived experience
- His invitation to be heard, included, or invited
- His community moments

It should not feel like a photography portfolio.

---

## Recommended Roadmap

### Immediate QA

1. Confirm visual photo selector works in Participant Pages.
2. Confirm selected photos update DJR page and service pages.
3. Confirm service slideshow works well on desktop/mobile.
4. Confirm Media Hub copy controls are useful but not visually cluttered.

### Short-term build

1. Add/clean Brand Kit schema.
2. Add Brand Voice fields to Participant Pages or new Brand Kits collection.
3. Build Cody planning document and template schema.
4. Implement Cody as the second template.

### Medium-term build

1. Create reusable participant template registry.
2. Add Create Participant Page workflow.
3. Add AI-assisted copy drafting.
4. Add album sections/chapters in Media Hub.
5. Add “Use this album/photo on participant page” actions.

### Long-term build

1. Who's to Say Studio app.
2. Multi-participant dashboard.
3. Role-based permissions.
4. Approval workflow.
5. Media usage tracking.
6. Template marketplace/library.

---

## Codex/Cursor Working Rule

For small scoped changes, Codex/Cursor should complete the full workflow:

1. Inspect relevant files.
2. Make only the requested scoped changes.
3. Run validation.
4. Show `git diff --stat` and `git diff --name-status`.
5. Commit if validation passes and diff is clean.
6. Push to the agreed branch.
7. Report commit SHA, files changed, validation run, and test URLs.

Stop before pushing only if:

- Validation fails.
- Merge conflicts occur.
- Unexpected files are touched.
- The diff introduces redesign files or unrelated work.
- Production-critical auth/routing/secrets are affected.

---

## Guardrails

Do not reintroduce:

```text
Old CMS Album card on /djr/
Decap JSON albums as participant media source
assets/css/djr.css redesign path
content/djr.json redesign path
js/djr-gallery.js redesign path
```

Do preserve:

```text
content/djr/home.json as fallback/default content
/albums.html as media source of truth
Supabase album/photo model
Participant Pages as participant-facing editor
Safe preview-before-publish workflow
```

---

## Useful Test URLs

```text
https://www.whostosay.org/admin/
https://www.whostosay.org/admin/config.yml
https://www.whostosay.org/content/participant-pages/djr.json
https://www.whostosay.org/albums.html
https://www.whostosay.org/djr/
https://www.whostosay.org/djr/?admin=1
https://www.whostosay.org/djr/service.html?service=behind-the-lens
https://www.whostosay.org/djr/service.html?service=sports-energy
```

---

## Next Recommended Task

Start the Brand Voice / Design System planning layer.

First task should be plan-only unless the structure is already agreed:

```text
Plan the Brand Kit and Design System model for Participant Pages.

Goal:
Create a reusable brand-first layer that can support DJR, Cody — The Accidental Advocate, and future participants.

Output:
- Brand Kit schema
- Design token schema
- Participant template relationship
- CMS fields
- Renderer behavior
- Cody template implications
- Migration plan from DJR-only system to reusable participant system
```

# DJR safe display-copy extension

The DJR first implementation now treats service-card media, contact-page copy, and footer display wording as Participant Pages concerns. Media still resolves from public Media Hub albums. Form behavior, routes, navigation, destinations, layout, and executable content remain template/admin concerns, with existing public content as the failure-safe fallback.
