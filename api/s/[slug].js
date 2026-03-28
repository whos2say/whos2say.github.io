/**
 * Vercel Serverless Function — short-link redirector
 * Route: /s/:slug  (rewritten from vercel.json)
 *
 * Looks up the slug in the Supabase `short_links` table,
 * increments click_count (fire-and-forget), and 302-redirects
 * to the appropriate page with optional UTM params appended.
 */

export default async function handler(req, res) {
  const { slug } = req.query

  if (!slug) {
    return res.redirect(302, '/albums.html')
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[short-link] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.redirect(302, '/albums.html')
  }

  // ── 1. Fetch the short link row ───────────────────────────────────────────
  let link
  try {
    const apiRes = await fetch(
      `${supabaseUrl}/rest/v1/short_links` +
        `?slug=eq.${encodeURIComponent(slug)}` +
        `&select=id,target_type,target_id,utm_source,utm_medium,utm_campaign,click_count` +
        `&limit=1`,
      {
        headers: {
          apikey:        serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )

    if (!apiRes.ok) {
      console.error('[short-link] Supabase query failed:', apiRes.status, await apiRes.text())
      return res.redirect(302, '/albums.html')
    }

    const rows = await apiRes.json()
    link = rows?.[0]
  } catch (err) {
    console.error('[short-link] Fetch error:', err)
    return res.redirect(302, '/albums.html')
  }

  if (!link) {
    return res.redirect(302, '/albums.html')
  }

  // ── 2. Build redirect path ────────────────────────────────────────────────
  let basePath
  switch (link.target_type) {
    case 'album':
      basePath = `/album.html?id=${encodeURIComponent(link.target_id)}`
      break
    case 'slideshow':
      basePath = `/slideshow.html?album=${encodeURIComponent(link.target_id)}`
      break
    case 'multi-slideshow':
      basePath = `/multi-slideshow.html?albums=${encodeURIComponent(link.target_id)}`
      break
    default:
      console.warn('[short-link] Unknown target_type:', link.target_type)
      return res.redirect(302, '/albums.html')
  }

  // ── 3. Append UTM params (skip empty/null values) ─────────────────────────
  const utmParams = new URLSearchParams()
  if (link.utm_source)   utmParams.set('utm_source',   link.utm_source)
  if (link.utm_medium)   utmParams.set('utm_medium',   link.utm_medium)
  if (link.utm_campaign) utmParams.set('utm_campaign', link.utm_campaign)
  const utmString = utmParams.toString()
  const destination = utmString ? `${basePath}&${utmString}` : basePath

  // ── 4. Fire-and-forget click_count increment ─────────────────────────────
  // Not awaited — redirect goes out immediately; increment happens in background.
  fetch(
    `${supabaseUrl}/rest/v1/short_links?id=eq.${encodeURIComponent(link.id)}`,
    {
      method:  'PATCH',
      headers: {
        apikey:          serviceKey,
        Authorization:   `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify({ click_count: (link.click_count ?? 0) + 1 }),
    }
  ).catch(err => console.error('[short-link] click_count increment failed:', err))

  // ── 5. Redirect ───────────────────────────────────────────────────────────
  return res.redirect(302, destination)
}
