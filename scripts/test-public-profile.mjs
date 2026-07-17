#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fetchPublicParticipantProfile } from '../djr/js/public-participant-profile.js'
import { socialProfileUrl } from '../djr/js/public-profile-social.js'

global.window ||= { addEventListener() {} }
assert.equal(socialProfileUrl('instagram', 'djr.photo'), 'https://www.instagram.com/djr.photo')
assert.equal(socialProfileUrl('youtube', '@djr-photo'), 'https://www.youtube.com/@djr-photo')
assert.equal(socialProfileUrl('threads', 'djr'), null)
assert.equal(socialProfileUrl('instagram', 'https://evil.example'), null)
assert.equal(socialProfileUrl('linkedin', 'person/name'), null)

const visible = { locationText: 'Maine', contact: { email: 'public@example.invalid' }, socialProfiles: [] }
assert.deepEqual(await fetchPublicParticipantProfile({
  rpc: async (name, params) => {
    assert.equal(name, 'get_public_participant_profile')
    assert.equal(params.target_registry_id, 'participant-djr')
    return { data: visible, error: null }
  },
}), visible)
assert.equal(await fetchPublicParticipantProfile({ rpc: async () => { throw new Error('offline') } }), null)
assert.equal(await fetchPublicParticipantProfile({ rpc: async () => ({ data: null, error: null }) }), null)

const root = path.join(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(root, 'djr/js/public-participant-profile.js'), 'utf8')
assert.match(source, /noopener noreferrer/)
assert.equal(/participant_profile_revisions|review_notes|consent/.test(source), false)
assert.equal(fs.existsSync(path.join(root, 'cody')), false)
console.log('Public Profile tests passed')
