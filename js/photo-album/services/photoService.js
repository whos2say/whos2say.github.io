import { supabase } from '../../supabase.js'

export function getAlbumPhotos(albumId, columns = '*') {
  return supabase.from('photos').select(columns).eq('album_id', albumId)
}

export function getOrderedAlbumPhotos(albumId) {
  return getAlbumPhotos(albumId, 'id, file_path, created_at, focal_point, sort_order')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
}

export function getPhotoById(photoId, columns = '*') {
  return supabase.from('photos').select(columns).eq('id', photoId).single()
}

export function createPhoto(values) {
  return supabase.from('photos').insert(values)
}

export function updatePhoto(photoId, values) {
  return supabase.from('photos').update(values).eq('id', photoId)
}

export function deletePhotoRecord(photoId) {
  return supabase.from('photos').delete().eq('id', photoId).select('id')
}

export function deletePhotosForAlbum(albumId) {
  return supabase.from('photos').delete().eq('album_id', albumId)
}

export function getCoverPhoto(photoId) {
  return getPhotoById(photoId, 'file_path, focal_point')
}

export function getLatestAlbumPhoto(albumId) {
  return getAlbumPhotos(albumId, 'file_path, focal_point')
    .order('created_at', { ascending: false })
    .limit(1)
}
