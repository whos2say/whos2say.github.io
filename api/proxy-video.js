/**
 * Vercel Edge Function — Google Photos video proxy
 * Fetches Google Photos video server-side (bypasses browser CORS restriction)
 * and streams it back to the client.
 */
export const config = { runtime: 'edge' }

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let url, token
  try {
    ;({ url, token } = await req.json())
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  // Only proxy Google URLs — prevent open-proxy abuse
  if (!url || !/^https:\/\/(lh3|video-downloads)\.googleusercontent\.com\//.test(url)) {
    return new Response('Invalid URL — only Google URLs allowed', { status: 400 })
  }

  const upstream = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!upstream.ok) {
    return new Response(`Google returned ${upstream.status}`, { status: upstream.status })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}
