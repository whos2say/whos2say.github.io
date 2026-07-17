#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  approveProfileWith, getProfileReviewWith, isStaffReviewerWith,
  listProfileReviewsWith, requestChangesWith,
} from '../studio/js/participant-profile-review-core.js'

const root = path.join(import.meta.dirname, '..')
const calls = []
const client = (responses = {}) => ({
  rpc: async (name, params) => {
    calls.push({ name, params })
    return responses[name] || { data: null, error: null }
  },
})

assert.equal((await isStaffReviewerWith(client({ is_studio_staff_reviewer: { data: false, error: null } }))).authorized, false)
assert.equal((await isStaffReviewerWith(client({ is_studio_staff_reviewer: { data: true, error: null } }))).authorized, true)
assert.deepEqual((await listProfileReviewsWith(client({
  list_submitted_participant_profile_reviews: { data: [{ request_status: 'pending' }], error: null },
}))).reviews, [{ request_status: 'pending' }])
assert.equal((await getProfileReviewWith(client(), 'not-a-uuid')).review, null)
assert.match((await requestChangesWith(client(), crypto.randomUUID(), '')).error.message, /plain-text/)
assert.match((await requestChangesWith(client(), crypto.randomUUID(), '<b>no</b>')).error.message, /plain-text/)
await requestChangesWith(client(), crypto.randomUUID(), 'Please clarify the public phone choice.')
assert.equal(calls.at(-1).name, 'request_participant_profile_changes')
await approveProfileWith(client(), crypto.randomUUID(), '')
assert.equal(calls.at(-1).name, 'approve_participant_profile_revision')

const sql = fs.readFileSync(path.join(root, 'supabase/studio-participant-profile-review-schema.sql'), 'utf8')
for (const contract of [
  /is_studio_staff_reviewer\(\)/, /revision_record\.created_by = auth\.uid\(\)/,
  /participantApproved/, /published_revision_id = revision_record\.id/,
  /revisions\.revision_status = 'approved'/, /grant execute on function public\.get_public_participant_profile\(text\) to anon/,
  /drop function if exists public\.get_public_participant_profile\(text\)/,
  /revision_status <> 'approved'/,
]) assert.match(sql, contract)
assert.equal(/grant\s+select.+to anon/is.test(sql), false)
assert.equal(fs.existsSync(path.join(root, 'cody')), false)
console.log('Studio Review tests passed')
