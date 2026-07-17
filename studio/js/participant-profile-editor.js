import { supabase } from '../../js/supabase.js'
import {
  SOCIAL_PLATFORMS,
  buildParticipantProfilePreview,
  emptyParticipantProfile,
  profileRevisionToDraft,
  validateParticipantProfile,
} from './participant-profile-core.js'
import {
  createParticipantProfileDraft,
  loadParticipantProfile,
  saveParticipantProfileDraft,
  submitParticipantProfileRevision,
} from './participant-profile.js'

const participantRegistryId = new URLSearchParams(window.location.search).get('participantId') || ''
const loading = document.getElementById('profile-loading')
const locked = document.getElementById('profile-locked')
const lockedMessage = document.getElementById('profile-locked-message')
const workspace = document.getElementById('profile-workspace')
const form = document.getElementById('profile-form')
const message = document.getElementById('profile-message')
const socialList = document.getElementById('profile-social-list')
const preview = document.getElementById('profile-preview')
let currentRevision = null
let savedDraft = emptyParticipantProfile()
let access = null

function setMessage(value, isError = false) {
  message.textContent = value || ''
  message.classList.toggle('studio-message--success', Boolean(value) && !isError)
}

function field(name) {
  return form.elements.namedItem(name)
}

function addSocialRow(social = { platform: 'instagram', handle: '', enabled: true }) {
  const row = document.createElement('div')
  row.className = 'studio-social-row'
  const platform = document.createElement('select')
  platform.setAttribute('aria-label', 'Social platform')
  for (const value of SOCIAL_PLATFORMS) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    option.selected = value === social.platform
    platform.append(option)
  }
  const handle = document.createElement('input')
  handle.setAttribute('aria-label', 'Social handle')
  handle.placeholder = 'handle only'
  handle.maxLength = 100
  handle.value = social.handle || ''
  const enabled = document.createElement('input')
  enabled.type = 'checkbox'
  enabled.checked = social.enabled === true
  enabled.setAttribute('aria-label', 'Show this social profile')
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'studio-button studio-button--secondary'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => row.remove())
  row.append(platform, handle, enabled, remove)
  socialList.append(row)
}

function readForm() {
  return {
    publicIdentity: {
      displayName: field('displayName').value,
      professionalName: field('professionalName').value,
      pronouns: field('pronouns').value,
      locationText: field('locationText').value,
    },
    contactProfile: {
      enabled: field('contactEnabled').checked,
      publicEmail: field('publicEmail').value,
      publicPhoneDisplay: field('publicPhoneDisplay').value,
      preferredContactMethod: field('preferredContactMethod').value,
      availabilityText: field('availabilityText').value,
      responseTimeText: field('responseTimeText').value,
    },
    socialProfiles: [...socialList.querySelectorAll('.studio-social-row')].map((row) => ({
      platform: row.children[0].value,
      handle: row.children[1].value,
      enabled: row.children[2].checked,
    })),
    visibility: {
      showLocation: field('showLocation').checked,
      showEmail: field('showEmail').checked,
      showPhone: field('showPhone').checked,
      showSocialProfiles: field('showSocialProfiles').checked,
    },
  }
}

function writeForm(profile) {
  const value = profile || emptyParticipantProfile()
  field('displayName').value = value.publicIdentity.displayName
  field('professionalName').value = value.publicIdentity.professionalName
  field('pronouns').value = value.publicIdentity.pronouns
  field('locationText').value = value.publicIdentity.locationText
  field('contactEnabled').checked = value.contactProfile.enabled
  field('publicEmail').value = value.contactProfile.publicEmail
  field('publicPhoneDisplay').value = value.contactProfile.publicPhoneDisplay
  field('preferredContactMethod').value = value.contactProfile.preferredContactMethod
  field('availabilityText').value = value.contactProfile.availabilityText
  field('responseTimeText').value = value.contactProfile.responseTimeText
  field('showLocation').checked = value.visibility.showLocation
  field('showEmail').checked = value.visibility.showEmail
  field('showPhone').checked = value.visibility.showPhone
  field('showSocialProfiles').checked = value.visibility.showSocialProfiles
  socialList.replaceChildren()
  value.socialProfiles.forEach(addSocialRow)
}

function statusLabel(status) {
  return ({
    draft: 'Draft',
    submitted: 'Submitted',
    'changes-requested': 'Changes requested',
    approved: 'Approved',
    withdrawn: 'Withdrawn',
  })[status] || 'Draft'
}

function setEditorState() {
  const isDraft = currentRevision?.revision_status === 'draft'
  const editable = access?.canEditProfile && isDraft
  for (const control of form.elements) control.disabled = !editable
  document.getElementById('profile-preview-button').disabled = false
  document.getElementById('profile-discard').disabled = !editable
  document.getElementById('profile-submit-review').disabled = !(editable && access.canSubmitReview)
  document.getElementById('profile-status').textContent = statusLabel(currentRevision?.revision_status)
  document.getElementById('profile-review-state').textContent = isDraft
    ? 'This private draft has not been submitted.'
    : `This revision is ${statusLabel(currentRevision?.revision_status).toLowerCase()} and cannot be silently overwritten.`
}

function renderPreview() {
  const validation = validateParticipantProfile(readForm())
  if (!validation.valid) {
    setMessage(validation.errors.join(' '), true)
    return
  }
  const model = buildParticipantProfilePreview(validation.value)
  const card = document.getElementById('profile-preview-card')
  const footer = document.getElementById('profile-preview-footer')
  card.replaceChildren()
  footer.replaceChildren()
  const heading = document.createElement('h3')
  heading.textContent = model.heading
  card.append(heading)
  model.visibleLines.forEach((line) => {
    const item = document.createElement('p')
    item.textContent = line
    card.append(item)
  })
  if (model.socials.length) {
    const socials = document.createElement('ul')
    model.socials.forEach((item) => {
      const listItem = document.createElement('li')
      listItem.textContent = `${item.platform}: ${item.handle}`
      socials.append(listItem)
    })
    card.append(socials)
  }
  const summary = document.createElement('p')
  summary.textContent = model.footerSummary
  footer.append(summary)
  preview.hidden = false
  preview.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function saveDraft(event) {
  event.preventDefault()
  setMessage('')
  if (!currentRevision?.id || currentRevision.revision_status !== 'draft') return
  const result = await saveParticipantProfileDraft(currentRevision.id, readForm())
  if (result.error || result.errors.length) {
    setMessage(result.error?.message || result.errors.join(' '), true)
    return
  }
  currentRevision = result.revision
  savedDraft = profileRevisionToDraft(result.revision)
  writeForm(savedDraft)
  setEditorState()
  setMessage('Draft saved.')
}

async function submitReview() {
  if (!access?.canSubmitReview || currentRevision?.revision_status !== 'draft') return
  const saved = await saveParticipantProfileDraft(currentRevision.id, readForm())
  if (saved.error || saved.errors.length) {
    setMessage(saved.error?.message || saved.errors.join(' '), true)
    return
  }
  const result = await submitParticipantProfileRevision(currentRevision.id)
  if (result.error) {
    setMessage(result.error.message, true)
    return
  }
  currentRevision = result.revision
  savedDraft = profileRevisionToDraft(result.revision)
  setEditorState()
  setMessage('Profile submitted for staff review.')
}

async function initialize() {
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) {
    loading.hidden = true
    locked.hidden = false
    lockedMessage.textContent = 'Sign in through Studio before opening a Participant Profile.'
    return
  }
  const result = await loadParticipantProfile(participantRegistryId, user.id)
  if (result.status === 'error' || result.status === 'unauthorized' || !result.access?.canEditProfile) {
    loading.hidden = true
    locked.hidden = false
    lockedMessage.textContent = result.status === 'error'
      ? 'Participant Profile access could not be verified.'
      : 'You do not have permission to edit this Participant Profile.'
    return
  }
  access = result.access
  let revision = result.revision
  if (!revision || revision.revision_status === 'changes-requested' || revision.revision_status === 'approved') {
    const created = await createParticipantProfileDraft(result.participant.id)
    if (created.error || !created.revision) {
      loading.hidden = true
      locked.hidden = false
      lockedMessage.textContent = 'A private Profile draft could not be created.'
      return
    }
    revision = created.revision
  }
  currentRevision = revision
  savedDraft = profileRevisionToDraft(revision)
  document.getElementById('profile-title').textContent = `${result.participant.display_name} Profile`
  document.getElementById('profile-participant-name').textContent = result.participant.display_name
  document.getElementById('profile-role').textContent = access.role.replaceAll('_', ' ')
  document.getElementById('profile-capabilities').textContent = [
    access.canEditProfile ? 'edit profile drafts' : '',
    access.canSubmitReview ? 'submit review' : '',
  ].filter(Boolean).join(', ') || 'read only'
  writeForm(savedDraft)
  setEditorState()
  loading.hidden = true
  workspace.hidden = false
}

form.addEventListener('submit', saveDraft)
document.getElementById('profile-add-social').addEventListener('click', () => addSocialRow())
document.getElementById('profile-preview-button').addEventListener('click', renderPreview)
document.getElementById('profile-submit-review').addEventListener('click', () => submitReview())
document.getElementById('profile-discard').addEventListener('click', () => {
  writeForm(savedDraft)
  setMessage('Unsaved changes discarded.')
})

initialize().catch(() => {
  loading.hidden = true
  locked.hidden = false
  lockedMessage.textContent = 'Participant Profile access could not be verified.'
})
