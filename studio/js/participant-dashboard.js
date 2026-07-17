import { supabase } from '../../js/supabase.js'
import { loadParticipantRegistry } from '../../js/participant-pages/participantRegistry.js'

const REGISTRY_PREVIEW_SLUGS = Object.freeze(['djr', 'cody'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function activeRegistryRole(registry, userId) {
  const access = registry?.access || {}
  if (access.ownerUserIds?.includes(userId)) return 'participant_owner'
  if (access.staffAdminUserIds?.includes(userId)) return 'participant_admin'
  if (access.contributorUserIds?.includes(userId)) return 'contributor'
  return ''
}

async function registryForSlug(slug) {
  if (!SLUG_RE.test(slug || '')) return null
  const registry = await loadParticipantRegistry(slug)
  return registry.participantId ? registry : null
}

async function loadSupabaseAssignments(user) {
  const now = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('participant_user_access')
    .select('access_role, participant:participants!inner(id, registry_id, slug, display_name, status)')
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
  const participantIds = [...new Set(assignments.map((row) => row.participant.id))]
  const albumCounts = new Map()

  if (participantIds.length) {
    const { data: albums, error: albumError } = await supabase
      .from('participant_album_access')
      .select('participant_id')
      .in('participant_id', participantIds)
    if (albumError) throw albumError
    for (const album of albums || []) {
      albumCounts.set(album.participant_id, (albumCounts.get(album.participant_id) || 0) + 1)
    }
  }

  return Promise.all(assignments.map(async (row) => {
    const participant = row.participant
    const registry = await registryForSlug(participant.slug)
    return {
      displayName: participant.display_name || registry?.displayName || participant.slug,
      participantId: participant.registry_id || registry?.participantId || '',
      pageSlug: registry?.resources?.pageSlug || '',
      brandKitSlug: registry?.resources?.brandKitSlug || '',
      status: participant.status || registry?.status || 'draft',
      assignedAlbumCount: albumCounts.get(participant.id) || 0,
      accessRole: row.access_role || '',
    }
  }))
}

async function loadRegistryPreview(user) {
  const registries = await Promise.all(REGISTRY_PREVIEW_SLUGS.map(loadParticipantRegistry))
  return registries.flatMap((registry) => {
    const accessRole = activeRegistryRole(registry, user.id)
    if (!registry.participantId || !accessRole) return []
    return [{
      displayName: registry.displayName,
      participantId: registry.participantId,
      pageSlug: registry.resources.pageSlug,
      brandKitSlug: registry.resources.brandKitSlug,
      status: registry.status,
      assignedAlbumCount: registry.resources.albumIds.length,
      accessRole,
    }]
  })
}

export async function loadMyParticipants(user) {
  if (!user?.id) return { source: 'none', participants: [] }
  try {
    return { source: 'supabase', participants: await loadSupabaseAssignments(user) }
  } catch (error) {
    console.warn('[Studio] Supabase participant access unavailable; using registry preview.')
    return { source: 'registry-preview', participants: await loadRegistryPreview(user) }
  }
}
