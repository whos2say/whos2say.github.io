# Photo Album Upload Flow Audit

## 1. Purpose

This document is an audit-only checkpoint for the existing static Photo Album upload flow before any upload refactoring.

It records current behavior, service boundaries, Supabase assumptions, edge cases, and refactor risks without changing runtime code.

The current static Photo Album App remains the source of truth. Any future extraction should preserve the existing `upload.html` and `js/upload.js` behavior unless a later PR explicitly changes user-facing upload behavior.

No behavior changes were made to produce this document.

---

## 2. Current Upload Entry Points

| Entry | Role |
|---|---|
| `upload.html` | Static upload page shell: header, album ID display, Google Photos controls, drop zone, file input, upload status area, iOS hint, CDN scripts, and ES module `js/upload.js`. |
| `js/upload.js` | Upload orchestration: auth gate, album ID detection, drag/drop, file input, Google Photos import handoff, per-file processing, storage upload, photo row insert, status UI, and completion link. |

### Query parameters

The upload page expects an album identifier in the URL query string.

`getAlbumIdFromUrl()` accepts:

- `?album=...`
- `?id=...`

Existing navigation primarily uses:

```text
/upload.html?album=<album-uuid>
```

### Links to other pages

- `album.html` links to upload through `uploadBtnEl.href = /upload.html?album=${encodeURIComponent(currentAlbumId)}` in `js/album.js`.
- `albums.html` links users to album detail pages through `/album.html?album=...`.
- Upload is normally reached from the album detail toolbar, not directly from the album index.
- After upload completes, `js/upload.js` renders a **View Album** link to:

```text
album.html?album=<encodedAlbumId>
```

There is no visible album selection UI in `upload.html`; the page is tied to the album ID in the URL.

---

## 3. Current Upload Flow Map

### Page load

1. `upload.html` renders:
   - header/navigation
   - album ID display
   - Google Photos controls
   - drag/drop area
   - file input
   - upload status container
   - iOS hint area

2. Third-party browser scripts are loaded for:
   - Google Identity Services
   - HEIC conversion
   - face detection

3. `js/upload.js` reads DOM nodes at module load time and registers drag/drop and file input handlers.

4. On `DOMContentLoaded`, it reads the album ID from `?album=` or `?id=`.

### Auth/session check

- `DOMContentLoaded` calls `checkAuth()`.
- `checkAuth()` calls `getCurrentUser()` from `authService.js`, which wraps `supabase.auth.getUser()`.
- If no user is returned, the browser redirects to:

```text
/login.html?redirect=<currentPathAndSearch>
```

- If auth lookup throws, the browser redirects to:

```text
/login.html
```

The auth check is started on page load, but upload page behavior still relies on browser/runtime timing and RLS to enforce writes.

### Album detection

- If no album ID is present:
  - `uploadStatusEl` shows a no-album error.
  - The drop area is hidden.
- If an album ID exists:
  - it is displayed in `#album-id-display`.

Album existence is not checked on page load.

Album ID UUID validation happens inside `handleFiles()` per file.

### File selection and drag/drop

- `#file-input` accepts:
  - `image/*`
  - `.heic`
  - `.heif`
  - `video/mp4`
  - `video/quicktime`
  - `video/webm`
  - `video/x-m4v`
  - multiple files

- Drag events on `#drop-area`:
  - call `preventDefault()`
  - toggle the `drag-over` class
  - pass `dataTransfer.files` to `handleFiles()`

- File input changes pass `e.target.files` to `handleFiles()`.

### Google Photos import

- Google Photos import dynamically imports:

```text
./google-photos.js
```

- Successfully downloaded blobs are converted to `File` objects and passed into `handleFiles()`.
- Google Photos videos that cannot be imported directly are shown as manual download links.

### Preview behavior

Each file gets an `.upload-item` row with:

- filename
- status text
- eventual preview if successful

Images:

- HEIC/HEIF may be converted to JPEG.
- Images are resized when possible.
- Low-resolution warnings may be shown.
- Image preview appears after storage upload and DB insert succeed.

Videos:

- Videos are validated.
- Video preview appears after storage upload and DB insert succeed.

### Upload button behavior

There is no separate upload button.

Upload starts immediately when:

- files are selected
- files are dropped
- Google Photos import passes files into the upload flow

### Storage upload behavior

Files are processed sequentially in a `for...of` loop.

Videos:

- validated for max size
- validated for max duration
- uploaded as original video file

Images:

- HEIC/HEIF conversion happens when needed.
- resize output is generally JPEG.
- face detection attempts to compute a `focal_point`.
- fallback `focal_point` is used when detection fails.

Uploads go through `uploadFile()` from `storageService.js` into the configured `photos` bucket.

### Photos table insert behavior

After storage upload succeeds, `createPhoto()` from `photoService.js` inserts one `photos` row with:

- `album_id`
- `file_path`
- `uploaded_by`
- `focal_point`

The insert is one row at a time, even for multiple files.

No album row is updated during upload.

### Progress, error, and success messaging

Per-file status moves through messages such as:

- Processing
- Uploading
- success check mark
- error message

Errors are caught per file, logged to the console, and shown in the file row.

After all files are attempted, a completion panel renders with:

- number of successful uploads
- View Album link

The completion panel can appear even if the success count is `0`.

### Redirect or post-upload behavior

The page does not automatically redirect after upload.

Users manually click **View Album** to return to:

```text
album.html?album=<album-id>
```

---

## 4. Direct Supabase Usage

`js/upload.js` does not import `supabase` directly.

Its Supabase access goes through service helpers:

| Concern | Mechanism |
|---|---|
| Auth | `getCurrentUser()` from `authService.js`, wrapping `supabase.auth.getUser()` |
| Albums table | No direct album table calls in `js/upload.js`; no album existence lookup is performed |
| Photos table | `createPhoto()` from `photoService.js`, wrapping `supabase.from('photos').insert(values)` |
| Storage bucket | `uploadFile()` from `storageService.js`, wrapping `supabase.storage.from(bucket).upload(filePath, body, options)` |
| Public URL | `getPublicUrl()` from `storageService.js`, wrapping `supabase.storage.from(bucket).getPublicUrl(filePath)` |
| RPC calls | None in `js/upload.js` |

`js/supabase.js` initializes the Supabase browser client from the CDN ES module:

```text
@supabase/supabase-js@2/+esm
```

using the configured project URL and publishable anon key.

---

## 5. Existing Service Boundaries

### Existing services already reusable by upload

| Module | Current / possible upload use |
|---|---|
| `authService.js` | current user lookup, admin check, sign out, require-user redirect helper |
| `albumService.js` | album reads/creates/updates/deletes, owner/admin RPC helpers, site settings |
| `photoService.js` | photo reads, inserts, updates, deletes, cover/latest helpers |
| `storageService.js` | storage public URL, upload, and remove helpers |
| `config.js` | `photoBucket`, `musicBucket`, admin email, video limits, focal point defaults |
| `utils/dom.js` | `getAlbumIdFromUrl()` |
| `utils/media.js` | `isHeicFile()`, `isVideoFile()` |

### Current upload-specific gaps

- No upload service coordinates storage upload plus photos table insert.
- No rollback helper removes a storage object if the DB insert fails.
- No reusable filename/path builder owns the path convention.
- No reusable media preprocessing boundary owns:
  - resize
  - HEIC conversion
  - video validation
  - image dimension checks
  - focal point detection
- No upload controller boundary separates DOM rendering/events from upload orchestration.
- No album capability/permission service validates whether the signed-in user may upload to the target album before files begin.

---

## 6. DOM/UI Responsibilities Inside `js/upload.js`

`js/upload.js` currently mixes these UI/controller responsibilities:

- DOM node lookup for upload area, file input, status area, and album ID display
- page-load album ID rendering
- missing-album UI
- auth redirect orchestration
- drag/drop event registration
- visual drag-over state
- file input event registration
- Google Photos button setup
- Google Photos status messaging
- Google Photos setup note display
- manual video-download notice rendering
- iOS hint detection and display
- per-file status row creation
- status text/color updates
- low-resolution warning rendering
- image/video preview element creation
- completion panel rendering with View Album link
- inline error rendering in the latest upload item

---

## 7. Storage Behavior

| Topic | Behavior |
|---|---|
| Bucket | Uploads use the default `PHOTO_ALBUM_CONFIG.photoBucket`, currently `photos` |
| File path strategy | `${albumId}/${Date.now()}_${filename}` |
| Video filename strategy | Preserve extension, lowercase the base name, replace whitespace with underscores, and build `${baseName}${ext}` |
| Image filename strategy | Lowercase the base name and replace whitespace with underscores; JPEG output uses `${baseName}.jpg`, otherwise the original filename is used |
| Filename sanitization | Limited. Whitespace is replaced with underscores and base names are lowercased, but many special characters may remain |
| Content type handling | Videos use `file.type || 'video/mp4'`; images use converted/resized blob type, often forced to `image/jpeg` |
| Multiple file handling | Sequential and per-file |
| Upload options | `cacheControl: '3600'`, `upsert: false`, and `contentType` |
| Duplicate filename risk | `Date.now()` lowers collision risk; same-millisecond collisions remain theoretically possible |
| Rollback behavior | None. If storage upload succeeds and DB insert fails, the uploaded storage object is left behind |
| Public URL assumptions | The `photos` bucket is assumed public. Previews use `getPublicUrl(path)` after successful upload/insert |

---

## 8. Auth and Permissions Assumptions

- Upload is intended to require sign-in.
- The page redirects unsigned users to login with a return URL.
- `uploaded_by` is set to `user?.id || null`.
- Owner/admin status is not determined in `js/upload.js`.
- Album contributor capability is not checked client-side before upload.
- Existing RLS policies are assumed to enforce whether the signed-in user can upload storage objects and insert `photos` rows for the target album.
- Schema notes indicate owners/contributors can upload photos if policy allows contribution.
- `js/upload.js` itself does not enforce owner/admin/contributor roles.

---

## 9. Error Handling and Edge Cases

| Case | Current behavior |
|---|---|
| Missing album ID | Detected on page load; drop area hidden and error shown |
| Invalid album ID | Detected per file in `handleFiles()` using UUID regex; file row shows error |
| No files selected | `handleFiles()` returns without UI changes |
| Failed storage upload | Caught per file; file row shows storage error message |
| Failed DB insert | Caught per file after storage upload; no storage cleanup occurs, so orphaned files are possible |
| Partial multi-file failure | Loop continues after each per-file error; completion panel reports only successful uploads |
| Unsupported file types | Input restricts visible choices, but drag/drop can pass other files; non-video files are treated as images |
| Large videos | Rejected if above configured size limit |
| Long videos | Rejected if duration exceeds configured duration limit |
| Large images | No explicit pre-resize image size cap |
| Duplicate filenames | `Date.now()` lowers collision risk; `upsert: false` prevents overwrites |
| Mobile upload behavior | iPhone/iPad hint appears based on user agent; file input supports mobile photo library selection |
| Network interruption | Individual file upload/DB errors are caught and shown, but there is no retry, resume, cancellation, or rollback |
| Face detection failure | Model load/detection errors are logged as warnings and fallback to `50% 50%` |
| HEIC conversion unavailable | Throws a user-visible error for that file |
| Google Photos setup/import failures | Shown in `#google-photos-status`; setup note may be displayed |

### High-risk implementation note: `uploadFile` variable shadowing

In the current image upload branch, there may be a local variable named `uploadFile` used for the processed image blob/file.

That local name can shadow the imported `uploadFile()` helper from `storageService.js`.

If present in the current code, this creates a high-risk defect because a later call intended to upload to Supabase storage may refer to the local processed file variable instead of the storage helper function.

This should be fixed in the first upload refactor pass as a behavior-preserving rename.

Recommended rename pattern:

```js
const processedFile = await convertHeicToJpeg(file)
```

or:

```js
let imageToUpload = await convertHeicToJpeg(file)
```

Then keep the storage helper name reserved for the imported function:

```js
await uploadFile(path, uploadBlob, options)
```

This should be treated as a safety fix, not a UX/feature change.

---

## 10. Static Hosting Compatibility

- No bundler is required for the upload page.
- No server is required for `upload.html` itself beyond static file hosting.
- The page uses browser ES modules and CDN scripts.
- Uploads go directly from the browser to Supabase using the publishable anon client key and RLS/storage policies.
- Google Photos, HEIC conversion, and face detection depend on third-party browser/CDN resources and network availability.

Static hosting compatibility remains intact.

---

## 11. Risk Ranking

### High

| Risk | Notes |
|---|---|
| Storage upload + DB insert consistency | No transactional rollback; orphaned storage objects possible |
| `uploadFile` variable shadowing | May break or confuse image upload path until renamed |
| Auth/session and RLS assumptions | Client redirects but does not validate album upload capability before processing files |
| Multi-file partial failures | Successful and failed files can interleave; final message only reports success count |

### Medium

| Risk | Notes |
|---|---|
| Mobile browser file handling | HEIC conversion, large images, memory pressure from FileReader/canvas/createImageBitmap |
| Media preprocessing | Resize quality, focal point detection fallback, video metadata loading |
| Filename/path generation | Embedded in UI code and only lightly sanitizes names |
| Progress UI | Status-based rather than byte-progress-based; no retry/cancel affordance |
| Google Photos import | Depends on dynamic import, Google APIs, CORS limitations, and manual video fallbacks |

### Low

| Risk | Notes |
|---|---|
| Static page routing | Query param and post-upload album link are straightforward |
| Public URL preview behavior | Assumes the `photos` bucket remains public |
| Reusing current service wrappers | Upload already uses auth, photo, storage, config, and utility modules |

---

## 12. Recommended Next PR Sequence

### PR A — Upload service boundary only

Introduce a narrow upload service/helper boundary.

Scope:

- preserve current storage upload plus photo insert behavior
- preserve path generation behavior
- preserve upload options
- preserve returned values and error behavior
- fix the `uploadFile` local-variable shadowing by renaming the local image-processing variable
- do not redesign UI
- do not change upload UX yet

Possible target file:

```text
js/photo-album/services/uploadService.js
```

or:

```text
js/photo-album/features/upload/uploadService.js
```

Recommended direction:

- keep Supabase wrappers in `services/`
- keep DOM/controller behavior out of services
- consider a later `features/upload/uploadController.js`

### PR B — Upload controller extraction

Move DOM event binding and upload orchestration into a focused upload controller.

Scope:

- keep `upload.html` markup unchanged
- preserve current user-visible behavior
- keep media preprocessing functions behavior-preserving
- do not combine with UX cleanup

### PR C — Upload UX/error cleanup after behavior is stabilized

Only after PR A/B are stable:

- clearer completion when success count is `0`
- optional orphan cleanup behavior
- stronger unsupported file handling
- clearer large image/video messages
- possible retry/cancel affordances

### PR D — Album index audit/refactor after upload

After upload path is stable:

- audit `albums.html`
- audit `js/albums-index.js`
- audit album creation/selection flows
- decide whether upload should support album selection or creation outside the query-param path

---

## 13. Manual Smoke Test Checklist

- [ ] `upload.html` loads
- [ ] login/auth state works
- [ ] unsigned users redirect to login with the upload URL preserved
- [ ] existing album query param works with `?album=...`
- [ ] alternate `?id=...` query param still resolves if relied on
- [ ] missing album ID hides the drop area and shows the current error
- [ ] file selection works
- [ ] drag/drop works
- [ ] multiple upload works
- [ ] HEIC upload/conversion still works in supported browsers
- [ ] video validation enforces duration and size limits
- [ ] Google Photos import works when configured
- [ ] successful upload creates a storage file in the `photos` bucket
- [ ] successful upload creates a `photos` row with `album_id`, `file_path`, `uploaded_by`, and `focal_point`
- [ ] uploaded photo appears in `album.html?album=...`
- [ ] failed upload shows an error in the file row
- [ ] partial multi-file failure keeps successful uploads and reports the successful count
- [ ] completion panel links to the album
- [ ] mobile photo library selection works on iOS/iPadOS
- [ ] no console errors during the happy path

---

## 14. References

- `PHOTO_ALBUM_README.md` — overview, module layout, and local smoke test context
- `supabase/photo-album-schema.sql` — tables, storage path notes, and RLS draft notes
- `upload.html` — static upload page shell
- `js/upload.js` — current upload orchestration source of truth
