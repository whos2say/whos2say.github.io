/**
 * Vercel Edge Function — catch-all proxy for phish.in API v2.
 *
 * Routes (path segments after /api/phishin/):
 *   /api/phishin/search/Tweezer          → phish.in/api/v2/search/Tweezer
 *   /api/phishin/tracks?song_slug=tweezer → phish.in/api/v2/tracks?song_slug=tweezer
 *   /api/phishin/songs/tweezer            → phish.in/api/v2/songs/tweezer
 *   (any other v2 path)
 *
 * No API key is required for phish.in public endpoints.
 * Adds permissive CORS so the browser can call this from any origin.
 */
export const config = { runtime: 'edge' };

const PHISHIN_BASE = 'https://phish.in/api/v2';

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);

  // Strip the /api/phishin prefix to get the upstream path
  const prefix = '/api/phishin';
  const rest = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.pathname;

  const upstream = `${PHISHIN_BASE}${rest}${url.search}`;

  let res;
  try {
    res = await fetch(upstream, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'whostosay.org/art-experiment',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
