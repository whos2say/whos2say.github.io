import { getAlbumForDetailPage } from '../../services/albumService.js'
import { getOrderedAlbumPhotos } from '../../services/photoService.js'

export async function loadAlbumData(albumId) {
  const { data: album, error: albumError } = await getAlbumForDetailPage(albumId)
  if (albumError) throw albumError

  const { data: photos, error: photosError } = await getOrderedAlbumPhotos(albumId)
  if (photosError) throw photosError

  return {
    album,
    photos: photos || [],
    coverPhotoId: album?.cover_photo_id || null,
  }
}
