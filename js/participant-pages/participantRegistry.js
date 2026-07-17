export const PARTICIPANT_REGISTRY_SCHEMA_VERSION = 1

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PARTICIPANT_ID_RE = /^participant-[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATUSES = new Set(['draft', 'active', 'inactive', 'archived'])
const REVIEW_POLICIES = new Set(['none', 'staff-review', 'superadmin-review', 'superadmin'])

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function plainText(value, maxLength = 160) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().slice(0, maxLength)
  return /<[a-z!/][\s\S]*>/i.test(normalized) ? '' : normalized
}

function slug(value, allowBlank = false) {
  if (allowBlank && value === '') return ''
  return typeof value === 'string' && SLUG_RE.test(value) ? value : ''
}

function userIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string' && UUID_RE.test(item)))].slice(0, 50)
}

function albumIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string' && UUID_RE.test(item)))].slice(0, 200)
}

function reviewPolicy(value, fallback) {
  return typeof value === 'string' && REVIEW_POLICIES.has(value) ? value : fallback
}

export function normalizeParticipantRegistry(value) {
  const source = object(value)
  const resources = object(source.resources)
  const access = object(source.access)
  const review = object(source.reviewRequirements)

  return {
    schemaVersion: source.schemaVersion === PARTICIPANT_REGISTRY_SCHEMA_VERSION ? PARTICIPANT_REGISTRY_SCHEMA_VERSION : null,
    participantId: typeof source.participantId === 'string' && PARTICIPANT_ID_RE.test(source.participantId) ? source.participantId : '',
    slug: slug(source.slug),
    displayName: plainText(source.displayName),
    status: typeof source.status === 'string' && STATUSES.has(source.status) ? source.status : 'draft',
    resources: {
      pageSlug: slug(resources.pageSlug, true),
      brandKitSlug: slug(resources.brandKitSlug, true),
      albumIds: albumIds(resources.albumIds),
    },
    access: {
      ownerUserIds: userIds(access.ownerUserIds),
      staffAdminUserIds: userIds(access.staffAdminUserIds),
      contributorUserIds: userIds(access.contributorUserIds),
    },
    reviewRequirements: {
      pageCopy: reviewPolicy(review.pageCopy, 'staff-review'),
      brandKit: reviewPolicy(review.brandKit, 'staff-review'),
      mediaSelection: reviewPolicy(review.mediaSelection, 'staff-review'),
      serviceClaims: reviewPolicy(review.serviceClaims, 'superadmin-review'),
      publish: reviewPolicy(review.publish, 'superadmin-review'),
    },
  }
}

export async function loadParticipantRegistry(slugValue, options = {}) {
  if (typeof slugValue !== 'string' || !SLUG_RE.test(slugValue)) return normalizeParticipantRegistry({})
  const fetcher = options.fetcher || globalThis.fetch
  if (typeof fetcher !== 'function') return normalizeParticipantRegistry({})
  try {
    const response = await fetcher(`/content/participants/${slugValue}.json`, { cache: 'no-cache' })
    if (!response || !response.ok) return normalizeParticipantRegistry({})
    return normalizeParticipantRegistry(await response.json())
  } catch (error) {
    return normalizeParticipantRegistry({})
  }
}
