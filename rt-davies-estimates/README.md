# R.T. Davies Tree Experts — Estimate System (MVP)

Next.js + TypeScript app that replaces handwritten paper estimates with a mobile-friendly workflow backed by **Google Sheets** via **Apps Script** (no Supabase, no service account keys).

## Features

- Dashboard with pipeline metrics
- Customer list (add, edit, search)
- Create estimates with multiple line items
- Save/sync to Google Sheets
- View/edit estimates, status workflow
- Printable customer-facing estimate
- Email estimates (Resend or mailto fallback)
- Job tracker
- Settings (business info, tax rate, service categories)

## Quick start

```bash
cd rt-davies-estimates
cp .env.example .env.local
# Deploy Apps Script — see docs/APPS_SCRIPT_SETUP.md
npm install
npm run dev
# Verify: http://localhost:3000/api/sheets/health
```

### Windows (corporate TLS / npm certificate errors)

If `npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or `Exit handler never called!`:

```powershell
cd rt-davies-estimates
# Optional cleanup if a prior install left a broken tree
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force

$env:NODE_OPTIONS = "--use-system-ca"
npm install
npm run build
npm run dev
```

Requires Node 22+ (you have `NODE_OPTIONS=--use-system-ca` support). Commit `package-lock.json` after a successful install.

## Tech stack

- Next.js 15 (App Router)
- TypeScript, Tailwind CSS
- React Hook Form + Zod
- Google Apps Script web app (sheet middleware)
- Resend or mailto for email
- Vercel deployment

## Project structure

```
src/
  app/           # Pages + API routes
  components/    # UI, forms, printable estimate
  lib/
    rtdApiClient.ts   # Apps Script HTTP client
    services/         # Business logic
    schemas.ts        # Zod validation
docs/
  APPS_SCRIPT_SETUP.md
  GOOGLE_SHEETS_SETUP.md
```

## License

Private — R.T. Davies Tree Experts
