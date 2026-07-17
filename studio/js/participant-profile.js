import { supabase } from '../../js/supabase.js'
import {
  createParticipantProfileDraftWith,
  loadParticipantProfileWith,
  saveParticipantProfileDraftWith,
  submitParticipantProfileRevisionWith,
} from './participant-profile-core.js'

export const loadParticipantProfile = (participantId, userId) =>
  loadParticipantProfileWith(supabase, participantId, userId)
export const createParticipantProfileDraft = (participantId) =>
  createParticipantProfileDraftWith(supabase, participantId)
export const saveParticipantProfileDraft = (revisionId, profile) =>
  saveParticipantProfileDraftWith(supabase, revisionId, profile)
export const submitParticipantProfileRevision = (revisionId) =>
  submitParticipantProfileRevisionWith(supabase, revisionId)
