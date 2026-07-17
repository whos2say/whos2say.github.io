import { supabase } from '../../js/supabase.js'
export {
  approveProfileWith, getProfileReviewWith, isStaffReviewerWith,
  listProfileReviewsWith, requestChangesWith, reviewPublicPreview,
} from './participant-profile-review-core.js'
import {
  approveProfileWith, getProfileReviewWith, isStaffReviewerWith,
  listProfileReviewsWith, requestChangesWith,
} from './participant-profile-review-core.js'

export const isStaffReviewer = () => isStaffReviewerWith(supabase)
export const listProfileReviews = () => listProfileReviewsWith(supabase)
export const getProfileReview = (id) => getProfileReviewWith(supabase, id)
export const requestProfileChanges = (id, notes) => requestChangesWith(supabase, id, notes)
export const approveProfile = (id, notes) => approveProfileWith(supabase, id, notes)
