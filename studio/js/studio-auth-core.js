export const STUDIO_PATH = '/studio/'
export const STUDIO_CALLBACK_PATH = '/studio/auth/callback/'
export const GOOGLE_IDENTITY_SCOPES = 'openid email profile'
export const SUPABASE_GOOGLE_CALLBACK = 'https://oiiluqrpzhujbvrblsko.supabase.co/auth/v1/callback'

function cleanErrorText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/(?:access|refresh|provider)_token["'=:\s]+[^\s&"']+/gi, '[redacted-token]')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 240)
}

export const sanitizeDiagnosticText = cleanErrorText

export function participantFriendlyAuthError(error, fallback = 'Sign in could not be completed.') {
  const code = cleanErrorText(error?.code || error?.error || 'auth_error') || 'auth_error'
  const rawMessage = cleanErrorText(error?.message || error?.error_description || String(error || ''))
  const normalized = `${code} ${rawMessage}`.toLowerCase()
  let message = fallback

  if (/provider.*(?:disabled|not enabled|unsupported)|validation_failed/.test(normalized)) {
    message = 'Google sign-in is not enabled for Studio yet. A Studio administrator must enable the Google provider in Supabase.'
  } else if (/redirect|redirect_uri_mismatch|not allowlisted|not allowed/.test(normalized)) {
    message = 'The Studio callback URL is not approved. A Studio administrator must update the Google and Supabase redirect settings.'
  } else if (/expired|reused|already used|bad_code|code verifier|flow_state|exchange/.test(normalized)) {
    message = 'This sign-in link has expired or was already used. Return to Studio and start sign-in again.'
  } else if (/session|no active/.test(normalized)) {
    message = 'Studio could not establish a session. Return to Studio and try signing in again.'
  }

  return { code, message, diagnosticMessage: rawMessage || message }
}

export async function beginGoogleSignIn(client, origin) {
  try {
    const redirectTo = new URL(STUDIO_CALLBACK_PATH, origin).href
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, scopes: GOOGLE_IDENTITY_SCOPES },
    })
    if (error) return { session: null, error: participantFriendlyAuthError(error) }
    return { session: null, error: null }
  } catch (error) {
    return { session: null, error: participantFriendlyAuthError(error) }
  }
}

export async function resolveOAuthCallback(client, search = '') {
  const params = new URLSearchParams(search)
  const providerError = params.get('error_description') || params.get('error')
  if (providerError) {
    return { session: null, error: participantFriendlyAuthError({ code: params.get('error') || 'provider_error', message: providerError }) }
  }

  try {
    const code = params.get('code')
    if (code) {
      const exchanged = await client.auth.exchangeCodeForSession(code)
      if (exchanged?.data?.session) return { session: exchanged.data.session, error: null }

      // detectSessionInUrl may have completed the same PKCE exchange during client
      // initialization. Accept that session without attempting a second redirect.
      const existing = await client.auth.getSession()
      if (existing?.data?.session) return { session: existing.data.session, error: null }
      return { session: null, error: participantFriendlyAuthError(exchanged?.error, 'Studio could not exchange the sign-in code for a session.') }
    }

    const existing = await client.auth.getSession()
    if (existing?.data?.session) return { session: existing.data.session, error: null }
    return { session: null, error: participantFriendlyAuthError(existing?.error || { code: 'session_unavailable', message: 'No active session was found.' }) }
  } catch (error) {
    return { session: null, error: participantFriendlyAuthError(error) }
  }
}

export async function claimMyParticipantInvites(client) {
  try {
    const { data, error } = await client.rpc('claim_my_participant_access_invites')
    if (error) {
      return {
        assignments: [],
        error: {
          code: cleanErrorText(error.code || 'access_system_unavailable'),
          message: 'Participant access could not be verified.',
          diagnosticMessage: cleanErrorText(error.message || ''),
        },
      }
    }
    return { assignments: Array.isArray(data) ? data : [], error: null }
  } catch (error) {
    return {
      assignments: [],
      error: {
        code: cleanErrorText(error?.code || 'access_system_unavailable'),
        message: 'Participant access could not be verified.',
        diagnosticMessage: cleanErrorText(error?.message || ''),
      },
    }
  }
}

export async function endStudioSession(client) {
  try {
    const { error } = await client.auth.signOut()
    return error ? { error: participantFriendlyAuthError(error, 'Sign out failed. Please try again.') } : { error: null }
  } catch (error) {
    return { error: participantFriendlyAuthError(error, 'Sign out failed. Please try again.') }
  }
}
