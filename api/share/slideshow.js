/**
 * Vercel Serverless Function — OG-tag shim for Facebook slideshow shares
 * Route: /share/slideshow?album={albumId}   (rewritten from vercel.json)
 *
 * Social crawlers (Facebook, Twitter/X, LinkedIn, etc.):
 *   → Returns a minimal HTML page with og: meta tags so platforms render
 *     a rich preview card. No JS needed — pure server-rendered HTML.
 *
 * Regular browser:
 *   → 302 redirect to /slideshow.html?album={albumId}&autoplay=1 with UTM
 *     params. autoplay=1 signals the slideshow to start playing immediately.
 */

const SITE_ORIGIN   = 'https://whostosay.org'
const SUPABASE_URL  = 'https://oiiluqrpzhujbvrblsko.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_BZ6oBk-5wHOMxr_Bw52dvA_7tuU0pHu'
const FALLBACK_IMG  = `${SITE_ORIGIN}/assets/images/W2S_Campaign.jpg`

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'whos2say'
}

function isSocialCrawler(userAgent) {
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|pinterest|slackbot|whatsapp|telegrambot|discordbot|applebot|googlebot/i
    .test(userAgent || '')
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
  const image        = coverUrl || FALLBACK_IMG

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
  <meta property="og:url"         content="${esc(canonicalUrl)}" />
  <meta property="og:image"       content="${esc(image)}" />
  <meta name="twitter:card"       content="summary_large_image" />
  <meta name="twitter:title"      content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"      content="${esc(image)}" />
</head>
<body></body>
</html>`
}

export default async function handler(req, res) {
  const albumId = req.query.album

  if (!albumId || typeof albumId !== 'string' || !albumId.trim()) {
    return res.redirect(302, '/albums.html')
  }

  const authHeaders = {
    apikey:        SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  }

  // ── 1. Fetch album name ─────────────────────────────────────────────────────
  let albumName = null
  try {
    const albumRes = await fetch(
      `${SUPABASE_URL}/rest/v1/albums?id=eq.${encodeURIComponent(albumId)}&select=name&limit=1`,
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
      `${SUPABASE_URL}/rest/v1/photos` +
        `?album_id=eq.${encodeURIComponent(albumId)}` +
        `&select=file_path` +
        `&order=sort_order.asc.nullslast,created_at.asc` +
        `&limit=1`,
      { headers: authHeaders }
    )
    if (photoRes.ok) {
      const [row] = await photoRes.json()
      if (row?.file_path) {
        coverUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${row.file_path}`
      }
    } else {
      console.error('[share/slideshow] photo fetch failed:', photoRes.status)
    }
  } catch (err) {
    console.error('[share/slideshow] photo fetch error:', err)
  }

  // ── 3a. Social crawler → serve OG HTML ─────────────────────────────────────
  const ua = req.headers['user-agent'] || ''
  if (isSocialCrawler(ua)) {
    const html = buildOgHtml({ albumId, albumName, coverUrl })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    return res.status(200).end(html)
  }

  // ── 3b. Regular browser → 302 with autoplay + UTM params ───────────────────
  // autoplay=1 tells slideshow.html to start playing immediately
  const campaign    = slugify(albumName)
  const destination =
    `/slideshow.html?album=${encodeURIComponent(albumId)}` +
    `&autoplay=1` +
    `&utm_source=facebook&utm_medium=social&utm_campaign=${encodeURIComponent(campaign)}`

  return res.redirect(302, destination)
}
