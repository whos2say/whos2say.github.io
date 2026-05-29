/**
 * Shared helpers for Decap CMS GitHub OAuth on Vercel.
 * See docs/CONTENT_EDITING.md and .env.example.
 */

const DEFAULT_SITE_ORIGIN = 'https://whostosay.org'
const DEFAULT_CALLBACK_PATH = '/api/callback'

/**
 * @returns {{ clientId: string, clientSecret: string, redirectUri: string, scope: string } | null}
 */
export function getOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI ||
    `${process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN}${DEFAULT_CALLBACK_PATH}`

  if (!clientId || !clientSecret) {
    return null
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scope: process.env.GITHUB_OAUTH_SCOPE || 'repo',
  }
}

/**
 * Redirect browser to GitHub authorization.
 * @param {import('http').ServerResponse} res
 */
export function redirectToGitHubAuthorize(res, config) {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', config.scope)

  res.writeHead(302, { Location: url.toString() })
  res.end()
}

/**
 * Exchange authorization code for GitHub access token.
 * @param {string} code
 * @param {{ clientId: string, clientSecret: string, redirectUri: string }} config
 */
export async function exchangeCodeForToken(code, config) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GitHub token exchange failed (${response.status}): ${text}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error_description || data.error)
  }

  if (!data.access_token) {
    throw new Error('GitHub did not return an access token')
  }

  return data.access_token
}

/**
 * HTML page that completes Decap CMS popup auth via postMessage.
 * Pattern matches Decap's external OAuth proxy contract.
 * @param {string} token
 */
export function renderCallbackPage(token) {
  const safeToken = JSON.stringify(token)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authorizing…</title>
</head>
<body>
  <p>Authorizing with GitHub…</p>
  <script>
    (function () {
      var token = ${safeToken};
      function receiveMessage(message) {
        window.opener.postMessage(
          'authorization:github:success:' + JSON.stringify({ token: token, provider: 'github' }),
          message.origin
        );
        window.close();
      }
      window.addEventListener('message', receiveMessage, false);
      if (window.opener) {
        window.opener.postMessage('authorizing:github', '*');
      }
    })();
  </script>
</body>
</html>`
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {string} message
 */
export function sendOAuthError(res, status, message) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(
    `<!DOCTYPE html><html><body><h1>OAuth error</h1><p>${escapeHtml(message)}</p><p>You can close this window.</p></body></html>`
  )
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
