import { buildParticipantProfilePreview, safeProfileDiagnostic } from './participant-profile-core.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const validReviewRequestId = (value) => UUID_RE.test(value || '')

export async function isStaffReviewerWith(client) {
  const { data, error } = await client.rpc('is_studio_staff_reviewer')
  return { authorized: error ? false : data === true, error: error ? safeProfileDiagnostic(error) : null }
}

export async function listProfileReviewsWith(client) {
  const { data, error } = await client.rpc('list_submitted_participant_profile_reviews')
  return error ? { reviews: [], error: safeProfileDiagnostic(error) } : { reviews: data || [], error: null }
}

export async function getProfileReviewWith(client, reviewRequestId) {
  if (!validReviewRequestId(reviewRequestId)) return { review: null, error: { message: 'Invalid review request.' } }
  const { data, error } = await client.rpc('get_participant_profile_review', {
    target_review_request_id: reviewRequestId,
  })
  return error ? { review: null, error: safeProfileDiagnostic(error) } : { review: data, error: null }
}

export async function requestChangesWith(client, reviewRequestId, notes) {
  const clean = String(notes || '').trim()
  if (!clean || clean.length > 2000 || /<[^>]*>|javascript:|data:text\/html/i.test(clean)) {
    return { result: null, error: { message: 'Enter plain-text review notes (1–2000 characters).' } }
  }
  const { data, error } = await client.rpc('request_participant_profile_changes', {
    target_review_request_id: reviewRequestId, review_notes: clean,
  })
  return error ? { result: null, error: safeProfileDiagnostic(error) } : { result: data, error: null }
}

export async function approveProfileWith(client, reviewRequestId, notes = '') {
  const clean = String(notes || '').trim()
  if (clean.length > 2000 || /<[^>]*>|javascript:|data:text\/html/i.test(clean)) {
    return { result: null, error: { message: 'Approval notes must be plain text and at most 2000 characters.' } }
  }
  const { data, error } = await client.rpc('approve_participant_profile_revision', {
    target_review_request_id: reviewRequestId, review_notes: clean || null,
  })
  return error ? { result: null, error: safeProfileDiagnostic(error) } : { result: data, error: null }
}

export function reviewPublicPreview(review) {
  return buildParticipantProfilePreview(review?.revision || {})
}
