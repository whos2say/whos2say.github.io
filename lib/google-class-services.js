/**
 * Google Calendar + Sheets helpers for public class availability and signup.
 *
 * Calendar reads:  Google Calendar API + API key (public calendar).
 * Signup reads/writes: Google Apps Script Web App + shared secret.
 *   No service account JSON keys required — avoids iam.disableServiceAccountKeyCreation.
 *
 * Env vars required:
 *   GOOGLE_CLASSES_CALENDAR_ID   — calendar ID (e.g. abc123@group.calendar.google.com)
 *   GOOGLE_CALENDAR_API_KEY      — API key restricted to Google Calendar API
 *   GOOGLE_SIGNUPS_WEBAPP_URL    — Apps Script Web App exec URL
 *   GOOGLE_SIGNUPS_SHARED_SECRET — shared secret sent in every Apps Script request
 *   CLASS_DEFAULT_CAPACITY       — max seats per session (default: 3)
 *
 * See docs/class-calendar-signup.md for Apps Script setup and code sample.
 */

// ---------------------------------------------------------------------------
// Validated class IDs — single source of truth for server-side validation.
// Display metadata lives in content/classes.json.
// ---------------------------------------------------------------------------

export const VALID_CLASS_IDS = new Set([
  'digital-content-production',
  'sports-media-community',
])

// Lowercase substrings in a calendar event title that map to a classId.
const CLASS_TITLE_ALIASES = {
  'digital-content-production': [
    'digital content production',
    'digital content',
    'content production',
  ],
  'sports-media-community': [
    'sports media & community',
    'sports media and community',
    'sports media',
    'g&s class',
    'g & s class',
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

// ---------------------------------------------------------------------------
// Calendar: detect classId from event title
// ---------------------------------------------------------------------------

function detectClassId(title) {
  const lower = (title || '').toLowerCase()
  for (const [id, aliases] of Object.entries(CLASS_TITLE_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return id
  }
  return null
}

// Read an explicit "classId: <id>" annotation from the event description.
// Takes precedence over title-alias matching so event titles don't need to
// follow any naming convention as long as the description is annotated.
function detectClassIdFromDescription(description) {
  if (!description) return null
  const match = description.match(/^classId\s*:\s*([a-z0-9-]+)/im)
  if (!match) return null
  const candidate = match[1].trim()
  return VALID_CLASS_IDS.has(candidate) ? candidate : null
}

// ---------------------------------------------------------------------------
// Google Calendar — fetch upcoming sessions
// ---------------------------------------------------------------------------

/**
 * Fetch upcoming class sessions from Google Calendar.
 *
 * @param {{ classId?: string, maxResults?: number }} opts
 * @returns {Promise<Array<{eventId, classId, title, start, end, location, capacity}>>}
 */
export async function getCalendarSessions({ classId, maxResults = 50 } = {}) {
  const calendarId = requireEnv('GOOGLE_CLASSES_CALENDAR_ID')
  const apiKey     = requireEnv('GOOGLE_CALENDAR_API_KEY')
  const capacity   = Math.max(1, parseInt(process.env.CLASS_DEFAULT_CAPACITY || '3', 10))

  const params = new URLSearchParams({
    key:          apiKey,
    singleEvents: 'true',
    orderBy:      'startTime',
    timeMin:      new Date().toISOString(),
    maxResults:   String(maxResults),
    showDeleted:  'false',
  })

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendar API error (${res.status}): ${text}`)
  }

  const data  = await res.json()
  const items = data.items || []

  const sessions = []
  for (const event of items) {
    if (event.status === 'cancelled') continue
    const detectedId = detectClassIdFromDescription(event.description) || detectClassId(event.summary || '')
    if (!detectedId) continue
    if (classId && detectedId !== classId) continue

    sessions.push({
      eventId:  event.id,
      classId:  detectedId,
      title:    event.summary || '',
      start:    event.start?.dateTime || event.start?.date || '',
      end:      event.end?.dateTime   || event.end?.date   || '',
      location: event.location || '',
      capacity,
    })
  }

  return sessions
}

// ---------------------------------------------------------------------------
// Apps Script Web App — signup sheet operations
//
// Sheet tab: Signups
// Column order (A–L):
//   A: timestamp   B: eventId    C: classId    D: classTitle
//   E: start       F: name       G: email      H: phone
//   I: notes       J: status     K: source     L: metadata
//
// The Apps Script handles authentication via the shared secret.
// See docs/class-calendar-signup.md for the full Apps Script code sample.
// ---------------------------------------------------------------------------

async function callSignupsWebApp(payload) {
  const url    = requireEnv('GOOGLE_SIGNUPS_WEBAPP_URL')
  const secret = requireEnv('GOOGLE_SIGNUPS_SHARED_SECRET')

  const res  = await fetch(url, {
    method:   'POST',
    headers:  { 'Content-Type': 'application/json' },
    body:     JSON.stringify({ secret, ...payload }),
    redirect: 'follow',
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Apps Script HTTP error (${res.status}): ${text.slice(0, 200)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Apps Script response is not valid JSON: ${text.slice(0, 200)}`)
  }

  if (!data.ok) {
    throw new Error(data.error || 'Apps Script returned an error')
  }

  return data
}

/**
 * Read all signup rows from the sheet (excluding header).
 * @returns {Promise<Array<{timestamp, eventId, classId, classTitle, start, name, email, phone, notes, status, source, metadata}>>}
 */
export async function getSignupRows() {
  const data = await callSignupsWebApp({ action: 'list' })
  return data.rows || []
}

/**
 * Append one signup row to the sheet via the Apps Script Web App.
 * Column order must match the Apps Script CONFIG exactly:
 *   A:timestamp  B:eventId  C:classId  D:classTitle  E:start
 *   F:name       G:email    H:phone    I:notes        J:status  K:source  L:metadata
 *
 * @param {{ timestamp, eventId, classId, classTitle, start, name, email, phone, notes, status, source, metadata }} row
 */
export async function appendSignupRow(row) {
  await callSignupsWebApp({ action: 'signup', row })
}
