import { supabase } from '../../js/supabase.js'
import { isStaffReviewer, listProfileReviews } from './participant-profile-review.js'

function card(item) {
  const article = document.createElement('article')
  article.className = 'studio-participant-card'
  const title = document.createElement('h3')
  title.textContent = item.participant_name
  const meta = document.createElement('p')
  meta.textContent = `${item.registry_id} · Revision ${item.revision_number} · ${item.request_status}`
  const by = document.createElement('p')
  by.textContent = `Submitted ${new Date(item.submitted_at).toLocaleString()} by ${item.submitted_by_name}`
  const complete = document.createElement('p')
  complete.textContent = `Identity ${item.completeness?.identity ? 'complete' : 'missing'} · ${item.completeness?.visibleFieldCount || 0} visible choices`
  const link = document.createElement('a')
  link.className = 'studio-text-link'
  link.href = `/studio/reviews/profile/?reviewRequestId=${encodeURIComponent(item.review_request_id)}`
  link.textContent = 'Review profile'
  article.append(title, meta, by, complete, link)
  return article
}

async function initialize() {
  const loading = document.getElementById('review-loading')
  const locked = document.getElementById('review-locked')
  const workspace = document.getElementById('review-workspace')
  const { data } = await supabase.auth.getSession()
  const auth = data?.session ? await isStaffReviewer() : { authorized: false }
  loading.hidden = true
  if (!auth.authorized) { locked.hidden = false; return }
  const result = await listProfileReviews()
  if (result.error) { locked.hidden = false; return }
  const targets = {
    pending: document.getElementById('review-submitted'),
    'changes-requested': document.getElementById('review-changes'),
    approved: document.getElementById('review-approved'),
  }
  result.reviews.forEach((item) => {
    targets[item.request_status]?.append(card(item))
    if (item.request_status === 'pending') document.getElementById('review-queue').append(card(item))
  })
  workspace.hidden = false
}
initialize()
