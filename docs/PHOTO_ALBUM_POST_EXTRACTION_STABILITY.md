# Photo Album Post-Extraction Stability Checklist

## 1) Purpose

This document captures a stability checkpoint for the static Photo Album App after the recent album detail page extractions.

The goal is to confirm the app remains stable before moving into the next higher-risk extraction area.

The existing static Photo Album App remains the source of truth. This is not a Next.js migration checkpoint.

---

## 2) Current known-good sequence

The following PRs have been completed and merged:

- PR #6 — Photo Album engine foundation
- PR #7 — Photo grid, selection, bulk actions, drag reorder, and focal point extraction
- PR #8 — Album loader and download helpers
- PR #9 — Engine checkpoint audit after PR #8
- PR #10 — Music service boundary
- PR #11 — Album title controls extraction
- PR #12 — Slideshow selector extraction
- PR #13 — Music controller extraction

After PR #13, the app was manually verified and core behavior still worked.

---

## 3) Current architecture status

`js/album.js` remains the album detail page orchestration hub.

The following areas have been moved into dedicated modules:

- Album state
- Album data loading
- Photo grid rendering
- Selection behavior
- Bulk actions
- Drag reorder
- Focal point / reposition controls
- Lightbox
- Comments
- Permissions
- Toasts
- Download helper
- Title controls
- Slideshow selector
- Music service boundary
- Music controller

The app still runs as a static GitHub Pages-compatible application using plain HTML, CSS, browser ES modules, and Supabase client-side services.

---

## 4) Remaining higher-risk areas

### Crop

Crop is the highest-risk remaining extraction.

Reasons:

- Uses Cropper.js
- Depends on CDN-loaded Cropper assets
- Has prior CORS/canvas fragility
- Uses blob-fetch behavior to avoid canvas tainting
- Interacts with the lightbox
- Uploads cropped output to storage
- Creates a new photo database record
- Rolls back uploaded storage file if database insert fails

Crop should only be extracted in a narrow, behavior-preserving PR.

### Sharing

Sharing remains a medium/high-risk area.

Reasons:

- Public URL behavior
- QR code behavior
- Short-link behavior
- OG/social metadata assumptions
- External sharing expectations

Sharing should not be extracted in the same PR as crop.

---

## 5) Current stability smoke test checklist

Before starting crop extraction, verify the following on `main`:

- [ ] `albums.html` loads
- [ ] Existing album opens from album list
- [ ] `album.html` loads an existing album directly
- [ ] Photos render in expected order
- [ ] Empty album state still works
- [ ] Lightbox opens
- [ ] Lightbox closes
- [ ] Lightbox next/previous works
- [ ] Photo download works
- [ ] Comments load
- [ ] Comment form behavior works when signed in
- [ ] Selection mode works
- [ ] Bulk action bar appears
- [ ] Bulk download starts
- [ ] Bulk cancel clears selection
- [ ] Drag reorder still works for owner/admin
- [ ] Focal point/reposition modal opens
- [ ] Focal point save works
- [ ] Admin title rename works
- [ ] Admin title size buttons work
- [ ] Slideshow selector opens
- [ ] Slideshow selector save works
- [ ] Slideshow selector start works
- [ ] Music button appears for owner/admin
- [ ] Music modal opens
- [ ] Music library loads
- [ ] Existing music track can be selected
- [ ] Music URL can be saved
- [ ] Music can be removed
- [ ] Upload page still loads
- [ ] Uploading photos still works
- [ ] Share modal opens
- [ ] No console errors on normal album load

---

## 6) Recommended next PR

Recommended next technical PR:

```text
refactor/photo-album-crop-controller