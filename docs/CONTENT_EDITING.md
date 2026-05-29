# Content editing guide

This site keeps **public-facing copy in JSON files** under [`content/`](../content/). HTML pages preserve layout and styling; [`js/content/render.js`](../js/content/render.js) syncs live text from JSON when each page loads.

## Where to edit copy

| What you want to change | Edit this file | Public page |
| --- | --- | --- |
| Homepage hero, CTAs, Autism section | `content/homepage.json` | `/` |
| Programs grid & “How Pathways Work” | `content/programs-index.json` | `/programs.html` |
| Individual program pages | `content/programs/<slug>.json` | `/programs/<slug>.html` |
| Contact hero & sidebar | `content/contact.json` | `/contact.html` |
| Shared FAQs | `content/faqs.json` | Contact accordions (+ future pages) |
| Creative Workshops & pricing | `content/creative-workshops.json` | `/creative-workshops.html` |
| Support coordinator language | `content/support-coordinators.json` | `/support-coordinators.html` |
| Participant stories | `content/stories/<slug>.json` | `/stories/<slug>.html` |
| Org name, email, phone, donate URL | `content/site.json` | All pages (contact info) |

Each JSON file includes a `"_comment"` field explaining its purpose (ignored by the renderer).

## Two ways to edit

### 1. Decap CMS (recommended for non-developers)

1. Open **`https://whostosay.org/admin/`** (or `/admin/` locally).
2. Log in with GitHub (requires repo write access).
3. Pick a collection (Homepage, Programs, FAQs, etc.).
4. Save — Decap commits changes to the `content/` JSON files in GitHub.
5. Deploy as usual (GitHub Pages / Vercel picks up the commit).

Config: [`admin/config.yml`](../admin/config.yml)

### 2. Edit JSON directly

1. Open the relevant file in `content/`.
2. Change text values (keep JSON valid — use double quotes, escape `"` inside strings).
3. Commit and deploy.

## How pages connect to content

Each wired page sets `data-content-page` on `<body>`:

```html
<body data-content-page="homepage">
<script src="/js/content/render.js" defer></script>
```

Program detail pages use `data-content-page="programs/digital-content-creator"` (matches `content/programs/digital-content-creator.json`).

**Creative Workshops** and **Support Coordinators** are thin HTML shells; full layout is rendered from JSON via `js/content/render-full-pages.js`.

## Media uploads (Decap CMS)

New images uploaded through the admin UI go to:

- **Folder:** `assets/images/uploads/`
- **Public URL:** `/assets/images/uploads/<filename>`

Existing program images stay in `assets/images/` — only change paths in JSON if you intentionally swap artwork.

## Compliance-sensitive copy

Before publishing changes to coordinator summaries, funding notes, or pricing:

- Use **conditional** funding language: *“may be eligible”*, *“when approved through the individual's plan or funding source.”*
- Prefer **creative studio**, **public-facing classes**, **individualized creative media sessions**, **community participation**, **digital storytelling**, **skill-building**.
- Avoid language that implies a **licensed day habilitation provider** unless explicitly approved.
- Coordinator / DDD accordion blocks on program pages are in each `content/programs/*.json` → `sidebar.accordions`.

## Admin authentication (Vercel + GitHub OAuth)

Decap CMS uses a **Git-based workflow** on **Vercel** (not Netlify). The admin UI at `/admin/` authenticates through a **self-hosted OAuth proxy** in this repo.

### How it works

1. Editor opens `https://whostosay.org/admin/` and clicks **Login with GitHub**.
2. Decap opens a popup to `https://whostosay.org/api/auth` (`api/auth.js`).
3. That route redirects to GitHub OAuth.
4. GitHub returns to `https://whostosay.org/api/callback` (`api/callback.js`).
5. The callback exchanges the code for a token and sends it to Decap via `postMessage`.
6. Decap uses the token to read/write `content/` files via the GitHub API.

Only GitHub users with **write access** to `whos2say/whos2say.github.io` can save. OAuth alone is not enough — GitHub enforces repo permissions.

### Config (`admin/config.yml`)

```yaml
backend:
  name: github
  repo: whos2say/whos2say.github.io
  branch: main
  base_url: https://whostosay.org
  auth_endpoint: api/auth
  site_domain: whostosay.org

publish_mode: editorial_workflow
```

### Environment variables (Vercel)

Set in **Vercel → Project → Settings → Environment Variables**. Never commit secrets.

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `OAUTH_REDIRECT_URI` | `https://whostosay.org/api/callback` (must match GitHub app exactly) |
| `SITE_ORIGIN` | `https://whostosay.org` (fallback if redirect URI omitted) |
| `GITHUB_OAUTH_SCOPE` | Optional; default `repo` (required for CMS commits) |

See [`.env.example`](../.env.example) for a copy-paste template.

### GitHub OAuth App setup

1. [GitHub → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. **Homepage URL:** `https://whostosay.org`
3. **Authorization callback URL:** `https://whostosay.org/api/callback`
4. Copy Client ID and generate Client Secret → add to Vercel env vars
5. Redeploy the Vercel project

Full checklist: [`docs/DECAP_PRODUCTION_CHECKLIST.md`](DECAP_PRODUCTION_CHECKLIST.md)

### Draft vs publish (editorial workflow)

`publish_mode: editorial_workflow` is enabled because this site has **compliance-sensitive copy** (coordinator / DDD language).

| Step | Behavior |
| --- | --- |
| **Save** | Saves a **draft** in Decap; commits to GitHub on the configured branch |
| **Publish** | Marks the entry published in CMS and updates the live JSON content |
| **Deploy** | Vercel rebuilds when commits land on the deployed branch |

Draft/publish is a **CMS review step**, not a substitute for git/PR review. For stronger governance, point `backend.branch` at a non-`main` branch (e.g. `cms/content`) and merge to `main` via pull request after compliance review.

### Local editing (no OAuth)

GitHub OAuth Apps only support one callback URL, so local `/admin/` login uses the Decap local backend instead:

```bash
npx decap-server
```

In `admin/config.yml` temporarily add:

```yaml
local_backend: true
```

Edits write directly to local `content/` files without GitHub. Remove `local_backend` before deploying.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank admin / login error | Check browser console; confirm `decap-cms.js` loads |
| "OAuth not configured" | Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Vercel; redeploy |
| Redirect URI mismatch | GitHub app callback must exactly match `OAUTH_REDIRECT_URI` |
| Login works but save fails | User needs **write** access to the repo; check collaborator list |
| Popup goes to Netlify | `base_url` in `config.yml` must be `https://whostosay.org`, not `api.netlify.com` |

## Risks & owner review

| Topic | Decision needed |
| --- | --- |
| **Creative Workshops pricing** | Tiers in `creative-workshops.json` ($25–$75 / $95–$175 / $225–$300 / Coming soon) are structural placeholders — confirm against approved copy before linking prominently in nav. |
| **Support coordinator samples** | Sample descriptions reference DDD Goods & Services — legal/compliance review before external distribution. |
| **SEO & no-JS** | Most pages keep HTML fallback copy; workshops/coordinator pages require JS. Consider a build-step HTML sync if SEO for those URLs is critical. |
| **Branch name** | CMS targets `main`; current dev branch may differ — update `admin/config.yml` before go-live. |
| **Coordinator accordion CMS fields** | Complex accordion bodies are easiest to edit as raw JSON; simplified fields in Decap may not capture nested lists — use direct JSON edit for those blocks. |

## Adding a new program page

1. Duplicate a JSON file in `content/programs/`.
2. Duplicate an HTML file in `programs/` and set `data-content-page="programs/your-slug"`.
3. Add a card entry in `content/programs-index.json`.
4. Add the file to Decap `programs` collection (folder-based — automatic if file is in `content/programs/`).
5. Update site navigation in HTML headers (nav is not yet JSON-driven).

## Technical reference

- Loader: [`js/content/render.js`](../js/content/render.js)
- Full-page renderers: [`js/content/render-full-pages.js`](../js/content/render-full-pages.js)
- Admin UI: [`admin/index.html`](../admin/index.html)
- OAuth proxy: [`api/auth.js`](../api/auth.js), [`api/callback.js`](../api/callback.js), [`lib/decap-oauth.js`](../lib/decap-oauth.js)
- Production checklist: [`docs/DECAP_PRODUCTION_CHECKLIST.md`](DECAP_PRODUCTION_CHECKLIST.md)
