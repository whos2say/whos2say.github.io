/**
 * Vercel Serverless Function — create a short link
 * POST /api/create-short-link
 *
 * Body (JSON):
 *   slug         string  optional — auto-generated if omitted
 *   target_type  string  required — 'album' | 'slideshow' | 'multi-slideshow'
 *   target_id    string  required
 *   utm_campaign string  optional
 *
 * Headers:
 *   Authorization: Bearer <supabase-user-jwt>
 *
 * Returns:
 *   201  { success: true, short_url, slug, target_type, target_id }
 *   400  { error: "..." }           — bad input
 *   401  { error: "..." }           — missing / invalid auth
 *   405  { error: "..." }           — wrong method
 *   409  { error: "...", slug }     — slug already taken
 *   500  { error: "..." }           — server error
 */

const ALLOWED_ORIGIN  = 'https://whostosay.org'
const SITE_ORIGIN     = 'https://whostosay.org'
const SLUG_CHARS      = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SLUG_LENGTH     = 6
const VALID_TYPES     = new Set(['album', 'slideshow', 'multi-slideshow'])
// Slugs must be 3-64 URL-safe characters
const SLUG_REGEX      = /^[a-z0-9_-]{3,64}$/

function randomSlug() {
  let s = ''
  for (let i = 0; i < SLUG_LENGTH; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)]
  }
  return s
}

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin?.endsWith('.whostosay.org')
    ? origin
    : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
    Vary:                           'Origin',
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

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  cors['Access-Control-Allow-Origin'])
    res.setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods'])
    res.setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers'])
    res.setHeader('Access-Control-Max-Age',       cors['Access-Control-Max-Age'])
    res.setHeader('Vary', cors.Vary)
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' }, cors)
  }

  // ── Env vars ──────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[create-short-link] Missing env vars')
    return json(res, 500, { error: 'Server misconfiguration' }, cors)
  }

  // ── Auth — verify the caller's Supabase JWT ───────────────────────────────
  const authHeader = req.headers.authorization || ''
  const userToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!userToken) {
    return json(res, 401, { error: 'Authorization header required (Bearer <token>)' }, cors)
  }

  // Ask Supabase to validate the token and return the user
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${userToken}`,
    },
  })

  if (!userRes.ok) {
    return json(res, 401, { error: 'Invalid or expired auth token' }, cors)
  }

  const authUser = await userRes.json()
  if (!authUser?.id) {
    return json(res, 401, { error: 'Could not verify user identity' }, cors)
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
  } catch {
    return json(res, 400, { error: 'Request body must be valid JSON' }, cors)
  }

  const { slug: rawSlug, target_type, target_id, utm_campaign } = body ?? {}

  if (!target_type || !VALID_TYPES.has(target_type)) {
    return json(res, 400, {
      error: `target_type is required and must be one of: ${[...VALID_TYPES].join(', ')}`,
    }, cors)
  }

  if (!target_id || typeof target_id !== 'string' || !target_id.trim()) {
    return json(res, 400, { error: 'target_id is required' }, cors)
  }

  // Normalise and validate slug
  const slug = rawSlug ? String(rawSlug).toLowerCase().trim() : randomSlug()

  if (!SLUG_REGEX.test(slug)) {
    return json(res, 400, {
      error: 'slug must be 3–64 characters: lowercase letters, digits, hyphens, underscores only',
    }, cors)
  }

  // ── Insert into short_links ───────────────────────────────────────────────
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/short_links`, {
    method:  'POST',
    headers: {
      apikey:          serviceKey,
      Authorization:   `Bearer ${serviceKey}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify({
      slug,
      target_type:  target_type.trim(),
      target_id:    target_id.trim(),
      utm_campaign: utm_campaign?.trim() || null,
      utm_source:   'short_link',
      utm_medium:   'redirect',
      click_count:  0,
    }),
  })

  if (!insertRes.ok) {
    const errText = await insertRes.text()
    let errJson
    try { errJson = JSON.parse(errText) } catch { /* raw text fallback */ }

    // Postgres unique-violation code = 23505
    if (insertRes.status === 409 || errJson?.code === '23505') {
      return json(res, 409, {
        error: `The slug "${slug}" is already taken. Choose a different one or omit slug to get an auto-generated one.`,
        slug,
      }, cors)
    }

    console.error('[create-short-link] Supabase insert failed:', insertRes.status, errText)
    return json(res, 500, { error: 'Failed to create short link' }, cors)
  }

  const [row] = await insertRes.json()

  const short_url = `${SITE_ORIGIN}/s/${row.slug}`

  return json(res, 201, {
    success:     true,
    short_url,
    slug:        row.slug,
    target_type: row.target_type,
    target_id:   row.target_id,
  }, cors)
}
