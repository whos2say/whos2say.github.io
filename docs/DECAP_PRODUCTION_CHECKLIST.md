# Decap CMS — production setup checklist (Vercel + GitHub OAuth)

Use this once when enabling `/admin/` on https://www.whostosay.org.

> **Staging:** See [`docs/STAGING_WORKFLOW.md`](STAGING_WORKFLOW.md) for a second OAuth app and env vars on `staging.whostosay.org`.

## Architecture

| Piece | Location |
| --- | --- |
| Admin UI | `/admin/index.html` + `/admin/config.yml` |
| OAuth start | `GET /api/auth` → `api/auth.js` |
| OAuth callback | `GET /api/callback` → `api/callback.js` |
| Shared logic | `lib/decap-oauth.js` |
| Content files | `content/**/*.json` |

The site is **static HTML on Vercel** with **serverless API routes** in `/api` (same pattern as `api/create-short-link.js`). No Netlify Identity or Git Gateway is required.

---

## 1. GitHub OAuth App

1. Open [GitHub → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**.
2. Set:
   - **Application name:** `Who's to Say CMS` (any label)
   - **Homepage URL:** `https://www.whostosay.org`
   - **Authorization callback URL:** `https://www.whostosay.org/api/callback`
3. Create the app → **Generate a new client secret**.
4. Copy **Client ID** and **Client Secret** (secret is shown once).

> GitHub allows **one** callback URL per OAuth App. Local `/admin/` login uses `npx decap-server` + `local_backend: true` instead of this OAuth app.

---

## 2. Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, add for **Production** (and Preview if you use a separate OAuth app):

| Variable | Value | Sensitive |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | From OAuth App | No |
| `GITHUB_CLIENT_SECRET` | From OAuth App | **Yes** |
| `OAUTH_REDIRECT_URI` | `https://www.whostosay.org/api/callback` | No |
| `SITE_ORIGIN` | `https://www.whostosay.org` | No |
| `DECAP_GIT_BRANCH` | `main` | No |
| `DECAP_SITE_DOMAIN` | `www.whostosay.org` | No |

Redeploy after adding variables.

Template: [`.env.example`](../.env.example) (never commit real secrets).

---

## 3. Repo access control

Only GitHub users with **write access** to `whos2say/whos2say.github.io` can save content through Decap.

1. GitHub → repo → **Settings → Collaborators** (or org team).
2. Grant access only to trusted staff.
3. Remove access when someone leaves.

OAuth proves identity; **GitHub repo permissions** enforce who can commit.

---

## 4. Deploy content + admin files

Ensure these paths are committed and deployed:

- `admin/config.shared.yml` — collections schema (hand-edited)
- `scripts/generate-decap-config.mjs` — build-time config generator
- `admin/config.yml` — generated at deploy (see `vercel.json` buildCommand)

---

## 5. Smoke test (production)

- [ ] Open `https://www.whostosay.org/admin/`
- [ ] Click **Login with GitHub** — popup goes to GitHub, not Netlify
- [ ] After approving, popup closes and CMS collections load
- [ ] Edit a low-risk field in **Homepage** (e.g. hero kicker)
- [ ] **Save** → creates a draft (editorial workflow)
- [ ] **Publish** → commit appears on GitHub (`main` or configured branch)
- [ ] Reload public homepage → copy updates after deploy

If login fails:

- Vercel function logs → `/api/auth` or `/api/callback` errors
- Callback URL in GitHub app **exactly** matches `OAUTH_REDIRECT_URI`
- `admin/config.yml` → `base_url` + `auth_endpoint` → `https://whostosay.org/api/auth`

---

## 6. Publishing model (compliance)

Current config (`admin/config.yml`):

```yaml
backend:
  branch: main
publish_mode: editorial_workflow
```

| Action | What happens |
| --- | --- |
| **Save (draft)** | Commits to GitHub on `main` with draft status in CMS; not treated as published in Decap until you Publish |
| **Publish** | Marks entry published; updates the JSON file in the repo |
| **Production site** | Redeploys when GitHub/Vercel receives the commit |

**Compliance note:** Editorial workflow adds a CMS-side draft/publish step but **still commits to the configured branch**. For stricter review of DDD/coordinator language:

1. Change `backend.branch` to e.g. `cms/content` (create the branch first).
2. Require a **pull request** into `main` before production deploy.
3. Keep `publish_mode: editorial_workflow` so editors draft before requesting merge.

---

## 7. Optional hardening

- [ ] Enable Vercel **Deployment Protection** for preview URLs
- [ ] Do not link `/admin/` from public navigation (obscurity + auth)
- [ ] Periodically audit GitHub collaborators
- [ ] Review `content/programs/*.json` coordinator accordions after each CMS publish
