#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  GOOGLE_IDENTITY_SCOPES,
  STUDIO_CALLBACK_PATH,
  beginGoogleSignIn,
  claimMyParticipantInvites,
  endStudioSession,
  participantFriendlyAuthError,
  resolveOAuthCallback,
} from '../studio/js/studio-auth-core.js'
import {
  loadMyParticipantsWith,
  registryPreviewAllowed,
} from '../studio/js/participant-dashboard-core.js'

function authClient(overrides = {}) {
  return {
    auth: {
      signInWithOAuth: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      ...overrides,
    },
    rpc: async () => ({ data: [], error: null }),
  }
}

function dataClient({ accessRows = [], accessError = null, albumRows = [], albumError = null, rpcData = [], rpcError = null } = {}) {
  return {
    rpc: async () => ({ data: rpcData, error: rpcError }),
    from(table) {
      const builder = {
        select() { return this },
        eq() { return this },
        is() { return this },
        lte() { return this },
        or() {
          return Promise.resolve(table === 'participant_user_access'
            ? { data: accessRows, error: accessError }
            : { data: [], error: null })
        },
        in() {
          return Promise.resolve(table === 'participant_album_access'
            ? { data: albumRows, error: albumError }
            : { data: [], error: null })
        },
      }
      return builder
    },
  }
}

const djrRegistry = {
  participantId: 'participant-djr',
  displayName: 'David J. Richards',
  status: 'active',
  resources: {
    pageSlug: 'djr',
    brandKitSlug: 'djr',
    albumIds: ['album-1', 'album-2'],
  },
  access: {
    ownerUserIds: ['user-owner'],
    staffAdminUserIds: [],
    contributorUserIds: [],
  },
}
const codyRegistry = {
  participantId: 'participant-cody',
  displayName: 'Cody draft',
  status: 'draft',
  resources: { pageSlug: '', brandKitSlug: 'cody', albumIds: [] },
  access: { ownerUserIds: [], staffAdminUserIds: [], contributorUserIds: [] },
}
let registryReads = 0
async function registryLoader(slug) {
  registryReads += 1
  return slug === 'djr' ? djrRegistry : codyRegistry
}

// Signed out.
{
  const result = await loadMyParticipantsWith({
    client: dataClient(),
    registryLoader,
    locationLike: { hostname: 'www.whostosay.org', search: '' },
  }, null)
  assert.equal(result.source, 'none')
  assert.deepEqual(result.participants, [])
}

// Successful Google OAuth initiation uses PKCE callback destination and identity scopes only.
{
  let request
  const client = authClient({
    signInWithOAuth: async (value) => {
      request = value
      return { error: null }
    },
  })
  const result = await beginGoogleSignIn(client, 'https://www.whostosay.org')
  assert.equal(result.error, null)
  assert.equal(request.provider, 'google')
  assert.equal(request.options.scopes, GOOGLE_IDENTITY_SCOPES)
  assert.equal(request.options.redirectTo, `https://www.whostosay.org${STUDIO_CALLBACK_PATH}`)
  assert.equal(/photos|drive/i.test(request.options.scopes), false)
}

// Provider callback error.
{
  const result = await resolveOAuthCallback(authClient(), '?error=access_denied&error_description=Provider%20is%20not%20enabled')
  assert.equal(result.session, null)
  assert.match(result.error.message, /not enabled/i)
}

// Redirect mismatch and missing session use participant-friendly messages.
{
  const redirect = participantFriendlyAuthError({ code: 'redirect_uri_mismatch', message: 'redirect URL not allowlisted' })
  assert.match(redirect.message, /callback URL is not approved/i)
  const session = await resolveOAuthCallback(authClient(), '')
  assert.equal(session.session, null)
  assert.match(session.error.message, /could not establish a session/i)
}

// PKCE code exchange success.
{
  let exchangedCode = ''
  const session = { user: { id: 'user-owner', email: 'owner@example.invalid' } }
  const client = authClient({
    exchangeCodeForSession: async (code) => {
      exchangedCode = code
      return { data: { session }, error: null }
    },
  })
  const result = await resolveOAuthCallback(client, '?code=pkce-code')
  assert.equal(exchangedCode, 'pkce-code')
  assert.equal(result.session, session)
}

// Code exchange failure with no already-detected session.
{
  const client = authClient({
    exchangeCodeForSession: async () => ({ data: { session: null }, error: { code: 'flow_state_not_found', message: 'Code already used' } }),
  })
  const result = await resolveOAuthCallback(client, '?code=reused-code')
  assert.equal(result.session, null)
  assert.match(result.error.message, /expired|already used/i)
}

// detectSessionInUrl may win the race; failed second exchange accepts the existing session.
{
  const session = { user: { id: 'user-owner' } }
  const client = authClient({
    exchangeCodeForSession: async () => ({ data: { session: null }, error: { code: 'bad_code_verifier', message: 'Already exchanged' } }),
    getSession: async () => ({ data: { session }, error: null }),
  })
  const result = await resolveOAuthCallback(client, '?code=already-detected')
  assert.equal(result.session, session)
}

// Signed in with no assignment.
{
  const result = await loadMyParticipantsWith({
    client: dataClient(),
    registryLoader,
    locationLike: { hostname: 'www.whostosay.org', search: '' },
  }, { id: 'unassigned-user' })
  assert.equal(result.source, 'supabase')
  assert.deepEqual(result.participants, [])
}

// Signed in with DJR assignment and two RLS-visible album assignments.
{
  const client = dataClient({
    accessRows: [{
      access_role: 'participant_owner',
      participant: {
        id: 'participant-row-djr',
        registry_id: 'participant-djr',
        slug: 'djr',
        display_name: 'DJR Photography',
        status: 'active',
      },
    }],
    albumRows: [
      { participant_id: 'participant-row-djr' },
      { participant_id: 'participant-row-djr' },
    ],
  })
  const result = await loadMyParticipantsWith({
    client,
    registryLoader,
    locationLike: { hostname: 'www.whostosay.org', search: '' },
  }, { id: 'user-owner' })
  assert.equal(result.source, 'supabase')
  assert.equal(result.participants.length, 1)
  assert.equal(result.participants[0].participantId, 'participant-djr')
  assert.equal(result.participants[0].pageSlug, 'djr')
  assert.equal(result.participants[0].brandKitSlug, 'djr')
  assert.equal(result.participants[0].assignedAlbumCount, 2)
}

// Production RLS/table failure never falls back to registry authorization.
{
  registryReads = 0
  const result = await loadMyParticipantsWith({
    client: dataClient({ accessError: { code: '42501', message: 'RLS denied' } }),
    registryLoader,
    locationLike: { hostname: 'www.whostosay.org', search: '' },
  }, { id: 'user-owner' })
  assert.equal(result.source, 'unavailable')
  assert.deepEqual(result.participants, [])
  assert.equal(registryReads, 0)
  assert.equal(result.registryPreviewEnabled, false)
}

// Registry preview is disabled by default in production and explicit when requested.
assert.equal(registryPreviewAllowed({ hostname: 'www.whostosay.org', search: '' }), false)
assert.equal(registryPreviewAllowed({ hostname: 'www.whostosay.org', search: '?registryPreview=1' }), true)
assert.equal(registryPreviewAllowed({ hostname: 'localhost', search: '' }), true)

// Explicit development preview remains user-ID filtered and never exposes Cody without assignment.
{
  const result = await loadMyParticipantsWith({
    client: dataClient({ accessError: { code: 'PGRST205', message: 'Table unavailable' } }),
    registryLoader,
    locationLike: { hostname: 'localhost', search: '' },
  }, { id: 'user-owner' })
  assert.equal(result.source, 'registry-preview')
  assert.deepEqual(result.participants.map((item) => item.participantId), ['participant-djr'])
}

// Invitation claim and sign out.
{
  const claim = await claimMyParticipantInvites(dataClient({ rpcData: [] }))
  assert.deepEqual(claim.assignments, [])
  assert.equal(claim.error, null)
  const claimFailure = await claimMyParticipantInvites(dataClient({ rpcError: { code: 'PGRST202', message: 'RPC missing' } }))
  assert.equal(claimFailure.error.message, 'Participant access could not be verified.')
  const signedOut = await endStudioSession(authClient())
  assert.equal(signedOut.error, null)
}

// Sanitized errors never expose JWT/provider token material.
{
  const unsafe = participantFriendlyAuthError({
    code: 'auth_error',
    message: 'provider_token=secret eyJabc.def.ghi',
  })
  assert.equal(unsafe.diagnosticMessage.includes('secret'), false)
  assert.equal(unsafe.diagnosticMessage.includes('eyJabc'), false)
}

console.log('Studio Auth tests passed')
