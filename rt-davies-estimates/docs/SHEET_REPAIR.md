# Repair Google Sheet database

Spreadsheet: [RT Davies Estimate System](https://docs.google.com/spreadsheets/d/1aQzJZKxfsvDE7cznX28pYDUxpXqjEW4rE2IuRfPLHJw/edit)

## Error

`The number of columns in the range must be at least 1.`

This happens when a tab has **no header row** (`getLastColumn()` is 0).

## Fix (recommended — 2 minutes)

1. Open the spreadsheet → **Extensions** → **Apps Script**.
2. Replace `Code.gs` with the latest from `apps-script/Code.gs` in this repo (includes `repairDatabase`).
3. **Save** → select function **`repairDatabase`** → **Run** (authorize if prompted).
4. **Deploy** → **Manage deployments** → **New version** (so the web app uses the fixed code).

Or after step 3, reload the sheet and use menu **RT Davies → Repair database (headers + settings)**.

`repairDatabase` will:

- Create any missing tabs (`Customers`, `Estimates`, `Estimate_Line_Items`, `Jobs`, `Settings`)
- Write **row 1 headers** on empty or broken tabs
- **Freeze row 1**
- Upsert default **Settings** rows (business name, tax rate, service categories, etc.)

## Manual check (optional)

Confirm tab names and row 1 match [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md).

Remove duplicate/conflicting tabs (e.g. `Sheet1`, misspelled copies).

## Test after repair

1. Open the app → **New estimate** → fill customer + one line item → save.
2. In the spreadsheet:
   - **Customers** — new row with `customer_id`
   - **Estimates** — new row with `estimate_number` like `RTD-2026-0001`
   - **Estimate_Line_Items** — one or more rows with matching `estimate_id`
3. `/api/sheets/health` should show `ok: true` and all tabs in `tabs.found`.
