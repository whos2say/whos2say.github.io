import { supabase } from '../../supabase.js'

export function getAlbumMusicUrl(albumId) {
  return supabase.from('albums').select('music_url').eq('id', albumId).single()
}

export function setAlbumMusicUrl(albumId, musicUrl) {
  return supabase
    .from('albums')
    .update({ music_url: musicUrl ?? null })
    .eq('id', albumId)
    .select('music_url')
}

export function clearAlbumMusicUrl(albumId) {
  return supabase
    .from('albums')
    .update({ music_url: null })
    .eq('id', albumId)
    .select('music_url')
}

export function getMusicTracks() {
  return supabase.from('music_tracks').select('*').order('created_at', { ascending: false })
}

export function getMusicPublicUrl(filePath) {
  return supabase.storage.from('music').getPublicUrl(filePath).data.publicUrl
}

export function uploadMusicFile(filePath, file, options) {
  return supabase.storage.from('music').upload(filePath, file, options)
}

export function createMusicTrack(values) {
  return supabase.from('music_tracks').insert(values)
}

export function deleteMusicFile(filePath) {
  return supabase.storage.from('music').remove([filePath])
}

export function deleteMusicTrack(trackId) {
  return supabase.from('music_tracks').delete().eq('id', trackId)
}
