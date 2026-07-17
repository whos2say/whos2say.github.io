import { socialProfileUrl } from './public-profile-social.js'

export async function fetchPublicParticipantProfile(client) {
  try {
    const { data, error } = await client.rpc('get_public_participant_profile', {
      target_registry_id: 'participant-djr',
    })
    return error || !data || typeof data !== 'object' ? null : data
  } catch {
    return null
  }
}

function addLine(root, value, href) {
  if (!value) return
  const p = document.createElement('p')
  if (href) {
    const a = document.createElement('a')
    a.href = href
    a.textContent = value
    p.append(a)
  } else p.textContent = value
  root.append(p)
}

export function renderPublicParticipantProfile(profile, documentRoot = document) {
  if (!profile || typeof profile !== 'object') return false
  const aside = documentRoot.querySelector('.djr-contact-aside')
  if (aside && ((profile.contact && Object.keys(profile.contact).length) || profile.locationText)) {
    const card = documentRoot.createElement('div')
    card.className = 'djr-info-card'
    const heading = documentRoot.createElement('h3')
    heading.textContent = 'Contact'
    card.append(heading)
    const contact = profile.contact || {}
    addLine(card, contact.phone, contact.phone ? `tel:${contact.phone.replace(/[^0-9+]/g, '')}` : '')
    addLine(card, contact.email, contact.email ? `mailto:${contact.email}` : '')
    addLine(card, profile.locationText)
    if (card.childElementCount > 1) aside.replaceChildren(card)
    if (contact.availabilityText) addLine(aside, contact.availabilityText)
    if (contact.responseTimeText) addLine(aside, contact.responseTimeText)
  }
  const footer = documentRoot.querySelector('.djr-footer')
  const socials = Array.isArray(profile.socialProfiles) ? profile.socialProfiles : []
  if (footer && socials.length) {
    const nav = documentRoot.createElement('nav')
    nav.className = 'djr-public-profile-socials'
    nav.setAttribute('aria-label', 'DJR social profiles')
    socials.forEach(({ platform, handle }) => {
      const url = socialProfileUrl(platform, handle)
      if (!url) return
      const link = documentRoot.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = platform
      nav.append(link)
    })
    if (nav.childElementCount) footer.append(nav)
  }
  return true
}

export async function initializePublicParticipantProfile() {
  const { supabase } = await import('../../js/supabase.js')
  const profile = await fetchPublicParticipantProfile(supabase)
  if (profile) renderPublicParticipantProfile(profile)
}

if (typeof window !== 'undefined') window.addEventListener('load', () => initializePublicParticipantProfile())
