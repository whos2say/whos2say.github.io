# Photo Album Engine Audit

Date: 2026-05-03

## Current Files

- `PHOTO_ALBUM_README.md`: local setup and smoke-test notes.
- `albums.html`: album index, create-album form, admin owner/contributor/privacy/order controls, gallery title sizing.
- `album.html`: individual album UI, lightbox, comments, selection, moving, deletion, cover/focal controls, slideshow selector, music tools, crop modal, share tools.
- `upload.html`: upload UI, drag/drop flow, Google Photos import entry point, iOS/iCloud hint.
- `photo-album-test.html`: standalone Supabase smoke-test helper.
- `js/albums-index.js`: album index controller and admin management logic.
- `js/album.js`: individual album controller; largest current coupling point.
- `js/upload.js`: upload controller, media preparation, Google Photos import handler.
- `js/google-photos.js`: Google Photos Picker integration and media download helper.
- `js/supabase.js`: Supabase client config.
- `assets/css/styles.css`: shared site styles.
- `assets/css/photo-album.css`: extracted photo album app styles.

## Feature Map

- Album index: list visible albums, public/private filtering, cover photo fallback, create album, delete album, drag reorder.
- Auth: Supabase Auth user lookup, login redirect, sign out, admin email check.
- Access controls: owner assignment, contributor management, admin preview mode, private album visibility filtering.
- Album page: load album metadata, load ordered photos, title edit, title size, upload link, public/private share metadata.
- Media display: image/video tiles, lightbox with image/video mode, download, dark-photo brightness analysis, optional enhancement.
- Comments: load, post, delete own/admin comments in `photo_comments`.
- Photo management: set cover, delete, bulk delete, move between albums, drag reorder, focal point editor.
- Upload: image resize, HEIC conversion, video validation, face-based focal point detection, Supabase Storage upload, `photos` insert.
- Imports: Google Photos Picker API integration with manual fallback for videos blocked by browser/CORS behavior.
- Slideshow/share: local slideshow selection config, QR/social sharing surfaces, analytics hooks.
- Music: album `music_url`, `music_tracks`, `music` storage bucket. This exists in the individual album page but was not part of the initial schema request.

## Data Flow

1. Browser loads static HTML from GitHub Pages.
2. Page modules import `js/supabase.js`, which initializes the Supabase client from public URL and publishable/anon key.
3. Auth state is read client-side with `supabase.auth.getUser()`.
4. Album index queries `albums`, optionally filters by owner/contributor IDs, then resolves cover photo paths from `photos`.
5. Album page queries one `albums` row and its related `photos` rows, then converts storage paths into public URLs.
6. Upload page writes binary objects into the `photos` storage bucket, then inserts matching `photos` table rows.
7. Comments are read and written directly from the lightbox through `photo_comments`.
8. Admin controls call table updates and helper RPC functions for auth-user lookup/email display.

## Supabase Tables And Storage Used

- `albums`: `id`, `name`, `created_at`, `owner_id`, `cover_photo_id`, `is_private`, `sort_order`, `music_url`, `title_size`.
- `photos`: `id`, `album_id`, `file_path`, `uploaded_by`, `created_at`, `focal_point`, `sort_order`.
- `album_contributors`: `album_id`, `user_id`, `added_at`.
- `photo_comments`: `id`, `photo_id`, `user_id`, `user_email`, `comment`, `created_at`.
- `site_settings`: `key`, `value`; currently used for `gallery_title_size`.
- `music_tracks`: `id`, `file_path`, `title`, `uploaded_by`, `created_at`; used by `album.js` music library.
- Storage bucket `photos`: public image/video objects, paths grouped by album ID.
- Storage bucket `music`: public audio objects for album music library.
- RPC helpers: `get_user_id_by_email`, `get_album_owner_emails`, `get_album_contributors`, `get_album_users`.

## Major Dependencies

- Supabase JS ESM CDN in `js/supabase.js`.
- Cropper.js CDN on `album.html`.
- QR code generator CDN on `album.html`.
- face-api.js global and model weights from jsDelivr in `upload.js`.
- heic2any global expected by `upload.js` for HEIC conversion.
- Google Identity Services and Google Photos Picker API in `js/google-photos.js`.
- Browser APIs: FileReader, Canvas, createImageBitmap, drag/drop, URL object URLs, localStorage.

## Risks

- `js/album.js` is a large controller mixing data access, DOM rendering, media utilities, lightbox, comments, music, crop, share, and slideshow behavior.
- Client-side admin checks use a hard-coded email and must be backed by RLS; the UI alone is not security.
- Schema expectations are spread across comments and query code rather than a canonical migration.
- Some features rely on optional tables/RPCs and silently degrade when missing.
- Public storage URLs assume buckets and CORS rules support browser rendering/download/canvas use.
- Google Photos and face detection depend on third-party network resources from a static page.
- Production Supabase credentials must not be committed as secrets; only publishable/anon keys belong in client code and still require RLS.

## Portability Blockers

- Direct Supabase client calls are still present in page controllers, especially around complex album/music flows.
- DOM IDs and data operations are tightly coupled; there is no framework-neutral state layer yet.
- Album permissions are partially encoded in page code instead of a reusable capability/authorization service.
- Inline generated HTML mixes presentation, user strings, and service responses.
- Music and share/slideshow features are embedded in `album.js` rather than isolated feature modules.
- Static path assumptions (`/album.html`, `/login.html`, `/api/proxy-video`) need adapters for Next.js or app shells.

## Recommended Refactor Phases

1. Phase 1: create thin service/util modules, extract photo-album CSS, document schema and portability. Keep static pages working.
2. Phase 2: finish replacing direct Supabase calls with service methods; split `album.js` by feature (`lightbox`, `comments`, `photoGrid`, `music`, `crop`, `slideshowSelector`).
3. Phase 3: introduce a small app state/model layer with plain data objects independent of DOM and Supabase.
4. Phase 4: move permission checks into reusable capability helpers backed by RLS assumptions.
5. Phase 5: add focused static/browser smoke tests for album list, album load, upload validation, comments, and owner controls.
6. Phase 6: create adapters for static GitHub Pages and Next.js without changing the core services.

## Phase 2 Update

Extracted low-risk album-page behavior into `js/photo-album/features/album/`:

- `toast.js`: owns the existing toast DOM creation, CSS classes, timing, and removal behavior.
- `permissions.js`: centralizes the current client-side admin/comment checks and documents that these checks are UX only; Supabase RLS remains authoritative.
- `albumState.js`: introduces shared mutable album-page state for `currentAlbumId`, `coverPhotoId`, `currentUser`, `isAlbumOwner`, `isAdmin`, `selectedPhotos`, and `allPhotos`.
- `comments.js`: owns comment loading, rendering, posting, deletion, sign-in link behavior, and comment form binding while continuing to use `commentService`.
- `lightbox.js`: owns image/video lightbox open/close/navigation state, enhance button behavior, download button wiring, keyboard navigation, swipe gestures, and comment loading callback.

`js/album.js` remains the page-level controller. It now wires feature modules together and still owns album loading, photo grid rendering, title editing, cover handling, selection/bulk actions, move modal, drag reorder, focal point editing, downloads, music tools, slideshow selector, crop flow, share-panel integration, and analytics entry points.

Recommended next extraction order:

1. `photoGrid.js`: render photo/video tiles, dark-photo enhancement controls, cover/delete/reposition buttons.
2. `selection.js`: checkbox state, drag-select rectangle, bulk action bar, selected-photo counts.
3. `movePhotos.js`: move modal and album list loading.
4. `focalPoint.js`: reposition modal and focal-point persistence.
5. `crop.js`: Cropper.js modal, cropped copy upload, rollback handling.
6. `music.js`: music URL, music library, `music_tracks`, and `music` bucket behavior.
7. `slideshowSelector.js`: slideshow selection state, persistence, drag ordering, and start URL construction.

## PR Review Cleanup

The Phase 1 inline CSS extraction moved styles from `albums.html`, `album.html`, and `upload.html` into one shared `assets/css/photo-album.css` file. Because those styles were previously page-local, generic selectors such as `.album-info`, `.modal-buttons`, `.modal-btn`, `.modal-cancel`, `.album-option`, `.music-info`, `.upload-item`, and `.quality-warn` could leak across photo album pages after extraction.

Cleanup added page body classes:

- `albums.html`: `photo-album-page albums-page`
- `album.html`: `photo-album-page album-detail-page`
- `upload.html`: `photo-album-page upload-page`

The extracted CSS is now scoped by page section under `.albums-page`, `.album-detail-page`, or `.upload-page` so the static pages keep their original page-specific styling while still sharing one stylesheet.
