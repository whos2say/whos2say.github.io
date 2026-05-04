import { getAlbums } from '../../services/albumService.js'
import { deletePhotoRecord, updatePhoto } from '../../services/photoService.js'
import { getPublicUrl, removeFiles } from '../../services/storageService.js'

export function createBulkActionsController({
  state,
  elements,
  updateSelectionUI,
  loadAlbum,
  showToast,
  downloadPhoto,
} = {}) {
  async function deletePhoto(photoId, filePath) {
    const { error: storageError } = await removeFiles([filePath])
    if (storageError) throw new Error(`Storage delete failed: ${storageError.message}`)

    const { data, error: dbError } = await deletePhotoRecord(photoId)
    if (dbError) throw new Error(`DB delete failed: ${dbError.message}`)
    if (!data || data.length === 0) throw new Error('Delete blocked — add a DELETE policy for the photos table in Supabase (Authentication → Policies)')
  }

  async function deleteSelectedPhotos() {
    if (state.selectedPhotos.size === 0 || !state.isAlbumOwner) return

    const confirmed = window.confirm(`Delete ${state.selectedPhotos.size} photo(s)? This cannot be undone.`)
    if (!confirmed) return

    try {
      for (const photoId of state.selectedPhotos) {
        const photo = state.allPhotos.find(p => p.id === photoId)
        if (!photo) continue
        await deletePhoto(photoId, photo.file_path)
      }

      state.selectedPhotos.clear()
      updateSelectionUI()
      loadAlbum()
    } catch (err) {
      console.error('Delete error:', err)
      showToast(err.message, true)
    }
  }

  async function showMoveModal() {
    if (state.selectedPhotos.size === 0 || !state.isAlbumOwner) return

    try {
      const { data: albums, error } = await getAlbums('id, name')
        .neq('id', state.currentAlbumId)
        .order('name')

      if (error) throw error

      elements.albumList.innerHTML = ''
      if (!albums || albums.length === 0) {
        elements.albumList.innerHTML = '<p style="color: var(--text-muted);">No other albums available</p>'
      } else {
        albums.forEach(album => {
          const option = document.createElement('div')
          option.className = 'album-option'
          option.textContent = album.name
          option.addEventListener('click', () => movePhotos(album.id, album.name))
          elements.albumList.appendChild(option)
        })
      }

      elements.moveModal.classList.add('show')
    } catch (err) {
      console.error('Error loading albums:', err)
      alert('Failed to load albums')
    }
  }

  async function movePhotos(targetAlbumId, targetAlbumName) {
    const count = state.selectedPhotos.size
    try {
      for (const photoId of state.selectedPhotos) {
        const { error } = await updatePhoto(photoId, { album_id: targetAlbumId })
        if (error) throw error
      }

      elements.moveModal.classList.remove('show')
      state.selectedPhotos.clear()
      updateSelectionUI()
      showToast(`Moved ${count} photo${count !== 1 ? 's' : ''} to "${targetAlbumName}"`)
      loadAlbum()
    } catch (err) {
      console.error('Move error:', err)
      showToast(`Failed to move photos: ${err.message}`, true)
    }
  }

  async function downloadSelectedPhotos() {
    if (state.selectedPhotos.size === 0) return

    const photos = [...state.selectedPhotos]
      .map(id => state.allPhotos.find(p => p.id === id))
      .filter(Boolean)

    if (photos.length === 1) {
      const photo = photos[0]
      const url = getPublicUrl(photo.file_path)
      await downloadPhoto(url, photo.file_path.split('/').pop())
      return
    }

    showToast(`Preparing ${photos.length} files…`)
    try {
      const zip = new JSZip() // eslint-disable-line no-undef
      for (const photo of photos) {
        const url = getPublicUrl(photo.file_path)
        const filename = photo.file_path.split('/').pop()
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch ${filename}`)
        zip.file(filename, await res.blob())
      }
      showToast('Creating zip…')
      const blob = await zip.generateAsync({ type: 'blob' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'photos.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
      showToast(`Downloaded ${photos.length} files!`)
    } catch (err) {
      showToast('Download failed: ' + err.message, true)
    }
  }

  return {
    deletePhoto,
    deleteSelectedPhotos,
    showMoveModal,
    movePhotos,
    downloadSelectedPhotos,
  }
}
