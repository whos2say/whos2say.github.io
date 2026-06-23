# Class Calendar & Signup System

Google Calendar is the source of truth for public class dates. The website
reads upcoming events, maps them to class IDs, and lets visitors submit a
signup request. Signups are recorded in a Google Sheet.

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

## Google Sheets Setup

1. Create a Google Sheet for signups (one per environment — see
   Staging vs. Production below).
2. Add a tab named **`Signups`** exactly (case-sensitive).
3. Row 1 must be this header row (A–L):

   | A | B | C | D | E | F | G | H | I | J | K | L |
   |---|---|---|---|---|---|---|---|---|---|---|---|
   | timestamp | eventId | classId | classTitle | start | name | email | phone | notes | status | source | metadata |

   - `classTitle` — the Google Calendar event title at time of signup (for auditing)
   - `start` — ISO 8601 session start time (for auditing without re-querying the calendar)
   - `source` — always `web-form` for public signups; reserved for future channels
   - `metadata` — reserved; leave empty

4. Create a **Google Cloud service account**:
   - Cloud Console → IAM & Admin → Service Accounts → Create.
   - Download the JSON key file.
   - Share the spreadsheet with the service account email
     (`something@project.iam.gserviceaccount.com`) as **Editor**.
5. Set these env vars in Vercel:
   - `GOOGLE_SIGNUPS_SHEET_ID` — the spreadsheet ID from the URL.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the service account email.
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — the `private_key` value from
     the JSON key file. Paste it as one line in Vercel; the system
     normalizes `\n` escape sequences at runtime.

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
non-waitlist value all count. Update to `cancelled` (not deletion) to free a
seat so the next waitlisted person can be moved up.

---

## Environment Variables

All six must be set in Vercel for the feature to function. Only
`GOOGLE_CLASSES_CALENDAR_ID` and `GOOGLE_CALENDAR_API_KEY` are needed for
availability reads; all six are needed for signup writes.

```
GOOGLE_CLASSES_CALENDAR_ID        e.g. abc123@group.calendar.google.com
GOOGLE_CALENDAR_API_KEY            restricted API key (Calendar API only)
GOOGLE_SIGNUPS_SHEET_ID            spreadsheet ID (from sheet URL)
GOOGLE_SERVICE_ACCOUNT_EMAIL       service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
CLASS_DEFAULT_CAPACITY             3
```

Set each in Vercel → Project Settings → Environment Variables. Apply to
**Production** and **Preview** (staging) separately with different values
if you use separate calendars/sheets per environment (recommended).

---

## Staging vs. Production

Use separate Google Calendars and Google Sheets for staging and production.
This prevents test signups from polluting the production sheet.

| Setting | Staging | Production |
|---|---|---|
| Calendar | `staging-classes@group.calendar.google.com` | `prod-classes@group.calendar.google.com` |
| Sheet | Staging Signups sheet | Production Signups sheet |
| Vercel env scope | Preview | Production |

In Vercel, set all six env vars once for Production and once for Preview
(staging branch) with different values.

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

If Sheets is not configured, `confirmedCount` defaults to `0` (graceful
degradation — sessions still appear with full capacity).

### `POST /api/class-signup`

Accepts a signup request.

**Body (JSON):** `name`, `email`, `eventId`, `classId` (required);
`phone`, `notes` (optional).

**Responses:**

| Status | `result` | Meaning |
|---|---|---|
| 201 | `pending` | Signup accepted, seat reserved |
| 200 | `waitlist` | Session full, added to waitlist |
| 409 | `duplicate` | Already signed up for this session |
| 400 | — | Validation error |
| 503 | — | Upstream unavailable |

---

## Manual Test Checklist

Before going live, test each scenario against the staging environment:

- [ ] `/api/class-availability` returns sessions when calendar has upcoming events
- [ ] `/api/class-availability` returns `sessions: []` when no upcoming events
- [ ] `/api/class-availability` returns `503` gracefully when `GOOGLE_CALENDAR_API_KEY` is wrong
- [ ] `/api/class-signup` accepts a valid POST and appends a row to the sheet
- [ ] `/api/class-signup` rejects a duplicate email + eventId with `result: duplicate`
- [ ] `/api/class-signup` records `waitlist` when confirmedCount >= capacity
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
