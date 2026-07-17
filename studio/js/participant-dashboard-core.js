const REGISTRY_PREVIEW_SLUGS = Object.freeze(['djr', 'cody'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function createDashboardRenderGuard() {
  let version = 0
  return {
    begin() {
      version += 1
      return version
    },
    isCurrent(requestVersion) {
      return requestVersion === version
    },
  }
}

function safeDiagnostic(error) {
  const clean = (value) => String(value || '')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/(?:access|refresh|provider)_token["'=:\s]+[^\s&"']+/gi, '[redacted-token]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240)
  return {
    code: clean(error?.code || 'access_query_error').slice(0, 80),
    message: clean(error?.message || 'Participant access query failed.'),
  }
}

export function registryPreviewAllowed(locationLike = {}) {
  const hostname = String(locationLike.hostname || '').toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  return new URLSearchParams(locationLike.search || '').get('registryPreview') === '1'
}

function activeRegistryRole(registry, userId) {
  const access = registry?.access || {}
  if (access.ownerUserIds?.includes(userId)) return 'participant_owner'
  if (access.staffAdminUserIds?.includes(userId)) return 'participant_admin'
  if (access.contributorUserIds?.includes(userId)) return 'contributor'
  return ''
}

async function registryForSlug(registryLoader, slug) {
  if (!SLUG_RE.test(slug || '')) return null
  const registry = await registryLoader(slug)
  return registry?.participantId ? registry : null
}

async function loadSupabaseAssignments(client, registryLoader, user) {
  const now = new Date().toISOString()
  const { data: rows, error } = await client
    .from('participant_user_access')
    .select('access_role, can_edit_profile, can_submit_review, participant:participants!inner(id, registry_id, slug, display_name, status)')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .lte('starts_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
  if (error) throw error

  const assignmentsByParticipant = new Map()
  for (const row of rows || []) {
    if (row?.participant?.id && SLUG_RE.test(row.participant.slug || '') && !assignmentsByParticipant.has(row.participant.id)) {
      assignmentsByParticipant.set(row.participant.id, row)
    }
  }
  const assignments = [...assignmentsByParticipant.values()]
  const participantIds = assignments.map((row) => row.participant.id)
  const albumCounts = new Map()

  if (participantIds.length) {
    const { data: albums, error: albumError } = await client
      .from('participant_album_access')
      .select('participant_id')
      .in('participant_id', participantIds)
    if (albumError) throw albumError
    for (const album of albums || []) albumCounts.set(album.participant_id, (albumCounts.get(album.participant_id) || 0) + 1)
  }

  return Promise.all(assignments.map(async (row) => {
    const participant = row.participant
    const registry = await registryForSlug(registryLoader, participant.slug)
    return {
      displayName: participant.display_name || registry?.displayName || participant.slug,
      participantId: participant.registry_id || registry?.participantId || '',
      pageSlug: registry?.resources?.pageSlug || '',
      brandKitSlug: registry?.resources?.brandKitSlug || '',
      status: participant.status || registry?.status || 'draft',
      assignedAlbumCount: albumCounts.get(participant.id) || 0,
      accessRole: row.access_role || '',
      canEditProfile: row.access_role === 'participant_owner'
        || (row.access_role === 'participant_admin' && row.can_edit_profile === true),
      canSubmitReview: row.can_submit_review === true,
    }
  }))
}

async function loadRegistryPreview(registryLoader, user) {
  const registries = await Promise.all(REGISTRY_PREVIEW_SLUGS.map(registryLoader))
  return registries.flatMap((registry) => {
    const accessRole = activeRegistryRole(registry, user.id)
    if (!registry?.participantId || !accessRole) return []
    return [{
      displayName: registry.displayName,
      participantId: registry.participantId,
      pageSlug: registry.resources.pageSlug,
      brandKitSlug: registry.resources.brandKitSlug,
      status: registry.status,
      assignedAlbumCount: registry.resources.albumIds.length,
    }]
  })
}

export async function loadMyParticipantsWith({ client, registryLoader, locationLike }, user) {
  const previewEnabled = registryPreviewAllowed(locationLike)
  if (!user?.id) return { source: 'none', queryStatus: 'signed-out', registryPreviewEnabled: previewEnabled, participants: [], error: null }
  try {
    const participants = await loadSupabaseAssignments(client, registryLoader, user)
    return { source: 'supabase', queryStatus: 'ok', registryPreviewEnabled: previewEnabled, participants, error: null }
  } catch (error) {
    if (!previewEnabled) {
      return { source: 'unavailable', queryStatus: 'error', registryPreviewEnabled: false, participants: [], error: safeDiagnostic(error) }
    }
    return {
      source: 'registry-preview',
      queryStatus: 'error-preview',
      registryPreviewEnabled: true,
      participants: await loadRegistryPreview(registryLoader, user),
      error: safeDiagnostic(error),
    }
  }
}
