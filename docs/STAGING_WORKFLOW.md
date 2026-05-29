# Staging workflow (Vercel + Decap CMS)

Review and publish workshop pages, participant stories, and coordinator copy on **staging** without affecting **production**.

| | Production | Staging |
| --- | --- | --- |
| **URL** | https://www.whostosay.org | https://staging.whostosay.org |
| **Git branch** | `main` | `staging` |
| **Decap `/admin/` commits to** | `main` | `staging` |
| **Draft page nav** | Hidden | Visible |
| **GitHub OAuth App** | Production app | **Separate** staging app |

---

## Recommended approach: build-time config generation

We use **a template script + Vercel environment variables**, not duplicate admin configs.

| File | Purpose |
| --- | --- |
| `admin/config.shared.yml` | CMS collections schema (edit this) |
| `scripts/generate-decap-config.mjs` | Writes `admin/config.yml` at deploy time |
| `admin/config.yml` | Generated output (committed; Vercel overwrites on build) |

**Why not two full config files?** Collections would drift.  
**Why not only env vars in YAML?** Decap reads static YAML in the browser; Vercel build generates the file.

`vercel.json` runs `npm run build:decap-config` on every deploy.

---

## Git workflow

```
feature/my-page  →  PR  →  staging  →  review on staging.whostosay.org  →  PR  →  main  →  www.whostosay.org
```

1. **Feature work** — branch from `staging`, open PR into `staging`.
2. **Content review** — merge to `staging`, verify on https://staging.whostosay.org.
3. **Edit content** — use https://staging.whostosay.org/admin/ (commits to `staging` branch).
4. **Promote** — open PR `staging` → `main`, complete checklist below, merge.
5. **Production** — Vercel deploys `main` to www; Decap at https://www.whostosay.org/admin/ commits to `main`.

The long-lived **`staging`** branch already exists: `origin/staging`.

---

## Vercel setup (exact steps)

### 1. Production domain (already configured)

- **Project → Settings → Domains**
- `www.whostosay.org` → **Production** (branch `main`)

### 2. Staging domain

1. **Settings → Domains → Add**
2. Enter `staging.whostosay.org`
3. Assign to Git branch **`staging`** (not Production)
4. Add DNS record Vercel provides (CNAME `staging` → `cname.vercel-dns.com` or similar)

### 3. Environment variables

**Production** (applies only to `main` deployments):

| Variable | Value |
| --- | --- |
| `DECAP_GIT_BRANCH` | `main` |
| `SITE_ORIGIN` | `https://www.whostosay.org` |
| `DECAP_SITE_DOMAIN` | `www.whostosay.org` |
| `OAUTH_REDIRECT_URI` | `https://www.whostosay.org/api/callback` |
| `GITHUB_CLIENT_ID` | Production OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Production OAuth App secret |

**Preview — scope to branch `staging`** (Vercel → Env Var → Git Branch: `staging`):

| Variable | Value |
| --- | --- |
| `DECAP_GIT_BRANCH` | `staging` |
| `SITE_ORIGIN` | `https://staging.whostosay.org` |
| `DECAP_SITE_DOMAIN` | `staging.whostosay.org` |
| `OAUTH_REDIRECT_URI` | `https://staging.whostosay.org/api/callback` |
| `GITHUB_CLIENT_ID` | **Staging** OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | **Staging** OAuth App secret |

> Use **branch-scoped** staging vars so feature-branch preview deploys do not inherit staging OAuth credentials incorrectly.

### 4. Redeploy

Redeploy `staging` and `main` after env vars are set so `generate-decap-config.mjs` runs with correct values.

### 5. Protect staging from the public

**Recommended:** Vercel → **Project → Settings → Deployment Protection**

- Enable **Password Protection** for **Preview** deployments, **or**
- Enable protection specifically for the `staging` branch / `staging.whostosay.org`

Share the password only with staff. Production (`main`) stays public.

Alternative: Vercel **Authentication** (team members only) for preview/staging.

---

## GitHub OAuth — two apps required

GitHub allows **one callback URL per OAuth App**. Production and staging need **separate apps**.

### Production OAuth App

1. [GitHub → Developer settings → OAuth Apps → New](https://github.com/settings/developers)
2. **Application name:** `Who's to Say CMS (Production)`
3. **Homepage URL:** `https://www.whostosay.org`
4. **Authorization callback URL:** `https://www.whostosay.org/api/callback`
5. Copy Client ID + generate Client Secret → Vercel **Production** env vars

### Staging OAuth App

1. **New OAuth App**
2. **Application name:** `Who's to Say CMS (Staging)`
3. **Homepage URL:** `https://staging.whostosay.org`
4. **Authorization callback URL:** `https://staging.whostosay.org/api/callback`
5. Copy Client ID + secret → Vercel env vars **scoped to branch `staging`**

### Feature-branch previews

Do **not** use `/admin/` on random `*.vercel.app` preview URLs — OAuth callbacks will not match. Use:

- https://staging.whostosay.org/admin/ for content work
- https://www.whostosay.org/admin/ for production hotfixes (rare)

Local editing: `npx decap-server` + `local_backend: true` in config (see [CONTENT_EDITING.md](CONTENT_EDITING.md)).

---

## How to edit staging content

1. Open https://staging.whostosay.org/admin/
2. Log in with GitHub (repo write access required)
3. Edit collections (Workshops, Stories, Coordinators, etc.)
4. **Save** draft → **Publish** in Decap (editorial workflow)
5. Decap commits to the **`staging`** branch
6. Vercel redeploys staging automatically
7. Verify pages on staging (draft nav links appear in header)

Draft pages (workshops, coordinators) are reachable by URL on staging but **not linked in production nav**.

---

## Draft pages & production nav

Controlled by `content/site.json` → `environment`:

```json
"environment": {
  "showDraftPagesInNav": true,
  "showStagingBanner": true,
  "draftNavLinks": [ ... ]
}
```

| Branch | `showDraftPagesInNav` | Effect |
| --- | --- | --- |
| `staging` | `true` | Header shows Creative Workshops + For Coordinators |
| `main` | **`false`** | Production nav unchanged; pages still reachable by direct URL if merged |

`js/content/environment.js` also shows the staging banner on `staging.whostosay.org`.

Story footers use `data-staging-only` so workshop links hide on production.

---

## Promote staging → production

Open PR: **`staging` → `main`**

### Pre-merge checklist

- [ ] Workshop/coordinator copy compliance-reviewed
- [ ] Participant story copy approved
- [ ] On **`main`**, set `content/site.json` → `environment.showDraftPagesInNav` **`false`**
- [ ] On **`main`**, set `environment.showStagingBanner` **`false`**
- [ ] Confirm production nav has **no** draft page links
- [ ] If ready for public workshops: enable nav links intentionally (separate decision)
- [ ] Merge PR
- [ ] Verify https://www.whostosay.org after deploy
- [ ] Sync `staging` with `main` after merge (`git checkout staging && git merge main`)

### What merges

- `content/**/*.json` — copy changes
- HTML/JS/CSS — page shells, renderers
- `admin/config.shared.yml` — schema changes

Vercel **regenerates** `admin/config.yml` on deploy — production build uses `main` + www URLs automatically.

---

## Local development

```bash
# Staging-like Decap config
DECAP_GIT_BRANCH=staging SITE_ORIGIN=https://staging.whostosay.org DECAP_SITE_DOMAIN=staging.whostosay.org npm run build:decap-config

# Production-like Decap config
DECAP_GIT_BRANCH=main SITE_ORIGIN=https://www.whostosay.org DECAP_SITE_DOMAIN=www.whostosay.org npm run build:decap-config

python -m http.server 8099
```

OAuth login locally still requires `npx decap-server` (see CONTENT_EDITING.md).

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Staging `/admin/` commits to `main` | Check Vercel staging env: `DECAP_GIT_BRANCH=staging`; redeploy |
| OAuth redirect mismatch on staging | Staging OAuth app callback must be `https://staging.whostosay.org/api/callback` |
| Production OAuth broken after staging setup | Ensure Production env vars still use **production** OAuth credentials |
| Draft links on www | Set `showDraftPagesInNav: false` in `content/site.json` on `main` |
| Feature preview CMS login fails | Expected — use staging.whostosay.org instead |

---

## Related docs

- [CONTENT_EDITING.md](CONTENT_EDITING.md) — editing copy, Decap collections
- [DECAP_PRODUCTION_CHECKLIST.md](DECAP_PRODUCTION_CHECKLIST.md) — first-time OAuth setup
- [`.env.example`](../.env.example) — variable template
