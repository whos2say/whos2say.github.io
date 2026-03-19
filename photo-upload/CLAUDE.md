# Claude Code Instructions — Photo Album Project

## Project Overview
This is a shared photo album web app built with plain HTML, CSS, and vanilla JavaScript.
Hosted on Vercel, connected to GitHub for auto-deploy. Backend is Supabase (Postgres DB + Storage + Auth).

**Live stack:**
- Frontend: Plain HTML / CSS / Vanilla JS (no frameworks)
- Database: Supabase (Postgres)
- File Storage: Supabase Storage (bucket: `photos`, public)
- Auth: Supabase Email Auth
- Hosting: Vercel (auto-deploys on git push to `main`)
- Version control: GitHub

---

## File Structure
```
project-root/
├── CLAUDE.md
├── index.html          ← homepage / album list
├── album.html          ← view photos in an album
├── upload.html         ← upload photos (auth required)
├── login.html          ← login / signup
└── js/
    ├── supabase.js     ← Supabase client init (URL + anon key)
    ├── album.js        ← fetch and render album photos
    ├── upload.js       ← handle file uploads
    └── login.js        ← handle auth
```

---

## Database Schema

```sql
-- Albums
CREATE TABLE albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Photos
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Supabase Patterns — Always Follow These

### Client Initialization
```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient(https://oiiluqrpzhujbvrblsko.supabase.co, sb_publishable_BZ6oBk-5wHOMxr_Bw52dvA_7tuU0pHu)
```

### Auth Patterns
- Always check session with `supabase.auth.getSession()` on protected pages
- Redirect to `login.html` if no session found — never show upload UI to unauthenticated users
- Use `supabase.auth.signInWithOtp()` for magic link or `signInWithPassword()` for email/password
- Listen for auth changes: `supabase.auth.onAuthStateChange()`

### Storage Patterns
- Bucket name: `photos` (public)
- Upload path format: `{album_id}/{timestamp}-{filename}`
- Always get public URL after upload: `supabase.storage.from('photos').getPublicUrl(path)`
- Never store full URLs in the DB — store only the `file_path` and reconstruct URL when needed

### RLS — Row Level Security is ENABLED
These policies are already set. Never write code that assumes RLS is off:
- Albums: anyone can SELECT and INSERT
- Photos: anyone can SELECT, only `authenticated` role can INSERT
- Storage objects: anyone can SELECT from `photos` bucket, only `authenticated` can INSERT

### Error Handling
Always destructure `{ data, error }` from Supabase calls and handle errors explicitly:
```js
const { data, error } = await supabase.from('albums').select('*')
if (error) {
  console.error('Failed to load albums:', error.message)
  // show user-friendly error in the UI, never just silently fail
}
```

---

## Frontend Design Standards

### Core Principles
- Every page must feel **intentionally designed** — not generic AI output
- Commit to a clear aesthetic direction before writing any CSS
- Use CSS custom properties (variables) for ALL colors, fonts, and spacing
- Mobile-first — the app will be used heavily on phones for photo uploads

### Typography
- NEVER use Arial, Roboto, Inter, or system fonts as primary typefaces
- Load fonts from Google Fonts or similar
- Use a distinctive display font for headings, a refined readable font for body
- Good pairing examples: Playfair Display + DM Sans, Fraunces + Outfit, Syne + Karla

### Color
- Define a full palette in `:root` CSS variables
- Use dominant color + sharp accent, not evenly distributed pastels
- Photo-heavy UIs look best with dark or near-neutral backgrounds that let images pop
- Avoid: purple gradients, generic blue buttons, white cards on white backgrounds

### Motion & Interaction
- Page load: staggered fade-in for photo grid items using `animation-delay`
- Upload area: clear visual feedback on drag-over (border color change, scale)
- Photo hover: subtle scale + shadow lift
- Transitions: 200-300ms, `ease-out` — never jarring
- Use CSS-only animations wherever possible

### Layout
- Photo grids: CSS Grid with `auto-fill` and `minmax()` — never fixed column counts
- Upload zone: large, centered, generous padding — easy to tap on mobile
- Avoid cookie-cutter card layouts — use overlap, asymmetry, or bold spacing instead

### Accessibility (Non-Negotiable)
- All images must have descriptive `alt` attributes
- Upload inputs need visible labels, not just placeholder text
- Focus states must be visible — never `outline: none` without a replacement
- Color contrast must meet WCAG AA minimum (4.5:1 for text)
- Drag-and-drop upload must also work via click (keyboard accessible)

---

## Image Performance — Always Apply These

- Use `loading="lazy"` on all `<img>` tags in photo grids
- Set explicit `width` and `height` on images to prevent layout shift
- Use `object-fit: cover` on thumbnails — never distort images
- For grids with many photos, implement basic pagination or infinite scroll — never load all photos at once
- Recommend WebP format in upload instructions to users

---

## JavaScript Patterns

- Use `async/await` — never raw `.then()` chains
- Keep Supabase calls in dedicated functions, not inline in event handlers
- Read album ID from URL params: `new URLSearchParams(window.location.search).get('id')`
- Always sanitize filenames before upload: strip special chars, replace spaces with dashes
- Show loading states — never leave the user staring at a blank screen during async ops

```js
// Good pattern for loading states
function setLoading(isLoading) {
  document.getElementById('upload-btn').disabled = isLoading
  document.getElementById('upload-btn').textContent = isLoading ? 'Uploading...' : 'Upload Photos'
}
```

---

## Vercel & Deployment

- Production branch: `main` — every push auto-deploys
- Environment variables (Supabase URL + key) must be set in Vercel dashboard under Settings → Environment Variables
- Never hardcode credentials in JS files — use a config pattern with env vars injected at build time or a non-committed config file
- Test on the Vercel preview URL before considering anything "done"

---

## What NOT to Do

- Don't use any JS frameworks (no React, Vue, Angular) — plain JS only
- Don't use jQuery
- Don't store Supabase `service_role` key anywhere in frontend code — anon key only
- Don't load all photos without pagination on album pages
- Don't use `alert()` for errors — always show errors in the UI gracefully
- Don't skip mobile testing — this app will be used on phones constantly
- Don't generate generic-looking UIs — every page should look like a real product
