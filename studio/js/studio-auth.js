import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../js/supabase.js'
import { loadMyParticipants } from './participant-dashboard.js'
import { createDashboardRenderGuard, registryPreviewAllowed } from './participant-dashboard-core.js'
import {
  GOOGLE_IDENTITY_SCOPES,
  STUDIO_CALLBACK_PATH,
  SUPABASE_GOOGLE_CALLBACK,
  beginGoogleSignIn,
  claimMyParticipantInvites,
  endStudioSession,
  sanitizeDiagnosticText,
} from './studio-auth-core.js'

const loading = document.getElementById('studio-auth-loading')
const signedOut = document.getElementById('studio-signed-out')
const signedIn = document.getElementById('studio-signed-in')
const email = document.getElementById('studio-user-email')
const message = document.getElementById('studio-auth-message')
const googleButton = document.getElementById('studio-google-sign-in')
const signOutButton = document.getElementById('studio-sign-out')
const dashboard = document.getElementById('studio-dashboard')
const accessSource = document.getElementById('studio-access-source')
const participantsLoading = document.getElementById('studio-participants-loading')
const participantCards = document.getElementById('studio-participant-cards')
const participantsEmpty = document.getElementById('studio-participants-empty')
const participantsEmptyTitle = document.getElementById('studio-participants-empty-title')
const participantsEmptyBody = document.getElementById('studio-participants-empty-body')
const debugPanel = document.getElementById('studio-debug')
const debugCopyStatus = document.getElementById('studio-debug-copy-status')
const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1'
const expectedAppCallback = new URL(STUDIO_CALLBACK_PATH, window.location.origin).href
const registryPreviewEnabled = registryPreviewAllowed(window.location)
const projectHost = new URL(SUPABASE_URL).host
const projectRef = projectHost.split('.')[0]
let dashboardUserId = ''
let inviteClaimUserId = ''
let currentUser = null
const dashboardRenderGuard = createDashboardRenderGuard()

const diagnostics = {
  origin: window.location.origin,
  appCallback: expectedAppCallback,
  providerCallback: SUPABASE_GOOGLE_CALLBACK,
  userId: '',
  userEmail: '',
  assignmentStatus: 'Not run',
  accessSource: 'None',
  error: 'None',
  registryPreview: registryPreviewEnabled ? 'Yes' : 'No',
}

function showMessage(value) {
  if (!message) return
  message.textContent = value || ''
  message.hidden = !value
}

function setDebugValue(id, value) {
  const element = document.getElementById(id)
  if (element) element.textContent = value
}

function renderDiagnostics() {
  if (!debugEnabled || !debugPanel) return
  debugPanel.hidden = false
  setDebugValue('studio-debug-origin', diagnostics.origin)
  setDebugValue('studio-debug-app-callback', diagnostics.appCallback)
  setDebugValue('studio-debug-provider-callback', diagnostics.providerCallback)
  setDebugValue('studio-debug-project', `${projectRef} (${projectHost})`)
  setDebugValue('studio-debug-callback-path', expectedAppCallback.endsWith(STUDIO_CALLBACK_PATH) ? 'Correct' : 'Mismatch')
  setDebugValue('studio-debug-session', currentUser ? 'Yes' : 'No')
  setDebugValue('studio-debug-user-id', diagnostics.userId || 'Not signed in')
  setDebugValue('studio-debug-user-email', diagnostics.userEmail || 'Not signed in')
  setDebugValue('studio-debug-assignment', diagnostics.assignmentStatus)
  setDebugValue('studio-debug-source', diagnostics.accessSource)
  setDebugValue('studio-debug-error', diagnostics.error)
  setDebugValue('studio-debug-registry-preview', diagnostics.registryPreview)
}

async function checkPublicAuthReadiness() {
  if (!debugEnabled) return
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
    })
    setDebugValue('studio-debug-reachable', response.ok ? 'Yes' : `No (HTTP ${response.status})`)
    if (response.ok) {
      const settings = await response.json()
      setDebugValue('studio-debug-provider', settings?.external?.google ? 'Enabled' : 'Disabled — configure externally')
    }
  } catch (error) {
    setDebugValue('studio-debug-reachable', 'No')
  }
}

function safeSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : ''
}

function detail(label, value) {
  const wrapper = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  term.textContent = label
  description.textContent = value || 'Not assigned'
  wrapper.append(term, description)
  return wrapper
}

function safeLink(label, href) {
  const link = document.createElement('a')
  link.className = 'studio-card-link'
  link.textContent = label
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener'
  return link
}

function renderParticipantCard(participant) {
  const card = document.createElement('article')
  card.className = 'studio-participant-card'
  const heading = document.createElement('h3')
  heading.textContent = participant.displayName || 'Participant'
  const status = document.createElement('span')
  status.className = 'studio-status-chip'
  status.textContent = participant.status || 'draft'
  const details = document.createElement('dl')
  details.append(
    detail('Participant ID', participant.participantId),
    detail('Page slug', participant.pageSlug),
    detail('Brand Kit slug', participant.brandKitSlug),
    detail('Assigned albums', String(participant.assignedAlbumCount || 0)),
  )
  const links = document.createElement('div')
  links.className = 'studio-card-links'
  const pageSlug = safeSlug(participant.pageSlug)
  const brandKitSlug = safeSlug(participant.brandKitSlug)
  if (pageSlug) {
    links.append(
      safeLink('View public page', `/${pageSlug}/`),
      safeLink('View Participant Page JSON', `/content/participant-pages/${pageSlug}.json`),
    )
  }
  if (brandKitSlug) links.append(safeLink('View Brand Kit JSON', `/content/participant-brand-kits/${brandKitSlug}.json`))
  if (participant.canEditProfile && participant.participantId) {
    const profilePath = `/studio/participants/profile/?participantId=${encodeURIComponent(participant.participantId)}`
    links.append(
      safeLink('Open Profile', profilePath),
      safeLink('Edit Profile Draft', profilePath),
    )
  }
  card.append(heading, status, details)
  if (links.childElementCount) card.append(links)
  return card
}

function renderEmptyState(source) {
  if (!participantsEmpty || !participantsEmptyTitle || !participantsEmptyBody) return
  participantsEmpty.hidden = false
  if (source === 'unavailable') {
    participantsEmptyTitle.textContent = 'Participant access could not be verified.'
    participantsEmptyBody.textContent = 'The Studio access system is unavailable. No participant access has been granted from fallback data.'
  } else {
    participantsEmptyTitle.textContent = 'No participant access is assigned'
    participantsEmptyBody.textContent = 'Your identity is confirmed, but no active participant assignment is visible.'
  }
}

async function renderDashboard(user) {
  const renderVersion = dashboardRenderGuard.begin()
  if (!dashboard || !participantCards || !participantsEmpty || !participantsLoading) return
  if (!user) {
    dashboard.hidden = true
    dashboardUserId = ''
    participantCards.replaceChildren()
    return
  }

  dashboard.hidden = false
  if (accessSource) accessSource.hidden = true
  participantsLoading.hidden = false
  participantsEmpty.hidden = true
  participantCards.replaceChildren()
  const requestedUserId = user.id
  dashboardUserId = requestedUserId

  if (inviteClaimUserId !== user.id) {
    inviteClaimUserId = user.id
    const claim = await claimMyParticipantInvites(supabase)
    if (!dashboardRenderGuard.isCurrent(renderVersion)) return
    if (claim.error) diagnostics.error = `${claim.error.code}: ${claim.error.diagnosticMessage || claim.error.message}`
  }

  const result = await loadMyParticipants(user)
  if (!dashboardRenderGuard.isCurrent(renderVersion) || dashboardUserId !== requestedUserId) return
  participantsLoading.hidden = true
  diagnostics.assignmentStatus = result.queryStatus
  diagnostics.accessSource = result.source
  diagnostics.registryPreview = result.registryPreviewEnabled ? 'Yes' : 'No'
  if (result.error) diagnostics.error = `${result.error.code}: ${result.error.message}`
  setDebugValue('studio-debug-sql', result.source === 'supabase' ? 'Assignment tables reachable; RLS-filtered query completed' : 'Unavailable or not verified')

  if (accessSource) {
    accessSource.hidden = false
    if (result.source === 'supabase') {
      accessSource.textContent = 'Access source: Supabase participant assignments protected by RLS.'
    } else if (result.source === 'registry-preview') {
      accessSource.textContent = 'Development registry preview — not enforced authorization.'
    } else {
      accessSource.textContent = 'Participant access could not be verified.'
    }
  }

  const cards = document.createDocumentFragment()
  const renderedParticipantIds = new Set()
  for (const participant of result.participants) {
    const participantId = String(participant?.participantId || '')
    if (!participantId || renderedParticipantIds.has(participantId)) continue
    renderedParticipantIds.add(participantId)
    cards.append(renderParticipantCard(participant))
  }
  if (!dashboardRenderGuard.isCurrent(renderVersion)) return
  participantCards.replaceChildren(cards)
  if (!renderedParticipantIds.size) renderEmptyState(result.source)
  renderDiagnostics()
}

function renderSession(session) {
  const user = session?.user || null
  currentUser = user
  if (loading) loading.hidden = true
  if (signedOut) signedOut.hidden = Boolean(user)
  if (signedIn) signedIn.hidden = !user
  if (email) email.textContent = user?.email || 'authenticated user'
  diagnostics.userId = user?.id || ''
  diagnostics.userEmail = user?.email || ''
  if (!user) {
    diagnostics.assignmentStatus = 'Not run'
    diagnostics.accessSource = 'None'
    diagnostics.error = 'None'
    diagnostics.registryPreview = registryPreviewEnabled ? 'Yes' : 'No'
  }
  renderDiagnostics()
  renderDashboard(user).catch((error) => {
    if (participantsLoading) participantsLoading.hidden = true
    renderEmptyState('unavailable')
    diagnostics.assignmentStatus = 'error'
    diagnostics.accessSource = 'unavailable'
    diagnostics.error = `dashboard_error: ${sanitizeDiagnosticText(error?.message || 'Unknown error')}`
    showMessage('Participant access could not be verified.')
    renderDiagnostics()
  })
}

async function signInWithGoogle() {
  showMessage('')
  if (googleButton) googleButton.disabled = true
  const result = await beginGoogleSignIn(supabase, window.location.origin)
  if (result.error) {
    showMessage(result.error.message)
    diagnostics.error = `${result.error.code}: ${result.error.diagnosticMessage}`
    if (googleButton) googleButton.disabled = false
    renderDiagnostics()
  }
}

async function signOut() {
  showMessage('')
  if (signOutButton) signOutButton.disabled = true
  const result = await endStudioSession(supabase)
  if (signOutButton) signOutButton.disabled = false
  if (result.error) showMessage(result.error.message)
}

async function copyDiagnostic(key) {
  const values = {
    'user-id': diagnostics.userId,
    'user-email': diagnostics.userEmail,
    'provider-callback': diagnostics.providerCallback,
    'app-callback': diagnostics.appCallback,
  }
  const value = values[key] || ''
  if (!value) {
    if (debugCopyStatus) debugCopyStatus.textContent = 'That value is not available yet.'
    return
  }
  await navigator.clipboard.writeText(value)
  if (debugCopyStatus) debugCopyStatus.textContent = 'Copied.'
}

async function initialize() {
  if (googleButton) googleButton.title = `Google identity scopes: ${GOOGLE_IDENTITY_SCOPES}`
  const { data, error } = await supabase.auth.getSession()
  if (error) showMessage('Sign-in status is unavailable.')
  renderSession(data?.session || null)
  await checkPublicAuthReadiness()
}

if (googleButton) googleButton.addEventListener('click', signInWithGoogle)
if (signOutButton) signOutButton.addEventListener('click', signOut)
document.querySelectorAll('[data-copy-diagnostic]').forEach((button) => {
  button.addEventListener('click', () => {
    copyDiagnostic(button.getAttribute('data-copy-diagnostic')).catch(() => {
      if (debugCopyStatus) debugCopyStatus.textContent = 'Copy failed. Select the value manually.'
    })
  })
})

supabase.auth.onAuthStateChange((_event, session) => {
  renderSession(session)
})

initialize().catch((error) => {
  renderSession(null)
  diagnostics.error = `initialization_error: ${sanitizeDiagnosticText(error?.message || 'Unknown error')}`
  showMessage('Sign-in status is unavailable.')
  renderDiagnostics()
})
