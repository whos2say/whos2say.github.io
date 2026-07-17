import { supabase } from '../../js/supabase.js'
import { approveProfile, getProfileReview, isStaffReviewer, requestProfileChanges } from './participant-profile-review.js'
import { reviewPublicPreview, validReviewRequestId } from './participant-profile-review-core.js'

const id = new URLSearchParams(location.search).get('reviewRequestId')
const show = (name, value) => { document.getElementById(name).textContent = JSON.stringify(value, null, 2) }
async function initialize() {
  const loading = document.getElementById('review-detail-loading')
  const locked = document.getElementById('review-detail-locked')
  const detail = document.getElementById('review-detail')
  const { data } = await supabase.auth.getSession()
  const auth = data?.session ? await isStaffReviewer() : { authorized: false }
  if (!auth.authorized || !validReviewRequestId(id)) { loading.hidden = true; locked.hidden = false; return }
  const result = await getProfileReview(id)
  loading.hidden = true
  if (result.error || !result.review) { locked.hidden = false; document.getElementById('review-detail-error').textContent = result.error?.message || 'Not found.'; return }
  const review = result.review
  document.getElementById('review-participant').textContent = review.participant.displayName
  document.getElementById('review-registry').textContent = review.participant.registryId
  show('review-identity', review.revision.publicIdentity); show('review-contact', review.revision.contactProfile)
  show('review-social', review.revision.socialProfiles); show('review-visibility', review.revision.visibility)
  show('review-consent', review.revision.consent)
  const preview = reviewPublicPreview(review)
  document.getElementById('review-preview').textContent = [preview.heading, ...preview.visibleLines,
    ...preview.socials.map((s) => `${s.platform}: ${s.handle}`)].join(' · ')
  document.getElementById('review-metadata').textContent = `Revision ${review.revision.revisionNumber} · ${review.revision.revisionStatus} · submitted ${review.revision.submittedAt || 'unknown'}`
  document.getElementById('review-notes').value = review.request.notes || ''
  const open = review.request.status === 'pending'
  document.getElementById('review-request-changes').disabled = !open
  document.getElementById('review-approve').disabled = !open
  detail.hidden = false
}
async function act(action) {
  const notes = document.getElementById('review-notes').value
  if (action === 'approve' && !confirm('Approve this revision and make its visible fields available to the public DJR site?')) return
  const result = action === 'approve' ? await approveProfile(id, notes) : await requestProfileChanges(id, notes)
  document.getElementById('review-message').textContent = result.error?.message || 'Review updated.'
  if (!result.error) location.reload()
}
document.getElementById('review-request-changes').addEventListener('click', () => act('changes'))
document.getElementById('review-approve').addEventListener('click', () => act('approve'))
initialize()
