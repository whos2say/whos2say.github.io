# Google Sheets setup — R.T. Davies Estimate System

> **Data access:** Use [APPS_SCRIPT_SETUP.md](./APPS_SCRIPT_SETUP.md) to connect the app.  
> Service account keys are not used (org policy). This document defines the **spreadsheet schema only**.

This app uses **Google Sheets as the database**. All customers, estimates, line items, jobs, and settings are stored in a single spreadsheet.

## 1. Create the spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Rename it to: **RT Davies Estimate System**
3. Create these tabs (exact names — case-sensitive):

| Tab name | Purpose |
|----------|---------|
| `Customers` | Customer records |
| `Estimates` | Estimate headers |
| `Estimate_Line_Items` | Line items per estimate |
| `Jobs` | Scheduled work |
| `Settings` | Business config key/value pairs |

## 2. Add column headers (row 1)

Copy each header row into **row 1** of the matching tab.

### Customers

```
customer_id | created_at | updated_at | first_name | last_name | company_name | email | phone | street_address | city | state | zip | notes
```

### Estimates

```
estimate_id | estimate_number | created_at | updated_at | estimate_date | customer_id | customer_name | phone | email | property_address | property_city | property_state | property_zip | status | representative_name | subtotal | tax_rate | tax_amount | total | internal_notes | customer_notes | sent_at | approved_at | scheduled_at | completed_at | paid_at
```

### Estimate_Line_Items

```
line_item_id | estimate_id | sort_order | service_category | service_description | tree_species | location_on_property | quantity | unit | unit_price | line_total | taxable | crew_notes
```

### Jobs

```
job_id | estimate_id | customer_name | property_address | scheduled_date | crew_assigned | job_status | completion_notes | created_at | updated_at
```

### Settings

```
setting_key | setting_value
```

### Default settings rows (optional — app uses defaults if empty)

| setting_key | setting_value |
|-------------|---------------|
| business_name | R.T. Davies Tree Experts |
| business_address | 2101 Bridge Avenue, Point Pleasant, NJ 08742 |
| business_phone | 732-899-0328 |
| default_tax_rate | 0.06625 |
| default_terms | Payment in full upon completion of work unless otherwise specified. |
| service_categories | Tree Removal\|Stump Grinding\|Limb Removal\|Tree Pruning\|Shrub Pruning\|Fertilization\|Deep Root Feeding\|Spraying\|Insect Management\|Consulting\|Tree Planting\|Yearly Maintenance Program\|Other |

## 3. Google Cloud service account

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable **Google Sheets API**: APIs & Services → Library → search “Google Sheets API” → Enable.
4. Create credentials: APIs & Services → Credentials → **Create credentials** → **Service account**.
5. Create a key for the service account: Keys → Add key → JSON. Download the JSON file.

From the JSON file you need:

- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY`

## 4. Share the spreadsheet

1. Open your spreadsheet.
2. Click **Share**.
3. Add the service account email (e.g. `rt-davies-sheets@your-project.iam.gserviceaccount.com`).
4. Grant **Editor** access.

## 5. Environment variables

Copy `.env.example` to `.env.local` in `rt-davies-estimates/`:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=abc123_from_spreadsheet_url
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Spreadsheet ID:** From the URL  
`https://docs.google.com/spreadsheets/d/THIS_PART/edit` → use `THIS_PART` as `GOOGLE_SHEET_ID`.

**Private key:** Paste the full key with `\n` for line breaks, wrapped in double quotes.

## 6. Run locally

```bash
cd rt-davies-estimates
npm install
npm run dev
```

Open http://localhost:3000

## 7. Email (optional)

**Default (MVP):** Sending uses a `mailto:` link when Resend is not configured. Click **Send estimate** and your email client opens with a pre-filled message.

**Resend (recommended for production):**

```bash
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=estimates@yourdomain.com
```

## 8. Deploy to Vercel

1. Import the `rt-davies-estimates` folder as a new Vercel project (or monorepo root).
2. Add the same environment variables in Project Settings → Environment Variables.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://estimates.rtdavies.com`).

## Estimate numbers

Numbers are auto-generated as `RTD-YYYY-####` (e.g. `RTD-2026-0001`) by reading existing rows on the Estimates tab for the current year.

## Status values

Estimates: `draft`, `sent`, `approved`, `rejected`, `scheduled`, `completed`, `paid`

Jobs: `scheduled`, `in_progress`, `completed`, `cancelled`
