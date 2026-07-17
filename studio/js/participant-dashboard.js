import { supabase } from '../../js/supabase.js'
import { loadParticipantRegistry } from '../../js/participant-pages/participantRegistry.js'
import { loadMyParticipantsWith } from './participant-dashboard-core.js'

export async function loadMyParticipants(user) {
  return loadMyParticipantsWith({
    client: supabase,
    registryLoader: loadParticipantRegistry,
    locationLike: window.location,
  }, user)
}
