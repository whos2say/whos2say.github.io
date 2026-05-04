# Photo Album Engine Checkpoint (Post-PR #8)

## 1) Purpose

This document is a stabilization checkpoint after **PR #6**, **PR #7**, and **PR #8** for the static Photo Album App in `whos2say/whos2say.github.io`.

The intent is to capture the current architecture before extracting higher-risk modules.  
Next work should be delivered as **narrow, behavior-preserving PRs**.

---

## 2) Current architecture summary

- Static HTML pages remain the runtime model.
- GitHub Pages/static hosting compatibility must be preserved.
- `albums.html`, `album.html`, and `upload.html` remain the working app entry points.
- `js/album.js` remains the album detail page orchestration hub.
- New engine folders/files now include:
  - `assets/css/photo-album.css`
  - `js/photo-album/config.js`
  - `js/photo-album/services/`
  - `js/photo-album/utils/`
  - `js/photo-album/features/album/`
  - `supabase/photo-album-schema.sql`

---

## 3) What has already been extracted

The following are now extracted from monolithic page logic into engine modules:

- CSS into `assets/css/photo-album.css`
- service wrappers and utilities
- toast
- comments
- lightbox
- permissions
- album state
- photo grid
- selection
- bulk actions
- drag reorder
- focal point
- albumLoader
- download helper

---

## 4) What remains inside `js/album.js`

`js/album.js` still carries these responsibilities:

- page-level DOM queries and event binding
- album detail orchestration via `loadAlbum()`
- auth/admin/owner UI state
- title editing and title size controls
- music modal, music library, music upload, music URL handling
- slideshow selector modal, selection state, localStorage config
- crop modal and Cropper.js workflow
- share panel initialization
- image brightness helper
- some global/page state including:
  - `currentAlbumId`
  - `currentUser`
  - `isAdmin`
  - `isAlbumOwner`
  - `allPhotos`
  - `selectedPhotos`
  - crop state
  - slideshow selector state

---

## 5) Remaining direct Supabase calls

A direct Supabase import still remains in `js/album.js`.  
The remaining direct calls are now mostly music-related:

- `albums.music_url` read/update/clear
- `music_tracks` select/insert/delete
- music storage public URL lookup
- music storage upload
- music storage delete

Note: Crop now mostly uses wrappers such as `uploadFile`, `removeFiles`, and `createPhoto`, which is a positive boundary improvement.

---

## 6) High-risk feature areas

Ranked by extraction risk:

1. **Crop (highest risk)**
   - Cropper.js lifecycle complexity
   - canvas/blob/CORS behavior
   - CDN dependency behavior
   - lightbox interaction coupling

2. **Music (high risk)**
   - Supabase table + storage interactions
   - modal state + upload/progress state
   - owner/admin UX and error states

3. **Slideshow selector (medium risk)**
   - localStorage persistence
   - custom ordering and inclusion/exclusion state
   - querystring handoff to `slideshow.html`

4. **Sharing (medium/high risk)**
   - public URL handling
   - short-link generation flow
   - social/QR/OG behavior dependencies

5. **Title editing (lower risk)**
   - comparatively isolated behavior
   - already uses `updateAlbum` service wrapper

---

## 7) Service boundary review

Current service boundaries are directionally sound:

- `albumService.js` and `photoService.js` are coherent.
- `albumLoader.js` correctly composes album + ordered photos for the detail page.
- `storageService.js` is being used by crop/download-related paths.
- The main missing service boundary is **`musicService.js`**.

---

## 8) Static hosting compatibility check

Current implementation remains static-hosting aligned:

- no bundler required
- no server required
- no Next.js dependency
- ES modules loaded directly in browser
- CDN usage remains for Cropper.js, QR code library, and JSZip
- app remains GitHub Pages compatible

---

## 9) Recommended next PR sequence

### PR #10: music service boundary only
- create `js/photo-album/services/musicService.js`
- move only Supabase/storage music calls
- do not move music modal UI yet

### PR #11: title controls cleanup
- extract title editing/title size into `js/photo-album/features/album/titleControls.js`

### PR #12: slideshow selector extraction
- extract slideshow selector into `js/photo-album/features/album/slideshowSelector.js`

### PR #13: music UI/controller extraction
- after `musicService.js` is stable

### PR #14: crop controller extraction
- only after previous modules are stable

### PR #15: share behavior review/extraction
- only after core album detail behavior is stable

---

## 10) Phase 4B recommendation

Phase 4B should be **cleanup/stability first**, then **music service boundary extraction**.

Do **not** start with crop.  
Do **not** start with full music UI extraction.  
Do **not** start Next.js migration.

---

## 11) Manual smoke test checklist

- [ ] `albums.html` loads
- [ ] `album.html` loads existing album
- [ ] photos render in correct order
- [ ] lightbox opens/closes
- [ ] comments still work
- [ ] select/bulk action bar still appears
- [ ] bulk download still starts
- [ ] drag reorder still works for owner/admin
- [ ] focal point/reposition still opens and saves
- [ ] album title edit still works for admin
- [ ] title size buttons still work for admin
- [ ] slideshow button opens selector
- [ ] selector save/start still works
- [ ] music modal opens for owner
- [ ] music library loads
- [ ] music URL save/clear still works
- [ ] music upload still works
- [ ] crop opens from lightbox
- [ ] crop save creates a new photo copy
- [ ] share modal opens
- [ ] generated share link/QR behavior still works if configured
- [ ] `upload.html` still works
- [ ] no console errors on normal load