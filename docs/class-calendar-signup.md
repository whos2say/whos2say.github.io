# Class Calendar & Signup System

Google Calendar is the source of truth for public class dates. The website
reads upcoming events, maps them to class IDs, and lets visitors submit a
signup request. Signups are recorded in a Google Sheet via a Google Apps Script
Web App — no service account JSON keys required.

---

## Class IDs

Two public classes are configured. IDs are hardcoded in
`lib/google-class-services.js` (`VALID_CLASS_IDS`) and mirrored as display
metadata in `content/classes.json`.

| Class ID | Display name |
|---|---|
| `digital-content-production` | Digital Content Production |
| `sports-media-community` | Sports Media & Community |

Calendar events are matched to a class ID by scanning the event title for
known alias substrings (e.g. "sports media" → `sports-media-community`).
Aliases are defined in `CLASS_TITLE_ALIASES` in
`lib/google-class-services.js` and listed for reference in
`content/classes.json`.

---

## Capacity

Maximum 3 participants per session (`CLASS_DEFAULT_CAPACITY=3`). This is
a program guideline — do not raise it without leadership approval. Waitlist
signups are accepted after capacity is reached and marked `waitlist` in
the sheet.

---

## Public Positioning Language

Always use this exact wording on public pages:

> Open to adults with and without disabilities. Small class size, maximum
> 3 participants.

Do **not** describe sessions as disability-only, personal training, fitness
prescription, athletic conditioning, medical service, custodial supervision,
or recreation-only.

---

## Google Calendar Setup

1. Create a Google Calendar dedicated to public classes (or use an existing
   one).
2. Set the calendar's sharing to **"Make available to public"** (read-only).
   This is required for the API key approach.
3. Note the **Calendar ID** (found in calendar Settings → Integrate).
   It looks like `abc123@group.calendar.google.com`.
4. Create a **Google Cloud API key** (Cloud Console → Credentials):
   - Restrict to **Google Calendar API** only.
   - Optionally restrict by referrer (your domain).
5. Set `GOOGLE_CLASSES_CALENDAR_ID` and `GOOGLE_CALENDAR_API_KEY` in Vercel.

### Naming convention for calendar events

Event titles must contain at least one of the configured aliases (see
`CLASS_TITLE_ALIASES` in `lib/google-class-services.js`). Examples:

- `Digital Content Production — July 15`
- `Sports Media & Community Class — Aug 3`

Events with titles that match no alias are ignored by the API. Cancelled
events (Google status `cancelled`) are automatically excluded.

Recurring events: the API uses `singleEvents=true`, so each occurrence
appears as a separate event. Cancelled occurrences within a recurring series
are excluded.

---

## Google Sheets + Apps Script Setup

Signup reads and writes go through a Google Apps Script Web App. This avoids
service account JSON key creation, which may be blocked by
`iam.disableServiceAccountKeyCreation` organization policy.

### 1. Create the signup spreadsheet

1. Create a Google Sheet (one per environment — see Staging vs. Production).
2. Add a tab named **`Signups`** exactly (case-sensitive).
3. Row 1 must be this header row (A–L):

   | A | B | C | D | E | F | G | H | I | J | K | L |
   |---|---|---|---|---|---|---|---|---|---|---|---|
   | timestamp | eventId | classId | classTitle | start | name | email | phone | notes | status | source | metadata |

   - `classTitle` — the Google Calendar event title at time of signup (for auditing)
   - `start` — ISO 8601 session start time (for auditing without re-querying the calendar)
   - `source` — always `web-form` for public signups; reserved for future channels
   - `metadata` — reserved; leave empty

### 2. Create the Apps Script Web App

1. In the spreadsheet: **Extensions → Apps Script**.
2. Replace the default code with the sample below.
3. Set `CONFIG.SPREADSHEET_ID` to the spreadsheet's ID (from its URL).
4. Store the shared secret in **Script Properties** (not in the code):
   - Apps Script editor → **Project Settings** (gear icon) → **Script Properties**
   - Add property: `SHARED_SECRET` = a long random string (e.g. 32 hex chars)
   - Use the same value for `GOOGLE_SIGNUPS_SHARED_SECRET` in Vercel.
5. **Deploy** as a Web App:
   - **Deploy** (top right) → **New deployment** → type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the **Web App URL** (ends in `/exec`) → set as `GOOGLE_SIGNUPS_WEBAPP_URL` in Vercel.
6. When you edit the script later, deploy a **new version** — changes to an
   existing version are not automatically live.

### Apps Script code sample

```javascript
// ── Configuration ──────────────────────────────────────────────────────────
// Set SPREADSHEET_ID to your signup sheet's spreadsheet ID (from the URL).
// Store SHARED_SECRET in Script Properties (Extensions → Apps Script →
// Project Settings → Script Properties), NOT hardcoded here.
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  SHEET_TAB:      'Signups',
}

// ── Entry points ───────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents)

    var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')
    if (!secret)                      return respond({ ok: false, error: 'SHARED_SECRET not configured in Script Properties' })
    if (payload.secret !== secret)    return respond({ ok: false, error: 'Unauthorized' })

    if (payload.action === 'list')    return handleList()
    if (payload.action === 'signup')  return handleSignup(payload.row)

    return respond({ ok: false, error: 'Unknown action: ' + payload.action })
  } catch (err) {
    return respond({ ok: false, error: 'Internal error: ' + err.message })
  }
}

// Simple health check — lets you verify the URL is live without a secret.
function doGet(e) {
  return respond({ ok: true, status: 'Signups Web App is running' })
}

// ── Handlers ───────────────────────────────────────────────────────────────

function handleList() {
  var sheet   = getSheet()
  var lastRow = sheet.getLastRow()

  if (lastRow <= 1) return respond({ ok: true, rows: [] })

  var values = sheet.getRange(2, 1, lastRow - 1, 12).getValues()
  var rows   = values.map(function (r) {
    return {
      timestamp:  String(r[0]  || ''),
      eventId:    String(r[1]  || ''),
      classId:    String(r[2]  || ''),
      classTitle: String(r[3]  || ''),
      start:      String(r[4]  || ''),
      name:       String(r[5]  || ''),
      email:      String(r[6]  || ''),
      phone:      String(r[7]  || ''),
      notes:      String(r[8]  || ''),
      status:     String(r[9]  || ''),
      source:     String(r[10] || ''),
      metadata:   String(r[11] || ''),
    }
  })

  return respond({ ok: true, rows: rows })
}

function handleSignup(row) {
  if (!row) return respond({ ok: false, error: 'Missing row data' })

  getSheet().appendRow([
    row.timestamp  || '',
    row.eventId    || '',
    row.classId    || '',
    row.classTitle || '',
    row.start      || '',
    row.name       || '',
    row.email      || '',
    row.phone      || '',
    row.notes      || '',
    row.status     || '',
    row.source     || '',
    row.metadata   || '',
  ])

  return respond({ ok: true })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSheet() {
  var sheet = SpreadsheetApp
    .openById(CONFIG.SPREADSHEET_ID)
    .getSheetByName(CONFIG.SHEET_TAB)
  if (!sheet) throw new Error('Sheet "' + CONFIG.SHEET_TAB + '" not found in spreadsheet ' + CONFIG.SPREADSHEET_ID)
  return sheet
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}
```

### Status values in the sheet

| Status | Meaning | Counts toward capacity |
|---|---|---|
| `pending` | Accepted via web form — seat reserved, awaiting confirmation | Yes |
| `confirmed` | Manually confirmed by staff | Yes |
| `waitlist` | Session full at time of signup | No |
| `cancelled` | Signup withdrawn or removed by staff | No |

The system writes only `pending` or `waitlist`. Staff manually update rows to
`confirmed` or `cancelled`. Capacity is enforced against all rows where
`status` is NOT `waitlist` — so `pending`, `confirmed`, and any other
non-waitlist value all count. Set a row to `cancelled` (not deletion) to free
a seat so the next waitlisted person can be moved up.

---

## Environment Variables

Set these in Vercel → Project Settings → Environment Variables. Apply to
**Production** and **Preview** (staging) separately with different values.

| Variable | Used by | Notes |
|---|---|---|
| `GOOGLE_CLASSES_CALENDAR_ID` | `api/class-availability` | Calendar ID, e.g. `abc@group.calendar.google.com` |
| `GOOGLE_CALENDAR_API_KEY` | `api/class-availability` | API key restricted to Calendar API only |
| `GOOGLE_SIGNUPS_WEBAPP_URL` | `api/class-signup`, `api/class-availability` | Apps Script Web App exec URL |
| `GOOGLE_SIGNUPS_SHARED_SECRET` | `api/class-signup`, `api/class-availability` | Must match `SHARED_SECRET` Script Property |
| `CLASS_DEFAULT_CAPACITY` | both | `3` — must not exceed program guidelines |

`GOOGLE_SIGNUPS_SHEET_ID` is **not** a Vercel env var. Set it inside the Apps
Script `CONFIG.SPREADSHEET_ID` directly.

The first two vars (`CALENDAR_ID` + `API_KEY`) are sufficient for availability
reads only. All five are needed for signup writes.

---

## Staging vs. Production

Use separate Google Calendars, separate Sheets, and separate Apps Script
deployments for staging and production.

| Setting | Staging | Production |
|---|---|---|
| Calendar | staging classes calendar | production classes calendar |
| Sheet | Staging Signups sheet | Production Signups sheet |
| Apps Script | Separate deployment with its own URL + secret | Separate deployment with its own URL + secret |
| Vercel env scope | Preview | Production |

Each Apps Script deployment gets its own `GOOGLE_SIGNUPS_WEBAPP_URL` and its
own `SHARED_SECRET` Script Property. Use different `GOOGLE_SIGNUPS_SHARED_SECRET`
values in Vercel for Production and Preview.

---

## API Endpoints

### `GET /api/class-availability`

Returns upcoming sessions with seat counts.

**Query params:** `classId` (optional — filter to one class)

**Response `200`:**
```json
{
  "sessions": [
    {
      "eventId": "google-event-id",
      "classId": "digital-content-production",
      "title": "Digital Content Production — July 15",
      "start": "2026-07-15T10:00:00-04:00",
      "end":   "2026-07-15T12:00:00-04:00",
      "location": "Studio, NJ",
      "capacity": 3,
      "confirmedCount": 1,
      "seatsRemaining": 2,
      "status": "available"
    }
  ]
}
```

Status is `"available"` when `seatsRemaining > 0`, otherwise `"full"`.

If the Apps Script is not reachable, `confirmedCount` defaults to `0`
(graceful degradation — sessions still appear, seat counts show as full capacity).

### `POST /api/class-signup`

Accepts a signup request.

**Body (JSON):** `name`, `email`, `eventId`, `classId` (required);
`phone`, `notes` (optional).

**Responses:**

| HTTP | `result` | Meaning |
|---|---|---|
| 201 | `pending` | Signup accepted, seat reserved |
| 200 | `waitlist` | Session full, added to waitlist |
| 409 | `duplicate` | Already signed up for this session |
| 400 | — | Validation error |
| 503 | — | Upstream unavailable |

---

## Manual Test Checklist

Before going live, test each scenario against the staging environment:

**Apps Script Web App (test independently first):**
- [ ] `GET <WEBAPP_URL>` returns `{ ok: true, status: "Signups Web App is running" }`
- [ ] `POST <WEBAPP_URL>` with wrong secret returns `{ ok: false, error: "Unauthorized" }`
- [ ] `POST <WEBAPP_URL>` with `action: "list"` and correct secret returns `{ ok: true, rows: [] }` on empty sheet
- [ ] `POST <WEBAPP_URL>` with `action: "signup"` and correct secret appends a row to the sheet

**API endpoints:**
- [ ] `/api/class-availability` returns sessions when calendar has upcoming events
- [ ] `/api/class-availability` returns `sessions: []` when no upcoming events
- [ ] `/api/class-availability` returns `503` gracefully when `GOOGLE_CALENDAR_API_KEY` is wrong
- [ ] `/api/class-availability` returns sessions with `confirmedCount: 0` if Apps Script is unreachable
- [ ] `/api/class-signup` accepts a valid POST and appends a row in the sheet with `status: pending`
- [ ] `/api/class-signup` rejects a duplicate email + eventId with `result: duplicate`
- [ ] `/api/class-signup` records `status: waitlist` when active signups >= capacity

**Frontend:**
- [ ] Creative Workshops page shows "Loading available sessions…" briefly then renders cards
- [ ] Session card shows correct date, time, location, and seat count
- [ ] Signup form validates name and email client-side before submitting
- [ ] Signing up shows success message and disables the form
- [ ] Joining the waitlist shows the waitlist message
- [ ] Submitting a duplicate shows the duplicate message without disabling the form
- [ ] When API is down, page shows error with link to contact page
- [ ] Support Coordinators sidebar shows updated "max 3 participants" reference

---

## Adding a New Class

1. Add a calendar event whose title includes an alias for the new class ID.
2. Add the class ID to `VALID_CLASS_IDS` in `lib/google-class-services.js`.
3. Add title aliases to `CLASS_TITLE_ALIASES` in the same file.
4. Add display metadata to `content/classes.json`.
5. Regenerate Decap config: `npm run build:decap-config`.
