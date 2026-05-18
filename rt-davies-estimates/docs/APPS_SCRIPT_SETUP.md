# Apps Script setup — RT Davies Estimate System

Organization policy blocks service account keys (`iam.disableServiceAccountKeyCreation`).  
This app uses a **container-bound Apps Script web app** as middleware to Google Sheets.

## 1. Spreadsheet

Create **RT Davies Estimate System** with tabs and headers per [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) (sheet schema is unchanged).

## 2. Install the script

1. Open the spreadsheet → **Extensions** → **Apps Script**.
2. Replace `Code.gs` with the contents of [`../apps-script/Code.gs`](../apps-script/Code.gs).
3. **Save** the project.

## 3. Script property (secret)

1. Apps Script → **Project Settings** (gear) → **Script properties**.
2. Add property:
   - **Property:** `RTD_API_SECRET`
   - **Value:** a long random string (e.g. 32+ chars from a password manager).

Use the **same value** in Next.js `RTD_API_SECRET`.

## 4. Deploy as web app

1. **Deploy** → **New deployment**.
2. Type: **Web app**.
3. **Execute as:** Me (your Google account).
4. **Who has access:** Anyone (the secret protects the endpoint; only your Next.js server should call it).
5. Deploy and copy the **Web app URL** ending in `/exec` (not `/dev`).

## 5. Next.js environment

Copy `.env.example` to `.env.local`:

```env
RTD_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
RTD_API_SECRET=your_same_secret_as_script_properties
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 6. Verify

```bash
npm run dev
```

Open or request:

```
http://localhost:3000/api/sheets/health
```

Expect `ok: true` and all required tabs listed under `tabs.found`.

## Security notes

- Never commit `RTD_API_SECRET` or put it in `NEXT_PUBLIC_*` variables.
- Rotate the secret if it is exposed.
- Restrict who can open the deployed Next.js app (Vercel protection / VPN) since the web app URL + secret grant full sheet access.
- Do not log request bodies containing the secret.

## Updating the script

After editing `Code.gs`, create a **New version** under **Deploy** → **Manage deployments** → edit → **Version: New version**, or add a new deployment.

The dashboard uses a single `dashboard` action (one POST per page load). If you see **Unauthorized** on the dashboard but `/api/sheets/health` works, redeploy the script — an older deployment may be missing the `dashboard` handler, or double POSTs to Apps Script can drop the JSON body on redirect.
