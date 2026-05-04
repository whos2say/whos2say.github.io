# Photo Album App

This repo contains the existing static Who's to Say Photo Album App. It is still GitHub Pages compatible: the album list, individual album page, upload page, and smoke-test page run as plain HTML/CSS/ES modules.

## Current App Overview

- `albums.html`: album list, album creation, public/private visibility, admin owner/contributor controls, delete, drag reorder, gallery title sizing.
- `album.html`: individual album view, image/video grid, lightbox, comments, downloads, cover photos, bulk selection, moving, deletion, drag reorder, focal point editing, cropping, slideshow selection, sharing, and music tools.
- `upload.html`: drag/drop upload, image resizing, HEIC conversion, video validation, face-based focal point detection, Google Photos import.
- `photo-album-test.html`: small Supabase smoke-test helper.
- `js/supabase.js`: Supabase client initialization. Use only publishable/anon client keys and rely on RLS for security.

## Local Smoke Test

Start a static server from the repo root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/albums.html`.

Basic flow:

1. Confirm `js/supabase.js` points at the intended non-production or safe test Supabase project.
2. Visit `login.html` and sign in.
3. Create an album from `albums.html`, or create a row in Supabase Studio and copy the album UUID.
4. Open `upload.html?album=THE_ALBUM_UUID` and upload a small image.
5. Open `album.html?album=THE_ALBUM_UUID` and confirm the photo renders, opens in the lightbox, and can receive a comment when signed in.

For local password testing from the browser console:

```js
import { supabase } from './js/supabase.js'
await supabase.auth.signInWithPassword({ email: 'you@example.com', password: 'yourpassword' })
```

## Module Structure

Phase 1 introduced a thin reusable layer under `js/photo-album/`:

- `config.js`: app constants such as bucket names, admin email, media limits, and focal point defaults.
- `services/authService.js`: current user, admin check, sign out, require-user redirect.
- `services/albumService.js`: album table queries, updates, deletes, owner/admin RPC helpers, site settings.
- `services/photoService.js`: photo table reads, inserts, updates, deletes, cover/latest helpers.
- `services/storageService.js`: storage public URL, upload, and remove helpers.
- `services/commentService.js`: comment read, create, delete helpers.
- `utils/dom.js`: URL/query and small DOM helpers.
- `utils/media.js`: video/HEIC/focal point media helpers.
- `utils/html.js`: HTML escaping helpers.

The existing page controllers still own rendering and most feature orchestration. This was intentional to avoid changing behavior during the first extraction.

## Supabase Setup

See `supabase/photo-album-schema.sql` for inferred tables, storage notes, indexes, and draft RLS policy notes.

Core resources currently implied by the app:

- Tables: `albums`, `photos`, `album_contributors`, `photo_comments`, `site_settings`.
- Also used by `album.js`: `music_tracks`.
- Storage buckets: `photos`, `music`.
- RPC helpers: `get_user_id_by_email`, `get_album_owner_emails`, `get_album_contributors`, `get_album_users`.

## Known Limitations

- `js/album.js` remains highly coupled and still contains direct Supabase calls for complex album, music, move, focal point, and crop flows.
- Admin identity is currently hard-coded by email in client code and must be enforced by RLS/server-side policy.
- Google Photos, face detection, HEIC conversion, Cropper.js, and QR generation depend on third-party browser/CDN resources.
- Schema/RLS documentation is inferred from app usage and should be reviewed before production migration.
- Static routing is hard-coded around `.html` pages.

## Next Refactor Phases

1. Replace remaining direct Supabase calls in page controllers with service methods.
2. Split `js/album.js` into focused feature modules: photo grid, lightbox, comments, selection, music, crop, slideshow selector, sharing.
3. Add permission/capability helpers so UI decisions are reusable outside this static site.
4. Add lightweight static/browser smoke tests for album list, album load, upload validation, comments, and owner controls.
5. Introduce adapters for a future Next.js app, participant portfolio app, and WTS Creator Platform while preserving the current static app.
