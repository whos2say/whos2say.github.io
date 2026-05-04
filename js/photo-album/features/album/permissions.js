import { PHOTO_ALBUM_CONFIG } from '../../config.js'

// Client-side permission checks are UX only. Supabase RLS remains the source of
// truth for all reads and writes.
export function isAlbumAdmin(user) {
  return user?.email === PHOTO_ALBUM_CONFIG.adminEmail
}

export function hasSignedInAlbumAccess(user) {
  return !!user
}

export function canManageAlbum({ isAlbumOwner = false, isAdmin = false } = {}) {
  return !!(isAlbumOwner || isAdmin)
}

export function canDeleteComment(user, comment) {
  return !!user && (isAlbumAdmin(user) || user.id === comment.user_id)
}
