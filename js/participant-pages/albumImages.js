import { getAlbumById } from '../photo-album/services/albumService.js'
import { getOrderedAlbumPhotos } from '../photo-album/services/photoService.js'
import { getPublicUrl } from '../photo-album/services/storageService.js'
import { isVideoPath } from '../photo-album/utils/media.js'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALBUM_SCOPED_PHOTO_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]*$/i

export function isValidAlbumId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

export function normalizeAlbumId(value) {
  if (value == null || value === '') return ''
  return String(value).trim()
}

export function normalizePhotoIds(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item == null ? '' : item).trim())
    .filter((item) => UUID_RE.test(item) || ALBUM_SCOPED_PHOTO_ID_RE.test(item))
}

function normalizeImageMode(value) {
  if (value === 'singlePhoto') return 'singlePhoto'
  return value === 'manualSelection' ? 'manualSelection' : 'albumOrder'
}

function getFileName(filePath) {
  return String(filePath || '').split('/').filter(Boolean).pop() || ''
}

function normalizeImageLimit(value, fallback) {
  const limit = Number(value)
  if (Number.isFinite(limit) && limit > 0) return Math.floor(limit)
  return fallback
}

function normalizePhoto(photo, index, album, albumId, fallbackAlt) {
  return {
    photoId: photo.id || '',
    src: getPublicUrl(photo.file_path),
    alt: photo.alt || photo.alt_text || photo.altText || `${fallbackAlt} ${index + 1}`,
    caption: photo.caption || photo.title || photo.description || album.name || '',
    sourceAlbumId: albumId,
    sourceAlbumName: album.name || '',
    filePath: photo.file_path || '',
    sortOrder: photo.sort_order == null || photo.sort_order === '' ? null : Number(photo.sort_order),
    focalPoint: photo.focal_point || '',
  }
}

function orderSelectedPhotos(images, selectedPhotoIds, imageLimit) {
  if (!selectedPhotoIds.length) return images.slice(0, imageLimit)

  const byId = new Map(images.map((image) => [image.photoId, image]))
  const findSelectedImage = (selectedPhotoId) => {
    const directMatch = byId.get(selectedPhotoId)
    if (directMatch) return directMatch

    return images.find((image) => {
      const fileName = getFileName(image.filePath)
      return selectedPhotoId === image.filePath || selectedPhotoId === fileName || selectedPhotoId === `${image.sourceAlbumId}/${fileName}`
    })
  }
  const selected = selectedPhotoIds
    .map((photoId) => findSelectedImage(photoId))
    .filter(Boolean)
  const selectedIds = new Set(selected.map((image) => image.photoId))
  const fill = images.filter((image) => !selectedIds.has(image.photoId))

  return selected.concat(fill).slice(0, imageLimit)
}

export async function loadPublicAlbumImages(albumId, options = {}) {
  const normalizedAlbumId = normalizeAlbumId(albumId)
  const fallbackAlt = options.fallbackAlt || 'Participant album photo'
  const imageMode = normalizeImageMode(options.imageMode)
  const selectedPhotoIds = normalizePhotoIds(options.selectedPhotoIds)
  const imageLimit = imageMode === 'singlePhoto'
    ? 1
    : normalizeImageLimit(options.imageLimit, Number.POSITIVE_INFINITY)

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

    const images = photos
      .filter((photo) => photo?.file_path && !isVideoPath(photo.file_path))
      .map((photo, index) => normalizePhoto(photo, index, album, normalizedAlbumId, fallbackAlt))

    if (!images.length) return []
    if (imageMode === 'singlePhoto') return orderSelectedPhotos(images, selectedPhotoIds.slice(0, 1), 1)
    if (imageMode === 'manualSelection') return orderSelectedPhotos(images, selectedPhotoIds, imageLimit)
    return images.slice(0, imageLimit)
  } catch (err) {
    console.warn('[participant album] Album image load skipped:', err.message)
    return []
  }
}
