/**
 * Vercel Edge Function — proxies phish.in/api/v2/* with permissive CORS.
 * Used when phish.in's MP3 CORS headers don't include whostosay.org.
 *
 * Usage from index.html:
 *   fetch('/api/phishin-proxy?path=tracks%3Fsong_slug%3Dtweezer')
 */
export const config = { runtime: 'edge' };

const PHISHIN_API = 'https://phish.in/api/v2';

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') || '';

  const upstream = `${PHISHIN_API}/${path}`;
  const res = await fetch(upstream, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
