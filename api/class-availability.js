/**
 * Vercel Serverless Function — GET /api/class-availability
 *
 * Returns upcoming class sessions from Google Calendar, enriched with
 * signup counts from Google Sheets. Capacity defaults to 3 per session.
 *
 * Query params:
 *   classId  string  optional — filter to one class ID
 *
 * Responses:
 *   200  { sessions: Session[] }
 *   400  { error: string }   — unknown classId
 *   405  { error: string }   — wrong method
 *   503  { error: string }   — upstream unavailable (no stack trace exposed)
 *
 * Session shape:
 *   { eventId, classId, title, start, end, location, capacity,
 *     confirmedCount, seatsRemaining, status }
 */

import { getCalendarSessions, getSignupRows, VALID_CLASS_IDS } from '../lib/google-class-services.js'

const ALLOWED_ORIGIN = 'https://whostosay.org'

function corsHeaders(origin) {
  const allowed =
    origin === ALLOWED_ORIGIN || (typeof origin === 'string' && origin.endsWith('.whostosay.org'))
      ? origin
      : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
    Vary: 'Origin',
  }
}

function json(res, status, body, extraHeaders = {}) {
  res.setHeader('Content-Type', 'application/json')
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v))
  res.status(status).end(JSON.stringify(body))
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' }, cors)
  }

  const { classId } = req.query || {}

  if (classId && !VALID_CLASS_IDS.has(classId)) {
    return json(res, 400, {
      error: `Unknown classId. Valid values: ${[...VALID_CLASS_IDS].join(', ')}`,
    }, cors)
  }

  try {
    const sessions = await getCalendarSessions({ classId })

    // Enrich with signup counts; degrade gracefully if Sheets is not configured.
    let signupRows = []
    try {
      signupRows = await getSignupRows()
    } catch (sheetsErr) {
      console.warn('[class-availability] Sheets unavailable — counts default to 0:', sheetsErr.message)
    }

    // Build eventId → confirmed-signup count.
    // Waitlist rows don't count toward capacity.
    const countMap = {}
    for (const row of signupRows) {
      if (!row.eventId || row.status === 'waitlist') continue
      countMap[row.eventId] = (countMap[row.eventId] || 0) + 1
    }

    const enriched = sessions.map(s => {
      const confirmedCount = countMap[s.eventId] || 0
      const seatsRemaining = Math.max(0, s.capacity - confirmedCount)
      return {
        eventId:       s.eventId,
        classId:       s.classId,
        title:         s.title,
        start:         s.start,
        end:           s.end,
        location:      s.location,
        capacity:      s.capacity,
        confirmedCount,
        seatsRemaining,
        status:        seatsRemaining > 0 ? 'available' : 'full',
      }
    })

    return json(res, 200, { sessions: enriched }, cors)

  } catch (err) {
    console.error('[class-availability] Error:', err.message)
    return json(res, 503, {
      error: 'Class schedule is temporarily unavailable. Please try again later.',
    }, cors)
  }
}
