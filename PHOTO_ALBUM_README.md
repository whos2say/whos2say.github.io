# Photo Album — Quick Local Smoke Test

Follow these steps to verify the photo-album feature locally.

1) Configure keys
- Open `js/supabase.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your project's values.

2) Supabase setup checklist
- Create the `albums` and `photos` tables (example SQL below).
- Create a storage bucket named `photos` and make it public.
- In Supabase Auth settings: set `Site URL` to `http://localhost:8000` and add `http://localhost:8000` to Allowed redirect URLs if using magic-link redirects.

Example SQL (run in Supabase SQL editor):

```
create extension if not exists pgcrypto;

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums(id) on delete cascade,
  file_path text,
  uploaded_by uuid,
  created_at timestamptz default now()
);
```

3) Start a local static server

Using Python (works on Windows):

```bash
python -m http.server 8000
```

Or with Node (if you have npm):

```bash
npx http-server -c-1 . -p 8000
```

Open your browser at `http://localhost:8000`.

4) Smoke-test flow
- Visit `login.html` and enter an email. Magic links require SMTP configured in your Supabase project; if you don't have SMTP set up, use Supabase Studio to create a user and sign in from the browser console for testing:

```js
// run in browser console (after loading the page)
import { supabase } from './js/supabase.js'
await supabase.auth.signInWithPassword({ email: 'you@example.com', password: 'yourpassword' })
```

- **Create a test album:** In your Supabase dashboard, go to the `albums` table → click "Insert row" → enter a name (e.g., "Test Album") → click save and copy the generated UUID from the `id` column.
- Open `upload.html?album=THE_ALBUM_UUID` (replace `THE_ALBUM_UUID` with your copied UUID), upload images, then check the `photos` table for inserted rows and that files appear in the `photos` bucket.
- Open `album.html?album=THE_ALBUM_UUID` to confirm images render.

5) Troubleshooting
- If images don't appear, confirm the `file_path` saved in `photos` matches object path in the `photos` bucket.
- Check browser console for network errors (CORS, 401/403) and ensure `SUPABASE_URL`/`ANON_KEY` are correct.
- If magic link emails never arrive, configure SMTP in Supabase or use the browser console sign-in method above for quick tests.

6) Next steps (optional)
- Wire `signInWithOtp` to include a `redirectTo` option so magic links return to a particular page.
- Add client-side image resizing before upload for lower bandwidth.

7) Magic-link redirect usage

- The `login.html` page now accepts a `redirect` query parameter. If provided the magic link will include that URL, and after the user signs in they will be redirected there.

- Example: to send users back to an album after sign-in, link to:

```
login.html?redirect=/album.html?album=THE_ALBUM_ID
```

- You can also pass a full URL if your site is hosted elsewhere:

```
login.html?redirect=https://example.com/album.html?album=THE_ALBUM_ID
```

Security note: only use redirect URLs you trust. An application should validate redirect destinations server-side (or restrict allowed redirect hosts) to avoid open-redirect attacks. With Supabase, prefer passing a path (e.g. `/upload.html`) rather than an arbitrary external URL when possible.

8) Implementation details

- `login.html` includes the `redirect` target in the `signInWithOtp` call via `{ options: { emailRedirectTo: redirectTo } }` and also redirects already-signed-in users automatically.

- Behaviour summary:
  - If `redirect` is set, magic link will send users to that location after they confirm their email.
  - If not set, users are sent to `/upload.html` by default.

9) Credential management

**Local development:**
- Credentials are stored in `js/supabase.js` (for quick local testing).
- These are added to `.gitignore` to prevent accidental commits to your repository.
- If you accidentally commit these credentials, rotate your anon key in the Supabase dashboard immediately.

**Production deployment:**
- Never commit real credentials to your repo. For production, use one of these approaches:
  - Environment variables injected at build time (via a static site generator or build tool).
  - A secrets management service (e.g., GitHub Secrets, AWS Secrets Manager, HashiCorp Vault).
  - Load credentials from a secure server endpoint instead of hardcoding them.
- Rotate your `SUPABASE_ANON_KEY` regularly in the Supabase dashboard.
- Row-level security (RLS) on your `albums` and `photos` tables ensures users can only access their own data.

