/**
 * Decap CMS GitHub OAuth — callback
 * GET /api/callback?code=...
 *
 * GitHub redirects here after the user approves access.
 * Exchanges the code for a token and posts it back to the Decap admin popup.
 */

import {
  exchangeCodeForToken,
  getOAuthConfig,
  renderCallbackPage,
  sendOAuthError,
} from '../lib/decap-oauth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendOAuthError(res, 405, 'Method not allowed')
  }

  const config = getOAuthConfig()
  if (!config) {
    console.error('[decap-oauth/callback] Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET')
    return sendOAuthError(res, 500, 'OAuth is not configured on this deployment.')
  }

  const error = req.query.error
  if (error) {
    const description = req.query.error_description || error
    return sendOAuthError(res, 400, `GitHub authorization denied: ${description}`)
  }

  const code = req.query.code
  if (!code || typeof code !== 'string') {
    return sendOAuthError(res, 400, 'Missing authorization code from GitHub.')
  }

  try {
    const token = await exchangeCodeForToken(code, config)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(renderCallbackPage(token))
  } catch (err) {
    console.error('[decap-oauth/callback]', err)
    return sendOAuthError(res, 502, err.message || 'Failed to complete GitHub login.')
  }
}
