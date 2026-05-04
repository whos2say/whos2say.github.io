import { supabase } from '../../supabase.js'
import { PHOTO_ALBUM_CONFIG } from '../config.js'

export function getPublicUrl(filePath, bucket = PHOTO_ALBUM_CONFIG.photoBucket) {
  return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
}

export function uploadFile(filePath, body, options = {}, bucket = PHOTO_ALBUM_CONFIG.photoBucket) {
  return supabase.storage.from(bucket).upload(filePath, body, options)
}

export function removeFiles(filePaths, bucket = PHOTO_ALBUM_CONFIG.photoBucket) {
  return supabase.storage.from(bucket).remove(filePaths)
}
