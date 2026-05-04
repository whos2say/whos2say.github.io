import { supabase } from '../../supabase.js'

export function buildAlbumListQuery() {
  return supabase
    .from('albums')
    .select('id, name, created_at, cover_photo_id, is_private')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
}

export function createAlbum({ name, ownerId, isPrivate = false }) {
  return supabase
    .from('albums')
    .insert([{ name, owner_id: ownerId, is_private: isPrivate }])
}

export function updateAlbum(albumId, values) {
  return supabase.from('albums').update(values).eq('id', albumId)
}

export function deleteAlbumRecord(albumId) {
  return supabase.from('albums').delete().eq('id', albumId).select('id')
}

export function getAlbumById(albumId, columns = '*') {
  return supabase.from('albums').select(columns).eq('id', albumId).single()
}

export function getAlbumForDetailPage(albumId) {
  return supabase
    .from('albums')
    .select('name, cover_photo_id, music_url, title_size')
    .eq('id', albumId)
    .limit(1)
    .single()
}

export function getAlbums(columns = '*') {
  return supabase.from('albums').select(columns)
}

export function getUserIdByEmail(email) {
  return supabase.rpc('get_user_id_by_email', { lookup_email: email })
}

export function getAlbumOwnerEmails(albumIds) {
  return supabase.rpc('get_album_owner_emails', { album_ids: albumIds })
}

export function getAlbumUsers() {
  return supabase.rpc('get_album_users')
}

export function getSiteSetting(key) {
  return supabase.from('site_settings').select('value').eq('key', key).single()
}

export function saveSiteSetting(key, value) {
  return supabase.from('site_settings').upsert({ key, value })
}
