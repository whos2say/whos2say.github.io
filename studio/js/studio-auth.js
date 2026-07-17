import { supabase } from '../../js/supabase.js'
import { loadMyParticipants } from './participant-dashboard.js'

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
let dashboardUserId = ''

function showMessage(value) {
  if (!message) return
  message.textContent = value || ''
  message.hidden = !value
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
  card.append(heading, status, details)
  if (links.childElementCount) card.append(links)
  return card
}

async function renderDashboard(user) {
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
  const result = await loadMyParticipants(user)
  if (dashboardUserId !== requestedUserId) return
  participantsLoading.hidden = true
  if (accessSource) {
    accessSource.hidden = false
    accessSource.textContent = result.source === 'supabase'
      ? 'Access source: Supabase participant assignments protected by RLS.'
      : 'Registry preview — real access enforcement requires Supabase RLS.'
  }
  result.participants.forEach((participant) => participantCards.append(renderParticipantCard(participant)))
  participantsEmpty.hidden = result.participants.length > 0
}

function renderSession(session) {
  const user = session?.user || null
  if (loading) loading.hidden = true
  if (signedOut) signedOut.hidden = Boolean(user)
  if (signedIn) signedIn.hidden = !user
  if (email) email.textContent = user?.email || 'authenticated user'
  renderDashboard(user).catch(() => {
    if (participantsLoading) participantsLoading.hidden = true
    if (participantsEmpty) participantsEmpty.hidden = false
    showMessage('Participant assignments could not be loaded.')
  })
}

async function signInWithGoogle() {
  showMessage('')
  if (googleButton) googleButton.disabled = true
  try {
    const redirectTo = new URL('/studio/auth/callback/', window.location.origin).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile',
      },
    })
    if (error) throw error
  } catch (error) {
    showMessage(error?.message || 'Google sign-in could not be started.')
    if (googleButton) googleButton.disabled = false
  }
}

async function signOut() {
  showMessage('')
  if (signOutButton) signOutButton.disabled = true
  const { error } = await supabase.auth.signOut()
  if (signOutButton) signOutButton.disabled = false
  if (error) showMessage(error.message || 'Sign out failed.')
}

async function initialize() {
  const { data, error } = await supabase.auth.getSession()
  if (error) showMessage(error.message || 'Sign-in status is unavailable.')
  renderSession(data?.session || null)
}

if (googleButton) googleButton.addEventListener('click', signInWithGoogle)
if (signOutButton) signOutButton.addEventListener('click', signOut)

supabase.auth.onAuthStateChange((_event, session) => {
  renderSession(session)
})

initialize().catch((error) => {
  renderSession(null)
  showMessage(error?.message || 'Sign-in status is unavailable.')
})
