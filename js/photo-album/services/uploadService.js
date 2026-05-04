import { createPhoto } from './photoService.js'
import { getPublicUrl, uploadFile } from './storageService.js'

export function buildUploadPath(albumId, filename) {
  return `${albumId}/${Date.now()}_${filename}`
}

export async function uploadPhotoAsset({
  albumId,
  filePath,
  body,
  contentType,
  uploadedBy,
  focalPoint,
}) {
  const { error: uploadError } = await uploadFile(filePath, body, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  })
  if (uploadError) return { error: uploadError }

  return createPhoto([{
    album_id: albumId,
    file_path: filePath,
    uploaded_by: uploadedBy,
    focal_point: focalPoint,
  }])
}

export function getUploadedAssetPublicUrl(filePath) {
  return getPublicUrl(filePath)
}
