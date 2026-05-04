# Photo Album Portability Plan

## Goal

Make the current static Photo Album App portable without freezing feature work or forcing an immediate framework migration.

## Shared Engine Shape

- Services: `authService`, `albumService`, `photoService`, `storageService`, `commentService`.
- Config: bucket names, admin email, size limits, default focal points.
- Utilities: URL parsing, DOM helpers, media helpers, HTML escaping.
- Album feature modules: `features/album/toast.js`, `permissions.js`, `albumState.js`, `comments.js`, `lightbox.js`, `photoGrid.js`, `selection.js`, `bulkActions.js`, `dragReorder.js`, and `focalPoint.js`.
- Future modules: feature controllers for upload queue, downloads, album data loading, slideshow, music, crop, and share tools.

## Album Feature Module Structure

- `toast.js` is portable as-is wherever the same CSS classes are available, or can be swapped for a host app notification adapter.
- `permissions.js` is portable as a UX helper but must stay subordinate to RLS/server-side authorization.
- `albumState.js` is a small mutable static-page state object; in Next.js or a platform app, it can become React state, a store, or a view model.
- `comments.js` is largely portable because it depends on `commentService`, stable DOM IDs, and injected `showToast`/state callbacks.
- `lightbox.js` is partially portable. It owns lightbox behavior and can move with the app, but still expects current DOM IDs, CSS classes, and callbacks for comments, downloads, crop, analytics, and storage URL resolution.
- `photoGrid.js` is portable as a browser DOM renderer. It still expects the existing tile CSS classes, album state shape, and injected callbacks for lightbox, cover updates, deletion, repositioning, and downloads.
- `selection.js` is portable for the current DOM grid model and can later become framework state for React/Next.js.
- `bulkActions.js` is partly portable because it routes deletion/move/download behavior through services and injected callbacks, but still assumes the current move modal DOM.
- `dragReorder.js` is portable for plain DOM drag/drop grids and persists order through `photoService`.
- `focalPoint.js` is portable for the current modal DOM and persists through `photoService`, but future apps may want this as a component-level editor.

Currently portable with little adaptation: toast, comment service usage, comment rendering logic, lightbox media/navigation behavior, photo grid tile construction, selection state helpers, drag reorder behavior, focal point persistence, and client-side permission predicates.

Still app-shell dependent: static route redirects, direct DOM selectors, current modal markup, Cropper.js integration, share-panel wiring, music tooling, slideshow selector, and any security-sensitive authorization.

## Move To Next.js

- Keep service function signatures stable and swap `js/supabase.js` for a Next.js Supabase browser client adapter.
- Replace static page controllers with React components that call the same service layer.
- Move route parsing from `getAlbumIdFromUrl()` to route params (`/albums/[albumId]`) through a small route adapter.
- Move `/api/proxy-video` into a Next.js Route Handler if Google Photos video proxying remains necessary.
- Keep RLS as the source of truth; use server components/actions later only where private reads or privileged admin operations require them.

## Move To A Participant Portfolio App

- Treat albums/photos/comments as a participant media module.
- Add a participant/profile relation layer outside the photo engine rather than embedding participant assumptions in `albums` or `photos`.
- Reuse upload, lightbox, comments, focal point, cover photo, and storage services.
- Add app-specific rendering for participant profile pages while preserving existing album IDs and storage paths.

## Move To A Future WTS Creator Platform

- Keep the photo album engine as one content block type alongside videos, posts, events, and portfolio artifacts.
- Replace the hard-coded admin email with role/organization membership claims.
- Introduce tenant/project IDs before sharing tables across multiple WTS products.
- Move admin owner/contributor tools into a creator-platform permissions UI backed by the same core service methods.
- Keep static export compatibility only as an adapter; let the platform own routing, navigation, and auth shell.

## Next Portability Milestones

- Finish extracting all Supabase calls from page controllers.
- Define typed/plain object contracts for album, photo, comment, contributor, and setting records.
- Add a service adapter boundary so Supabase can be replaced or mocked in tests.
- Continue splitting `album.js` into feature modules before any framework migration.
- Create a minimal test fixture album and scripted smoke test that can run against local/static serving.
