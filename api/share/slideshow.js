/**
 * Vercel Serverless Function — OG-tag shim for Facebook slideshow shares
 * Route: /share/slideshow?album={albumId}   (rewritten from vercel.json)
 *
 * Facebook crawler (facebookexternalhit / Facebot):
 *   → Returns a minimal HTML page with og: meta tags so Facebook renders
 *     a rich preview card. No JS needed — pure server-rendered HTML.
 *
 * Regular browser:
 *   → 302 redirect to /slideshow.html?album={albumId} with UTM params
 *     so GA4 attributes the visit to facebook/social correctly.
 */

const SITE_ORIGIN = 'https://whostosay.org'

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'whos2say'
}

function isFacebookCrawler(userAgent) {
  return /facebookexternalhit|facebot/i.test(userAgent || '')
}

// Minimal HTML escaping for attribute values
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildOgHtml({ albumId, albumName, coverUrl }) {
  const title        = `${albumName} — Photo Slideshow`
  const description  = "Check out this photo slideshow from Who's 2 Say Foundation!"
  const canonicalUrl = `${SITE_ORIGIN}/share/slideshow?album=${encodeURIComponent(albumId)}`

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="Who&#39;s 2 Say Foundation" />
  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url"         content="${esc(canonicalUrl)}" />${coverUrl ? `
  <meta property="og:image"       content="${esc(coverUrl)}" />` : ''}
</head>
<body></body>
</html>`
}

export default async function handler(req, res) {
  const albumId = req.query.album

  if (!albumId || typeof albumId !== 'string' || !albumId.trim()) {
    return res.redirect(302, '/albums.html')
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[share/slideshow] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.redirect(302, `/slideshow.html?album=${encodeURIComponent(albumId)}`)
  }

  const authHeaders = {
    apikey:        serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }

  // ── 1. Fetch album name ─────────────────────────────────────────────────────
  let albumName = null
  try {
    const albumRes = await fetch(
      `${supabaseUrl}/rest/v1/albums?id=eq.${encodeURIComponent(albumId)}&select=name&limit=1`,
      { headers: authHeaders }
    )
    if (albumRes.ok) {
      const [row] = await albumRes.json()
      albumName = row?.name || null
    } else {
      console.error('[share/slideshow] album fetch failed:', albumRes.status)
    }
  } catch (err) {
    console.error('[share/slideshow] album fetch error:', err)
  }

  // Album not found — avoid showing an empty OG page
  if (!albumName) {
    return res.redirect(302, '/albums.html')
  }

  // ── 2. Fetch cover photo (first photo in album by sort_order then created_at) ─
  let coverUrl = null
  try {
    const photoRes = await fetch(
      `${supabaseUrl}/rest/v1/photos` +
        `?album_id=eq.${encodeURIComponent(albumId)}` +
        `&select=file_path` +
        `&order=sort_order.asc.nullslast,created_at.asc` +
        `&limit=1`,
      { headers: authHeaders }
    )
    if (photoRes.ok) {
      const [row] = await photoRes.json()
      if (row?.file_path) {
        coverUrl = `${supabaseUrl}/storage/v1/object/public/photos/${row.file_path}`
      }
    } else {
      console.error('[share/slideshow] photo fetch failed:', photoRes.status)
    }
  } catch (err) {
    console.error('[share/slideshow] photo fetch error:', err)
  }

  // ── 3a. Facebook crawler → serve OG HTML ───────────────────────────────────
  const ua = req.headers['user-agent'] || ''
  if (isFacebookCrawler(ua)) {
    const html = buildOgHtml({ albumId, albumName, coverUrl })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Cache for 5 min on CDN, allow stale for 1 min while revalidating
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    return res.status(200).end(html)
  }

  // ── 3b. Regular browser → 302 with UTM params ──────────────────────────────
  const campaign    = slugify(albumName)
  const destination =
    `/slideshow.html?album=${encodeURIComponent(albumId)}` +
    `&utm_source=facebook&utm_medium=social&utm_campaign=${encodeURIComponent(campaign)}`

  return res.redirect(302, destination)
}
