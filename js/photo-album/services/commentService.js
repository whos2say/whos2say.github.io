import { supabase } from '../../supabase.js'

export function getPhotoComments(photoId) {
  return supabase
    .from('photo_comments')
    .select('id, user_id, user_email, comment, created_at')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true })
}

export function createPhotoComment({ photoId, userId, userEmail, comment }) {
  return supabase.from('photo_comments').insert({
    photo_id: photoId,
    user_id: userId,
    user_email: userEmail,
    comment,
  })
}

export function deletePhotoComment(commentId) {
  return supabase.from('photo_comments').delete().eq('id', commentId)
}
