# Deploy to Vercel — rtdavies.whostosay.org

## Project setup

1. [Vercel Dashboard](https://vercel.com/new) → Import the Git repo.
2. **Root Directory:** `rt-davies-estimates` (if the repo is `whos2say.github.io`).
3. Framework: Next.js (auto-detected).
4. **Do not** set `basePath` — this app runs at the domain root.

## Environment variables (Production)

| Variable | Notes |
|----------|--------|
| `RTD_APPS_SCRIPT_URL` | Apps Script web app URL ending in `/exec` |
| `RTD_API_SECRET` | Same as Script property `RTD_API_SECRET` — **never** `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | `https://rtdavies.whostosay.org` |
| `RTD_SITE_USER` | (optional) Basic auth username |
| `RTD_SITE_PASSWORD` | (optional) Basic auth password |

## Custom domain

1. Vercel project → **Settings** → **Domains** → Add `rtdavies.whostosay.org`.
2. At your DNS host for `whostosay.org`:

| Type | Name | Value |
|------|------|--------|
| CNAME | `rtdavies` | `cname.vercel-dns.com` |

Wait for DNS propagation, then confirm SSL in Vercel.

## Protection

- **Recommended:** Vercel → Settings → Deployment Protection (password / SSO).
- **Alternative:** Set `RTD_SITE_USER` and `RTD_SITE_PASSWORD` for middleware Basic Auth.

## Post-deploy checks

- https://rtdavies.whostosay.org
- https://rtdavies.whostosay.org/api/sheets/health
- https://rtdavies.whostosay.org/api/dashboard
- https://rtdavies.whostosay.org/settings
- https://rtdavies.whostosay.org/estimates/new

Confirm the API secret value never appears in browser DevTools → Sources or Network bodies (`/api/sheets/health` only reports `api_secret_configured: true/false`).
