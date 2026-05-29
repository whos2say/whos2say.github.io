/**
 * Decap CMS GitHub OAuth — start authorization
 * GET /api/auth
 *
 * Decap opens this URL in a popup when an editor clicks "Login with GitHub".
 * Requires env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_REDIRECT_URI (optional)
 */

import {
  getOAuthConfig,
  redirectToGitHubAuthorize,
  sendOAuthError,
} from '../lib/decap-oauth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendOAuthError(res, 405, 'Method not allowed')
  }

  const config = getOAuthConfig()
  if (!config) {
    console.error('[decap-oauth/auth] Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET')
    return sendOAuthError(
      res,
      500,
      'OAuth is not configured on this deployment. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel.'
    )
  }

  return redirectToGitHubAuthorize(res, config)
}
