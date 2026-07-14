import { getAlbumById } from '../photo-album/services/albumService.js'
import { getOrderedAlbumPhotos } from '../photo-album/services/photoService.js'
import { getPublicUrl } from '../photo-album/services/storageService.js'
import { isVideoPath } from '../photo-album/utils/media.js'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidAlbumId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

export function normalizeAlbumId(value) {
  if (value == null || value === '') return ''
  return String(value).trim()
}

export async function loadPublicAlbumImages(albumId, options = {}) {
  const normalizedAlbumId = normalizeAlbumId(albumId)
  const fallbackAlt = options.fallbackAlt || 'Participant album photo'

  if (!normalizedAlbumId) return []
  if (!isValidAlbumId(normalizedAlbumId)) {
    console.warn('[participant album] Ignoring invalid album ID:', normalizedAlbumId)
    return []
  }

  try {
    const { data: album, error: albumError } = await getAlbumById(normalizedAlbumId, 'id, name, is_private')
    if (albumError || !album || album.is_private) return []

    const { data: photos, error: photosError } = await getOrderedAlbumPhotos(normalizedAlbumId)
    if (photosError || !Array.isArray(photos) || !photos.length) return []

    return photos
      .filter((photo) => photo?.file_path && !isVideoPath(photo.file_path))
      .map((photo, index) => ({
        src: getPublicUrl(photo.file_path),
        alt: `${fallbackAlt} ${index + 1}`,
        caption: album.name || '',
        sourceAlbumId: normalizedAlbumId,
        focalPoint: photo.focal_point || '',
      }))
  } catch (err) {
    console.warn('[participant album] Album image load skipped:', err.message)
    return []
  }
}
