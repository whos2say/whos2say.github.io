/**
 * Google Calendar + Sheets helpers for public class availability and signup.
 *
 * Calendar read:  API key (public calendar, no auth needed).
 * Sheets write:   Service account JWT (RS256, no SDK dependency).
 *
 * Env vars required:
 *   GOOGLE_CLASSES_CALENDAR_ID       — calendar ID (e.g. abc123@group.calendar.google.com)
 *   GOOGLE_CALENDAR_API_KEY          — API key with Calendar read scope
 *   GOOGLE_SIGNUPS_SHEET_ID          — spreadsheet ID for signup rows
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL     — service account email
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — PEM private key (\\n escaped in Vercel dashboard)
 *   CLASS_DEFAULT_CAPACITY           — default seats per session (default: 3)
 */

import { createSign } from 'crypto'

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

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ---------------------------------------------------------------------------
// Service account JWT + token exchange (for Sheets)
// ---------------------------------------------------------------------------

function buildServiceAccountJwt(email, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000)
  const header  = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(Buffer.from(JSON.stringify({
    iss:  email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:  'https://oauth2.googleapis.com/token',
    exp:  now + 3600,
    iat:  now,
  })))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const sig = base64url(signer.sign(privateKeyPem))
  return `${header}.${payload}.${sig}`
}

async function getSheetsAccessToken() {
  const email  = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const rawKey = requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  // Vercel stores multiline keys with literal \n — normalize to real newlines.
  const key    = rawKey.replace(/\\n/g, '\n').trim()
  const jwt    = buildServiceAccountJwt(email, key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('Google token exchange returned no access_token')
  return data.access_token
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
  const items = (data.items || [])

  const sessions = []
  for (const event of items) {
    if (event.status === 'cancelled') continue
    const detectedId = detectClassId(event.summary || '')
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
// Google Sheets — read + append signup rows
// ---------------------------------------------------------------------------

// Sheet tab name and column layout (A=index 0):
//   A: timestamp   B: eventId    C: classId    D: classTitle
//   E: start       F: name       G: email      H: phone
//   I: notes       J: status     K: source     L: metadata

const SHEET_TAB   = 'Signups'
const READ_RANGE  = `${SHEET_TAB}!A2:L`   // skip header row, 12 columns
const WRITE_RANGE = `${SHEET_TAB}!A1`     // append API finds last row automatically

function rowToObject(row) {
  return {
    timestamp:  row[0]  || '',
    eventId:    row[1]  || '',
    classId:    row[2]  || '',
    classTitle: row[3]  || '',
    start:      row[4]  || '',
    name:       row[5]  || '',
    email:      row[6]  || '',
    phone:      row[7]  || '',
    notes:      row[8]  || '',
    status:     row[9]  || '',
    source:     row[10] || '',
    metadata:   row[11] || '',
  }
}

/**
 * Read all signup rows (excluding header).
 * @returns {Promise<Array<{timestamp, eventId, classId, classTitle, start, name, email, phone, notes, status, source, metadata}>>}
 */
export async function getSignupRows() {
  const sheetId = requireEnv('GOOGLE_SIGNUPS_SHEET_ID')
  const token   = await getSheetsAccessToken()
  const url     = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(READ_RANGE)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets read error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return (data.values || []).map(rowToObject)
}

/**
 * Append one signup row to the sheet.
 * Column order must match the header row exactly:
 *   A:timestamp  B:eventId  C:classId  D:classTitle  E:start
 *   F:name       G:email    H:phone    I:notes        J:status  K:source  L:metadata
 *
 * @param {{ timestamp, eventId, classId, classTitle, start, name, email, phone, notes, status, source, metadata }} row
 */
export async function appendSignupRow(row) {
  const sheetId = requireEnv('GOOGLE_SIGNUPS_SHEET_ID')
  const token   = await getSheetsAccessToken()
  const url     = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(WRITE_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[
        row.timestamp,
        row.eventId,
        row.classId,
        row.classTitle,
        row.start,
        row.name,
        row.email,
        row.phone,
        row.notes,
        row.status,
        row.source,
        row.metadata,
      ]],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets append error (${res.status}): ${text}`)
  }
}
