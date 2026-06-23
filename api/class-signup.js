/**
 * Vercel Serverless Function — POST /api/class-signup
 *
 * Accepts a class session signup request and records it in Google Sheets.
 *
 * Body (JSON):
 *   name      string  required
 *   email     string  required
 *   eventId   string  required — Google Calendar event ID
 *   classId   string  required — must be a configured public class ID
 *   phone     string  optional
 *   notes     string  optional
 *
 * Responses:
 *   201  { result: 'pending',   message: string }  — signup accepted
 *   200  { result: 'waitlist',  message: string }  — added to waitlist
 *   400  { error: string }                          — validation failure
 *   405  { error: string }                          — wrong method
 *   409  { result: 'duplicate', message: string }  — already signed up
 *   503  { error: string }                          — upstream unavailable
 */

import {
  getCalendarSessions,
  getSignupRows,
  appendSignupRow,
  VALID_CLASS_IDS,
} from '../lib/google-class-services.js'

const ALLOWED_ORIGIN = 'https://whostosay.org'
const EMAIL_RE       = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function corsHeaders(origin) {
  const allowed =
    origin === ALLOWED_ORIGIN || (typeof origin === 'string' && origin.endsWith('.whostosay.org'))
      ? origin
      : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' }, cors)
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body
  try {
    body = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body)
  } catch {
    return json(res, 400, { error: 'Request body must be valid JSON' }, cors)
  }

  const {
    name,
    email,
    eventId,
    classId,
    phone = '',
    notes = '',
  } = body ?? {}

  // ── Validate required fields ──────────────────────────────────────────────
  if (!name || typeof name !== 'string' || !name.trim()) {
    return json(res, 400, { error: 'name is required' }, cors)
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return json(res, 400, { error: 'A valid email address is required' }, cors)
  }
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    return json(res, 400, { error: 'eventId is required' }, cors)
  }
  if (!classId || !VALID_CLASS_IDS.has(classId)) {
    return json(res, 400, {
      error: `classId must be one of: ${[...VALID_CLASS_IDS].join(', ')}`,
    }, cors)
  }

  try {
    // ── Validate session exists in calendar ───────────────────────────────
    const sessions = await getCalendarSessions({})
    const session  = sessions.find(s => s.eventId === eventId)

    if (!session) {
      return json(res, 400, {
        error: 'The selected session is no longer available. Please reload the page and choose again.',
      }, cors)
    }

    if (session.classId !== classId) {
      return json(res, 400, { error: 'classId does not match the selected session.' }, cors)
    }

    // ── Read existing signups ─────────────────────────────────────────────
    const existingRows = await getSignupRows()

    // ── Duplicate check ───────────────────────────────────────────────────
    const normalEmail = email.toLowerCase().trim()
    const duplicate   = existingRows.some(
      r => r.email.toLowerCase() === normalEmail && r.eventId === eventId,
    )
    if (duplicate) {
      return json(res, 409, {
        result:  'duplicate',
        message: 'You are already signed up for this session.',
      }, cors)
    }

    // ── Capacity check ────────────────────────────────────────────────────
    const activeCount = existingRows.filter(
      r => r.eventId === eventId && r.status !== 'waitlist',
    ).length
    const status = activeCount < session.capacity ? 'pending' : 'waitlist'

    // ── Record signup ─────────────────────────────────────────────────────
    await appendSignupRow({
      timestamp:  new Date().toISOString(),
      eventId:    eventId.trim(),
      classId,
      classTitle: session.title,
      start:      session.start,
      name:       name.trim(),
      email:      normalEmail,
      phone:      String(phone || '').trim(),
      notes:      String(notes || '').trim(),
      status,
      source:     'web-form',
      metadata:   '',
    })

    if (status === 'waitlist') {
      return json(res, 200, {
        result:  'waitlist',
        message: "This session is full. You've been added to the waitlist — we'll reach out if a spot opens.",
      }, cors)
    }

    return json(res, 201, {
      result:  'pending',
      message: "Your signup request has been received. We'll be in touch to confirm your spot.",
    }, cors)

  } catch (err) {
    console.error('[class-signup] Error:', err.message)
    return json(res, 503, {
      error: 'Signup is temporarily unavailable. Please try again or contact us directly.',
    }, cors)
  }
}
