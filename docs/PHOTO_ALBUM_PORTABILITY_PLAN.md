# Photo Album Portability Plan

## Goal

Make the current static Photo Album App portable without freezing feature work or forcing an immediate framework migration.

## Shared Engine Shape

- Services: `authService`, `albumService`, `photoService`, `storageService`, `commentService`.
- Config: bucket names, admin email, size limits, default focal points.
- Utilities: URL parsing, DOM helpers, media helpers, HTML escaping.
- Future modules: feature controllers for album grid, photo grid, lightbox, upload queue, comments, permissions, slideshow, music, and crop.

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
- Split `album.js` into feature modules before any framework migration.
- Create a minimal test fixture album and scripted smoke test that can run against local/static serving.
