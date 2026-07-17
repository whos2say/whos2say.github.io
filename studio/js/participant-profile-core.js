const PARTICIPANT_ID_RE = /^participant-[a-z0-9]+(?:-[a-z0-9]+)*$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+(). -]{0,30}$/
const HANDLE_RULES = Object.freeze({
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  youtube: /^@?[A-Za-z0-9._-]{1,100}$/,
  facebook: /^[A-Za-z0-9._-]{1,100}$/,
  tiktok: /^[A-Za-z0-9._]{1,30}$/,
  linkedin: /^[A-Za-z0-9._-]{1,100}$/,
  x: /^[A-Za-z0-9._]{1,30}$/,
})
const CONTACT_METHODS = new Set(['contact-form', 'email', 'phone', 'social'])
const UNSAFE_TEXT_RE = /<[^>]*>|javascript:|data:text\/html|https?:\/\/|www\./i

export const SOCIAL_PLATFORMS = Object.freeze(Object.keys(HANDLE_RULES))

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function boolean(value) {
  return value === true
}

export function emptyParticipantProfile() {
  return {
    publicIdentity: { displayName: '', professionalName: '', pronouns: '', locationText: '' },
    contactProfile: {
      enabled: false,
      publicEmail: '',
      publicPhoneDisplay: '',
      preferredContactMethod: 'contact-form',
      availabilityText: '',
      responseTimeText: '',
    },
    socialProfiles: [],
    visibility: { showLocation: false, showEmail: false, showPhone: false, showSocialProfiles: false },
    consent: { participantApproved: false, approvedAt: null, approvedByUserId: null, reviewRequired: true },
  }
}

export function normalizeParticipantProfile(value = {}) {
  const empty = emptyParticipantProfile()
  const identity = value.publicIdentity || value.public_identity || {}
  const contact = value.contactProfile || value.contact_profile || {}
  const visibility = value.visibility || {}
  const social = value.socialProfiles || value.social_profiles || []
  return {
    publicIdentity: {
      displayName: text(identity.displayName, 100),
      professionalName: text(identity.professionalName, 100),
      pronouns: text(identity.pronouns, 50),
      locationText: text(identity.locationText, 120),
    },
    contactProfile: {
      enabled: boolean(contact.enabled),
      publicEmail: text(contact.publicEmail, 254),
      publicPhoneDisplay: text(contact.publicPhoneDisplay, 30),
      preferredContactMethod: CONTACT_METHODS.has(contact.preferredContactMethod)
        ? contact.preferredContactMethod
        : empty.contactProfile.preferredContactMethod,
      availabilityText: text(contact.availabilityText, 240),
      responseTimeText: text(contact.responseTimeText, 160),
    },
    socialProfiles: Array.isArray(social) ? social.slice(0, 12).map((item) => ({
      platform: SOCIAL_PLATFORMS.includes(item?.platform) ? item.platform : '',
      handle: text(item?.handle, 100).replace(/^@(?!(?:[A-Za-z0-9._-]+)$)/, ''),
      enabled: boolean(item?.enabled),
    })) : [],
    visibility: {
      showLocation: boolean(visibility.showLocation),
      showEmail: boolean(visibility.showEmail),
      showPhone: boolean(visibility.showPhone),
      showSocialProfiles: boolean(visibility.showSocialProfiles),
    },
    consent: { ...empty.consent },
  }
}

export function validateParticipantProfile(profile) {
  const value = normalizeParticipantProfile(profile)
  const errors = []
  const textFields = [
    ['Display name', value.publicIdentity.displayName],
    ['Professional name', value.publicIdentity.professionalName],
    ['Pronouns', value.publicIdentity.pronouns],
    ['Location', value.publicIdentity.locationText],
    ['Availability', value.contactProfile.availabilityText],
    ['Response time', value.contactProfile.responseTimeText],
  ]
  for (const [label, field] of textFields) {
    if (UNSAFE_TEXT_RE.test(field)) errors.push(`${label} cannot contain HTML, URLs, or scripts.`)
  }
  if (value.contactProfile.publicEmail && !EMAIL_RE.test(value.contactProfile.publicEmail)) {
    errors.push('Enter a valid public email address.')
  }
  if (!PHONE_RE.test(value.contactProfile.publicPhoneDisplay)) {
    errors.push('Phone display may contain only numbers, spaces, +, parentheses, periods, and hyphens.')
  }
  const seenPlatforms = new Set()
  for (const social of value.socialProfiles) {
    if (!social.platform || !HANDLE_RULES[social.platform]?.test(social.handle)) {
      errors.push('Each social profile needs an approved platform and valid handle, not a full URL.')
      continue
    }
    if (seenPlatforms.has(social.platform)) errors.push(`Only one ${social.platform} profile is allowed.`)
    seenPlatforms.add(social.platform)
  }
  return { value, errors, valid: errors.length === 0 }
}

export function buildParticipantProfilePreview(profile) {
  const value = normalizeParticipantProfile(profile)
  const heading = value.publicIdentity.professionalName
    || value.publicIdentity.displayName
    || 'Participant'
  const visibleLines = []
  if (value.visibility.showLocation && value.publicIdentity.locationText) visibleLines.push(value.publicIdentity.locationText)
  if (value.contactProfile.enabled && value.visibility.showEmail && value.contactProfile.publicEmail) visibleLines.push(value.contactProfile.publicEmail)
  if (value.contactProfile.enabled && value.visibility.showPhone && value.contactProfile.publicPhoneDisplay) visibleLines.push(value.contactProfile.publicPhoneDisplay)
  const socials = value.visibility.showSocialProfiles
    ? value.socialProfiles.filter((item) => item.enabled).map((item) => ({
      platform: item.platform,
      handle: item.handle,
    }))
    : []
  return {
    heading,
    visibleLines,
    socials,
    footerSummary: visibleLines.length ? visibleLines.join(' · ') : 'No contact details are currently visible.',
  }
}

export function profileRevisionToDraft(revision) {
  return normalizeParticipantProfile(revision || {})
}

export function draftToRevisionUpdate(profile) {
  const validation = validateParticipantProfile(profile)
  if (!validation.valid) return validation
  return {
    ...validation,
    update: {
      public_identity: validation.value.publicIdentity,
      contact_profile: validation.value.contactProfile,
      social_profiles: validation.value.socialProfiles,
      visibility: validation.value.visibility,
      consent: validation.value.consent,
      updated_at: new Date().toISOString(),
    },
  }
}

export function safeProfileDiagnostic(error) {
  const clean = String(error?.message || 'Participant Profile request failed.')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/(?:access|refresh|provider|service_role)_?(?:token|key)["'=:\s]+[^\s&"']+/gi, '[redacted]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240)
  return { code: String(error?.code || 'profile_error').slice(0, 80), message: clean }
}

export async function loadParticipantProfileWith(client, participantRegistryId, userId) {
  if (!PARTICIPANT_ID_RE.test(participantRegistryId || '') || !userId) {
    return { status: 'unauthorized', participant: null, access: null, profile: null, revision: null, error: null }
  }
  try {
    const { data: participant, error: participantError } = await client
      .from('participants')
      .select('id, registry_id, slug, display_name, status')
      .eq('registry_id', participantRegistryId)
      .maybeSingle()
    if (participantError) throw participantError
    if (!participant) return { status: 'unauthorized', participant: null, access: null, profile: null, revision: null, error: null }
    const { data: accessRows, error: accessError } = await client
      .from('participant_user_access')
      .select('access_role, can_edit_profile, can_submit_review, starts_at, expires_at, revoked_at')
      .eq('participant_id', participant.id)
      .eq('user_id', userId)
    if (accessError) throw accessError
    const now = Date.now()
    const access = (accessRows || []).find((row) => !row.revoked_at
      && (!row.starts_at || Date.parse(row.starts_at) <= now)
      && (!row.expires_at || Date.parse(row.expires_at) > now))
    if (!access) return { status: 'unauthorized', participant: null, access: null, profile: null, revision: null, error: null }
    const canEditProfile = access.access_role === 'participant_owner'
      || (access.access_role === 'participant_admin' && access.can_edit_profile === true)
    const { data: profile, error: profileError } = await client
      .from('participant_profiles')
      .select('id, participant_id, lifecycle_status, published_revision_id')
      .eq('participant_id', participant.id)
      .maybeSingle()
    if (profileError) throw profileError
    let revision = null
    if (profile) {
      const { data: revisions, error: revisionError } = await client
        .from('participant_profile_revisions')
        .select('id, profile_id, revision_number, revision_status, public_identity, contact_profile, social_profiles, visibility, consent, created_by, created_at, updated_at, submitted_at')
        .eq('profile_id', profile.id)
        .order('revision_number', { ascending: false })
        .limit(1)
      if (revisionError) throw revisionError
      revision = revisions?.[0] || null
    }
    return {
      status: profile ? 'ok' : 'empty',
      participant,
      access: {
        role: access.access_role,
        canEditProfile,
        canSubmitReview: canEditProfile && access.can_submit_review === true,
      },
      profile,
      revision,
      error: null,
    }
  } catch (error) {
    return { status: 'error', participant: null, access: null, profile: null, revision: null, error: safeProfileDiagnostic(error) }
  }
}

export async function createParticipantProfileDraftWith(client, participantId) {
  const { data, error } = await client.rpc('create_my_participant_profile_draft', {
    target_participant_id: participantId,
  })
  return error
    ? { revision: null, error: safeProfileDiagnostic(error) }
    : { revision: data?.[0] || null, error: null }
}

export async function saveParticipantProfileDraftWith(client, revisionId, profile) {
  const payload = draftToRevisionUpdate(profile)
  if (!payload.valid) return { revision: null, errors: payload.errors, error: null }
  const { data, error } = await client
    .from('participant_profile_revisions')
    .update(payload.update)
    .eq('id', revisionId)
    .eq('revision_status', 'draft')
    .select()
    .maybeSingle()
  return error
    ? { revision: null, errors: [], error: safeProfileDiagnostic(error) }
    : { revision: data || null, errors: data ? [] : ['Only an active draft can be saved.'], error: null }
}

export async function submitParticipantProfileRevisionWith(client, revisionId) {
  const { data, error } = await client.rpc('submit_my_participant_profile_revision', {
    target_revision_id: revisionId,
  })
  return error
    ? { revision: null, error: safeProfileDiagnostic(error) }
    : { revision: data?.[0] || null, error: null }
}
