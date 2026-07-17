#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildParticipantProfilePreview,
  createParticipantProfileDraftWith,
  emptyParticipantProfile,
  loadParticipantProfileWith,
  saveParticipantProfileDraftWith,
  submitParticipantProfileRevisionWith,
  validateParticipantProfile,
} from '../studio/js/participant-profile-core.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function queryResult({ data = null, error = null } = {}) {
  return { data, error }
}

function tableClient(state = {}) {
  const calls = []
  return {
    calls,
    from: tableName => ({
      table: tableName,
      updates: null,
      select() { return this },
      eq(column, value) {
        this[`${column}Eq`] = value
        return this
      },
      order() { return this },
      limit() {
        return Promise.resolve(state.revisionsResult || queryResult({ data: state.revisions || [] }))
      },
      maybeSingle() {
        if (tableName === 'participants') return Promise.resolve(state.participantResult || queryResult({ data: state.participant || null }))
        if (tableName === 'participant_profiles') return Promise.resolve(state.profileResult || queryResult({ data: state.profile || null }))
        if (tableName === 'participant_profile_revisions') {
          if (this.updates) calls.push({ table: tableName, updates: this.updates, revisionId: this.idEq, status: this.revision_statusEq })
          return Promise.resolve(state.saveResult || queryResult({ data: state.savedRevision || null }))
        }
        return Promise.resolve(queryResult())
      },
      update(updates) {
        this.updates = updates
        return this
      },
    }),
    rpc: async (name, params) => {
      calls.push({ rpc: name, params })
      if (name === 'create_my_participant_profile_draft') return state.createResult || queryResult({ data: [state.createdRevision] })
      if (name === 'submit_my_participant_profile_revision') return state.submitResult || queryResult({ data: [state.submittedRevision] })
      return queryResult()
    },
  }
}

function profile(overrides = {}) {
  return {
    ...emptyParticipantProfile(),
    publicIdentity: { ...emptyParticipantProfile().publicIdentity, displayName: 'DJR Photography', ...overrides.publicIdentity },
    contactProfile: {
      ...emptyParticipantProfile().contactProfile,
      enabled: true,
      publicEmail: 'hello@example.invalid',
      publicPhoneDisplay: '+1 555 0100',
      ...overrides.contactProfile,
    },
    socialProfiles: overrides.socialProfiles || [{ platform: 'instagram', handle: 'djr.photo', enabled: true }],
    visibility: { ...emptyParticipantProfile().visibility, ...overrides.visibility },
  }
}

const participant = { id: 'db-djr', registry_id: 'participant-djr', slug: 'djr', display_name: 'DJR Photography', status: 'active' }
const baseAccess = { access_role: 'participant_owner', can_edit_profile: true, can_submit_review: true, starts_at: '2026-01-01T00:00:00Z', expires_at: null, revoked_at: null }
const revision = {
  id: 'revision-djr',
  profile_id: 'profile-djr',
  revision_number: 1,
  revision_status: 'draft',
  public_identity: { displayName: 'DJR Photography' },
  contact_profile: {},
  social_profiles: [],
  visibility: {},
  consent: {},
}

// Assigned owner can load DJR and edit/submit the profile draft.
{
  const client = tableClient({
    participant,
    accessRows: [baseAccess],
    profile: { id: 'profile-djr', participant_id: 'db-djr', lifecycle_status: 'draft' },
    revisions: [revision],
  })
  client.from = (table) => {
    const builder = {
      select() { return this },
      eq() { return this },
      maybeSingle: () => Promise.resolve(table === 'participants'
        ? queryResult({ data: participant })
        : queryResult({ data: { id: 'profile-djr', participant_id: 'db-djr', lifecycle_status: 'draft' } })),
      order() { return this },
      limit: () => Promise.resolve(queryResult({ data: [revision] })),
    }
    if (table === 'participant_user_access') builder.eq = () => ({ eq: () => Promise.resolve(queryResult({ data: [baseAccess] })) })
    return builder
  }
  const result = await loadParticipantProfileWith(client, 'participant-djr', 'user-owner')
  assert.equal(result.status, 'ok')
  assert.equal(result.access.canEditProfile, true)
  assert.equal(result.access.canSubmitReview, true)
}

// Unassigned users and Cody are denied by absence of RLS-visible access/profile rows.
{
  const client = tableClient()
  client.from = (table) => ({
    select() { return this },
    eq() { return this },
    maybeSingle: () => Promise.resolve(table === 'participants' ? queryResult({ data: participant }) : queryResult({ data: null })),
  })
  const result = await loadParticipantProfileWith(client, 'participant-djr', 'unassigned')
  assert.equal(result.status, 'unauthorized')
  const cody = await loadParticipantProfileWith(client, 'participant-cody', 'unassigned')
  assert.equal(cody.status, 'unauthorized')
}

// Contributors cannot edit; participant admins can edit only with the explicit capability.
{
  const contributor = { ...baseAccess, access_role: 'contributor', can_edit_profile: true }
  const adminDenied = { ...baseAccess, access_role: 'participant_admin', can_edit_profile: false }
  const adminAllowed = { ...baseAccess, access_role: 'participant_admin', can_edit_profile: true }
  for (const [row, expected] of [[contributor, false], [adminDenied, false], [adminAllowed, true]]) {
    const client = tableClient()
    client.from = (table) => ({
      select() { return this },
      eq() { return this },
      maybeSingle: () => Promise.resolve(table === 'participants' ? queryResult({ data: participant }) : queryResult({ data: null })),
      order() { return this },
      limit: () => Promise.resolve(queryResult({ data: [] })),
    })
    const originalFrom = client.from
    client.from = (table) => table === 'participant_user_access'
      ? { select() { return this }, eq() { return { eq: () => Promise.resolve(queryResult({ data: [row] })) } } }
      : originalFrom(table)
    const result = await loadParticipantProfileWith(client, 'participant-djr', 'user')
    assert.equal(result.access.canEditProfile, expected)
  }
}

// Safe payload validation rejects raw HTML, arbitrary URLs, and invalid socials.
{
  assert.equal(validateParticipantProfile(profile()).valid, true)
  assert.equal(validateParticipantProfile(profile({ publicIdentity: { displayName: '<b>DJR</b>' } })).valid, false)
  assert.equal(validateParticipantProfile(profile({ publicIdentity: { locationText: 'https://example.com' } })).valid, false)
  assert.equal(validateParticipantProfile(profile({ socialProfiles: [{ platform: 'instagram', handle: 'https://instagram.com/djr', enabled: true }] })).valid, false)
  assert.equal(validateParticipantProfile(profile({ socialProfiles: [{ platform: 'threads', handle: 'djr', enabled: true }] })).valid, false)
}

// Preview respects visibility and never leaks hidden contact/social fields.
{
  const hidden = buildParticipantProfilePreview(profile({
    visibility: { showLocation: false, showEmail: false, showPhone: false, showSocialProfiles: false },
  }))
  assert.deepEqual(hidden.visibleLines, [])
  assert.deepEqual(hidden.socials, [])
  assert.equal(hidden.footerSummary.includes('hello@example.invalid'), false)
  const visible = buildParticipantProfilePreview(profile({
    publicIdentity: { locationText: 'Bethlehem, PA' },
    visibility: { showLocation: true, showEmail: true, showPhone: true, showSocialProfiles: true },
  }))
  assert.deepEqual(visible.visibleLines, ['Bethlehem, PA', 'hello@example.invalid', '+1 555 0100'])
  assert.deepEqual(visible.socials, [{ platform: 'instagram', handle: 'djr.photo' }])
}

// Save draft updates only structured safe columns on active draft revisions.
{
  const client = tableClient({ savedRevision: revision })
  const result = await saveParticipantProfileDraftWith(client, 'revision-djr', profile())
  assert.equal(result.error, null)
  assert.equal(result.errors.length, 0)
  assert.equal(client.calls[0].table, 'participant_profile_revisions')
  assert.deepEqual(Object.keys(client.calls[0].updates).sort(), ['consent', 'contact_profile', 'public_identity', 'social_profiles', 'updated_at', 'visibility'])
}

// Save validation and network/RLS errors are participant-safe.
{
  const invalid = await saveParticipantProfileDraftWith(tableClient(), 'revision-djr', profile({ publicIdentity: { displayName: '<script>x</script>' } }))
  assert.equal(invalid.revision, null)
  assert.match(invalid.errors.join(' '), /HTML/)
  const failure = await saveParticipantProfileDraftWith(tableClient({ saveResult: queryResult({ error: { code: '42501', message: 'RLS denied service_role_key=\"secret\"' } }) }), 'revision-djr', profile())
  assert.equal(failure.error.message.includes('secret'), false)
}

// Create and submit use RPCs instead of direct insert/status mutation.
{
  const created = await createParticipantProfileDraftWith(tableClient({ createdRevision: revision }), 'db-djr')
  assert.equal(created.revision.id, 'revision-djr')
  const submitted = await submitParticipantProfileRevisionWith(tableClient({ submittedRevision: { ...revision, revision_status: 'submitted' } }), 'revision-djr')
  assert.equal(submitted.revision.revision_status, 'submitted')
}

// Static contracts: no public profile rendering, no Cody public artifacts, no approve UI, and no secrets.
{
  const profileEditor = read('studio/js/participant-profile-editor.js')
  const profileSql = read('supabase/studio-participant-profile-schema.sql')
  assert.equal(/approve-profile|profile-approve|Approve Profile/.test(profileEditor), false)
  assert.match(profileSql, /profile_revisions_staff_manage/)
  assert.match(profileSql, /participant_profile_revisions_no_self_review_check/)
  assert.match(profileSql, /review_requests_no_self_review_check/)
  assert.match(profileSql, /participant_user_access_participant_id_user_id_access_role_key/)
  assert.equal(fs.existsSync(path.join(root, 'cody')), false)
  assert.equal(fs.existsSync(path.join(root, 'studio/participants/cody')), false)
  assert.equal(/participant_profiles|participant_profile_revisions/.test(read('djr/js/djr-content.js')), false)
  for (const relativePath of [
    'studio/js/participant-profile-core.js',
    'studio/js/participant-profile-editor.js',
    'supabase/studio-participant-profile-schema.sql',
    'supabase/studio-participant-profile-djr-bootstrap.example.sql',
  ]) {
    const text = read(relativePath)
    assert.equal(/sb_secret_[A-Za-z0-9_-]+|GOCSPX-[A-Za-z0-9_-]+|\bservice_role\b\s*[:=]\s*['"][^'"]+/i.test(text), false)
  }
}

console.log('Studio Profile tests passed')
