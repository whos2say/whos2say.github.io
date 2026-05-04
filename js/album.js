import { trackAlbumView, trackSlideshowStart, trackPhotoView } from './analytics.js'
import { initSharePanel } from './share-panel.js'
import { getCurrentUser } from './photo-album/services/authService.js'
import { updateAlbum } from './photo-album/services/albumService.js'
import { createPhoto } from './photo-album/services/photoService.js'
import { getPublicUrl, removeFiles, uploadFile } from './photo-album/services/storageService.js'
import { getAlbumIdFromUrl } from './photo-album/utils/dom.js'
import { loadAlbumData } from './photo-album/features/album/albumLoader.js'
import { albumState, setAlbumState } from './photo-album/features/album/albumState.js'
import { createBulkActionsController } from './photo-album/features/album/bulkActions.js'
import { createCommentsController } from './photo-album/features/album/comments.js'
import { createDragReorderController } from './photo-album/features/album/dragReorder.js'
import { downloadPhoto as downloadPhotoFile } from './photo-album/features/album/download.js'
import { createFocalPointController } from './photo-album/features/album/focalPoint.js'
import { createLightboxController } from './photo-album/features/album/lightbox.js'
import { createMusicController } from './photo-album/features/album/music.js'
import { isAlbumAdmin } from './photo-album/features/album/permissions.js'
import { createPhotoGridController } from './photo-album/features/album/photoGrid.js'
import { createSelectionController } from './photo-album/features/album/selection.js'
import { createSlideshowSelectorController } from './photo-album/features/album/slideshowSelector.js'
import { showToast } from './photo-album/features/album/toast.js'
import { createTitleControlsController } from './photo-album/features/album/titleControls.js'

// Analyze average brightness of an image (0–255).
// Resizes to 100px wide on an offscreen canvas for speed.
function analyzeImageBrightness(imgEl) {
  return new Promise((resolve) => {
    const onReady = () => {
      try {
        const canvas = document.createElement('canvas')
        const scale = 100 / Math.max(imgEl.naturalWidth, 1)
        canvas.width = Math.round(imgEl.naturalWidth * scale)
        canvas.height = Math.round(imgEl.naturalHeight * scale)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let totalBrightness = 0
        const pixelCount = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          // Perceived brightness (ITU-R BT.601)
          totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        }
        resolve(totalBrightness / pixelCount)
      } catch (e) {
        resolve(128) // CORS or other failure — treat as normal brightness
      }
    }
    if (imgEl.complete && imgEl.naturalWidth > 0) onReady()
    else imgEl.addEventListener('load', onReady, { once: true })
  })
}

const albumNameEl = document.getElementById('album-name')
const albumNameEditEl = document.getElementById('album-name-edit')
const editTitleBtnEl = document.getElementById('edit-title-btn')
const saveTitleBtnEl = document.getElementById('save-title-btn')
const cancelTitleBtnEl = document.getElementById('cancel-title-btn')
const titleEditBtnsEl = document.getElementById('title-edit-btns')
const titleSizeButtons = document.querySelectorAll('.title-size-btn')
const lightboxEl = document.getElementById('lightbox')
const lightboxImgEl = document.getElementById('lightbox-img')
const lightboxVideoEl = document.getElementById('lightbox-video')
const lightboxCloseEl = document.getElementById('lightbox-close')
const lightboxDownloadEl = document.getElementById('lightbox-download')
const lightboxEnhanceBtnEl = document.getElementById('lightbox-enhance-btn')

const photosGridEl = document.getElementById('photos-grid')
const emptyStateEl = document.getElementById('empty-state')
const uploadBtnEl = document.getElementById('upload-btn')
const slideshowBtnEl = document.getElementById('slideshow-btn')
const musicBtnEl = document.getElementById('music-btn')
const bulkActionsBar = document.querySelector('.bulk-actions-bar')
const selectionCountEl = document.getElementById('selection-count')
const bulkDeleteBtn = document.getElementById('bulk-delete-btn')
const bulkMoveBtn = document.getElementById('bulk-move-btn')
const bulkDownloadBtn = document.getElementById('bulk-download-btn')
const bulkCancelBtn = document.getElementById('bulk-cancel-btn')
const moveModal = document.getElementById('move-modal')
const albumListEl = document.getElementById('album-list')
const modalCancelBtn = document.getElementById('modal-cancel-btn')
const musicModal = document.getElementById('music-modal')
const musicUrlInput = document.getElementById('music-url-input')
const musicSaveBtn = document.getElementById('music-save-btn')
const musicClearBtn = document.getElementById('music-clear-btn')
const musicCloseBtn = document.getElementById('music-close-btn')
const musicFileInput = document.getElementById('music-file-input')
const musicUploadZone = document.getElementById('music-upload-zone')
const musicUploadProgress = document.getElementById('music-upload-progress')
const musicProgressFill = document.getElementById('music-progress-fill')
const musicProgressLabel = document.getElementById('music-progress-label')
const musicRemoveBtn = document.getElementById('music-remove-btn')
const musicTabs = document.querySelectorAll('.music-tab')
const musicLibraryList = document.getElementById('music-library-list')
const musicCurrent = document.getElementById('music-current')
const musicCurrentLabel = document.getElementById('music-current-label')
const musicBadge = document.getElementById('music-badge')
const slideshowSelectorModal = document.getElementById('ss-selector-modal')
const slideshowSelectorGrid = document.getElementById('ss-photo-grid')
const slideshowSelectorCount = document.getElementById('ss-selected-count')
const slideshowSelectorStartBtn = document.getElementById('ss-start-btn')
const slideshowSelectorHint = document.getElementById('ss-config-hint')
const slideshowSelectorSelectAllBtn = document.getElementById('ss-select-all')
const slideshowSelectorClearAllBtn = document.getElementById('ss-clear-all')
const slideshowSelectorSaveBtn = document.getElementById('ss-save-btn')
const slideshowSelectorCloseBtn = document.getElementById('ss-selector-close')
const slideshowSelectorCancelBtn = document.getElementById('ss-cancel-btn')

let currentAlbumId = null
let coverPhotoId = null
let currentUser = null
let isAlbumOwner = false
let isAdmin = false
let _sharePanelBound = false
let selectedPhotos = new Set()
let allPhotos = []
setAlbumState({ selectedPhotos, allPhotos })

// Crop state
let cropperInstance = null
let cropPhotoIndex = -1
let cropPhotoId = null
let cropPhotoFilePath = null
let cropPhotoUrl = null
const dragSelectArea = document.createElement('div')
dragSelectArea.className = 'drag-select-area'
document.body.appendChild(dragSelectArea)

function getAlbumId() {
  return getAlbumIdFromUrl()
}

async function checkAlbumOwner() {
  try {
    const user = await getCurrentUser()
    currentUser = user
    isAlbumOwner = !!user
    isAdmin = isAlbumAdmin(user)
  } catch (err) {
    currentUser = null
    isAlbumOwner = false
    isAdmin = false
  }
  setAlbumState({ currentUser, isAlbumOwner, isAdmin })
}

// --- Lightbox + comments ---
let lightboxController
const commentsController = createCommentsController({
  state: albumState,
  getCurrentPhotoId: () => lightboxController?.getCurrentPhotoId(),
  showToast,
})

lightboxController = createLightboxController({
  state: albumState,
  elements: {
    lightbox: lightboxEl,
    img: lightboxImgEl,
    video: lightboxVideoEl,
    closeBtn: lightboxCloseEl,
    downloadBtn: lightboxDownloadEl,
    enhanceBtn: lightboxEnhanceBtnEl,
    photosGrid: photosGridEl,
  },
  getPublicUrl,
  loadComments: commentsController.loadComments,
  trackPhotoView,
  downloadPhoto,
  getCropState: () => ({
    isOpen: cropModalEl && cropModalEl.classList.contains('show'),
    photoIndex: cropPhotoIndex,
  }),
  closeCropModal,
  reopenLightboxAfterCrop,
})

const { openLightbox, closeLightbox } = lightboxController
lightboxController.bindLightboxEvents()

const titleControlsController = createTitleControlsController({
  elements: {
    albumName: albumNameEl,
    albumNameEdit: albumNameEditEl,
    editTitleBtn: editTitleBtnEl,
    saveTitleBtn: saveTitleBtnEl,
    cancelTitleBtn: cancelTitleBtnEl,
    titleEditBtns: titleEditBtnsEl,
    titleSizeButtons,
  },
  getCurrentAlbumId: () => currentAlbumId,
  getIsAdmin: () => isAdmin,
  updateAlbum,
  showToast,
})

const { applyTitleSize } = titleControlsController

const slideshowSelectorController = createSlideshowSelectorController({
  getCurrentAlbumId: () => currentAlbumId,
  getAllPhotos: () => allPhotos,
  getAlbumName: () => albumNameEl.textContent,
  getPublicUrl,
  showToast,
  trackSlideshowStart,
  elements: {
    slideshowBtn: slideshowBtnEl,
    modal: slideshowSelectorModal,
    grid: slideshowSelectorGrid,
    selectedCount: slideshowSelectorCount,
    startBtn: slideshowSelectorStartBtn,
    hint: slideshowSelectorHint,
    selectAllBtn: slideshowSelectorSelectAllBtn,
    clearAllBtn: slideshowSelectorClearAllBtn,
    saveBtn: slideshowSelectorSaveBtn,
    closeBtn: slideshowSelectorCloseBtn,
    cancelBtn: slideshowSelectorCancelBtn,
  },
})

const musicController = createMusicController({
  state: {
    getCurrentAlbumId: () => currentAlbumId,
    getCurrentUser: () => currentUser,
    getIsAlbumOwner: () => isAlbumOwner,
    getIsAdmin: () => isAdmin,
  },
  elements: {
    musicBtn: musicBtnEl,
    musicModal,
    musicUrlInput,
    musicSaveBtn,
    musicClearBtn,
    musicCloseBtn,
    musicFileInput,
    musicUploadZone,
    musicUploadProgress,
    musicProgressFill,
    musicProgressLabel,
    musicRemoveBtn,
    musicTabs,
    musicLibraryList,
    musicCurrent,
    musicCurrentLabel,
    musicBadge,
  },
  showToast,
})

const selectionController = createSelectionController({
  state: albumState,
  elements: {
    photosGrid: photosGridEl,
    bulkActionsBar,
    selectionCount: selectionCountEl,
    bulkDeleteBtn,
    bulkMoveBtn,
  },
  dragSelectArea,
})
const { togglePhotoSelection, updateSelectionUI } = selectionController

const bulkActionsController = createBulkActionsController({
  state: albumState,
  elements: {
    moveModal,
    albumList: albumListEl,
  },
  updateSelectionUI,
  loadAlbum,
  showToast,
  downloadPhoto,
})
const { deletePhoto, deleteSelectedPhotos, showMoveModal, downloadSelectedPhotos } = bulkActionsController

const dragReorderController = createDragReorderController({
  photosGridEl,
  showToast,
})
const { initDragAndDrop } = dragReorderController

const focalPointController = createFocalPointController({ showToast })
const {
  openRepositionModal,
  closeRepositionModal,
  saveRepositionFocalPoint,
  handleRepositionImageClick,
} = focalPointController

const photoGridController = createPhotoGridController({
  state: albumState,
  photosGridEl,
  getPublicUrl,
  analyzeImageBrightness,
  openLightbox,
  togglePhotoSelection,
  downloadPhoto,
  setCoverPhoto,
  deletePhoto,
  loadAlbum,
  openRepositionModal,
  showToast,
})

async function setCoverPhoto(photoId) {
  if (!isAlbumOwner || !currentAlbumId) return

  try {
    const { data, error } = await updateAlbum(currentAlbumId, { cover_photo_id: photoId }).select('cover_photo_id')

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Cover update blocked — check Supabase RLS UPDATE policy for albums table')

    coverPhotoId = photoId
    setAlbumState({ coverPhotoId })
    photoGridController.updateCoverIndicators()
    showToast('✓ Cover photo set')
  } catch (err) {
    console.error('Error setting cover:', err)
    showToast(err.message, true)
  }
}

function downloadPhoto(url, filename) {
  return downloadPhotoFile(url, filename, { showToast })
}

async function loadAlbum() {
  currentAlbumId = getAlbumId()
  setAlbumState({ currentAlbumId })
  
  if (!currentAlbumId) {
    albumNameEl.textContent = 'No album specified'
    emptyStateEl.style.display = 'block'
    uploadBtnEl.style.display = 'none'
    return
  }

  // Validate UUID format before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(currentAlbumId)) {
    albumNameEl.textContent = 'Invalid album ID'
    emptyStateEl.textContent = `"${currentAlbumId}" is not a valid album ID. Album IDs should be UUID format.`
    emptyStateEl.style.display = 'block'
    uploadBtnEl.style.display = 'none'
    return
  }

  // Check if user owns this album (for cover selection UI)
  await checkAlbumOwner()

  // Show/hide owner-only controls
  if (musicBtnEl) {
    musicBtnEl.style.display = isAlbumOwner ? 'inline-block' : 'none'
  }
  // Admin bar (rename + font size) — admin only
  const adminBarEl = document.getElementById('album-admin-bar')
  if (adminBarEl) {
    adminBarEl.style.display = isAdmin ? 'flex' : 'none'
  }

  // Set upload link
  uploadBtnEl.href = `/upload.html?album=${encodeURIComponent(currentAlbumId)}`
  
  // Set slideshow link
  slideshowBtnEl.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`

  try {
    const { album: albumData, photos, coverPhotoId: loadedCoverPhotoId } = await loadAlbumData(currentAlbumId)

    if (albumData?.name) {
      albumNameEl.textContent = albumData.name
      if (albumData.title_size) {
        applyTitleSize(albumData.title_size)
      } else {
        window.fitAlbumTitle?.()
      }
      trackAlbumView(currentAlbumId, albumData.name)

      const panel = initSharePanel({
        shareUrl:     `${window.location.origin}/share/album?album=${encodeURIComponent(currentAlbumId)}`,
        title:        albumData.name,
        contentLabel: 'album',
        albumId:      currentAlbumId,
        targetType:   'album',
        targetId:     currentAlbumId,
      })
      if (!_sharePanelBound) {
        _sharePanelBound = true
        document.getElementById('share-btn')?.addEventListener('click', () => panel.open())
      }
    }

    if (loadedCoverPhotoId) {
      coverPhotoId = loadedCoverPhotoId
      setAlbumState({ coverPhotoId })
    }

    musicController.updateMusicBadge(!!albumData?.music_url, albumData?.music_url)

    if (photos.length === 0) {
      emptyStateEl.style.display = 'block'
      photosGridEl.innerHTML = ''
      return
    }

    emptyStateEl.style.display = 'none'
    photosGridEl.innerHTML = ''

    // Store all photos for bulk operations
    allPhotos = photos
    setAlbumState({ allPhotos })

    // Update share panel with cover photo URL now that photos are loaded
    if (photos.length > 0) {
      const firstUrl = getPublicUrl(photos[0].file_path)
      initSharePanel({ coverUrl: firstUrl })
    }

    // Render photos with staggered animation and cover buttons
    photoGridController.renderPhotos(photos)

    if (isAlbumOwner) initDragAndDrop()
  } catch (err) {
    console.error('Load album error:', err)
    emptyStateEl.textContent = `Error loading album: ${err.message}`
    emptyStateEl.style.display = 'block'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAlbum()

  titleControlsController.bindTitleEditEvents()
  titleControlsController.bindTitleSizeEvents()
  slideshowSelectorController.bindEvents()
  musicController.bindEvents()

  commentsController.bindCommentForm()

  // Reposition modal
  document.getElementById('reposition-cancel-btn')?.addEventListener('click', closeRepositionModal)
  document.getElementById('reposition-save-btn')?.addEventListener('click', saveRepositionFocalPoint)
  document.getElementById('reposition-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('reposition-modal')) closeRepositionModal()
  })
  document.getElementById('reposition-image-wrap')?.addEventListener('click', handleRepositionImageClick)
})

// Drag-select event listeners
if (photosGridEl) {
  selectionController.bindDragSelect()
}

// Bulk action button event listeners
if (bulkDeleteBtn) {
  bulkDeleteBtn.addEventListener('click', deleteSelectedPhotos)
}

if (bulkMoveBtn) {
  bulkMoveBtn.addEventListener('click', showMoveModal)
}

if (bulkDownloadBtn) {
  bulkDownloadBtn.addEventListener('click', downloadSelectedPhotos)
}

if (bulkCancelBtn) {
  bulkCancelBtn.addEventListener('click', () => {
    selectedPhotos.clear()
    setAlbumState({ selectedPhotos })
    updateSelectionUI()
  })
}

if (modalCancelBtn) {
  modalCancelBtn.addEventListener('click', () => {
    moveModal.classList.remove('show')
  })
}

// ── Crop feature ─────────────────────────────────────────────────
// Opens a Cropper.js modal for the current lightbox photo, crops to selected
// aspect ratio, and saves the cropped result as a NEW photo row (original kept).
// Requires CropperJS (loaded via CDN in album.html) and a signed-in user.

const cropModalEl  = document.getElementById('crop-modal')
const cropImgEl    = document.getElementById('crop-img')
const cropSaveBtn  = document.getElementById('crop-save-btn')
const cropCancelBtn = document.getElementById('crop-cancel-btn')
const cropStatusEl = document.getElementById('crop-status')
const cropRatiosEl = document.getElementById('crop-ratios')
const lightboxCropBtn = document.getElementById('lightbox-crop-btn')

function setCropStatus(msg, isError = false) {
  if (!cropStatusEl) return
  if (!msg) { cropStatusEl.style.display = 'none'; return }
  cropStatusEl.textContent = msg
  cropStatusEl.className = 'crop-status' + (isError ? ' crop-status-error' : ' crop-status-success')
  cropStatusEl.style.display = 'block'
}

function openCropModal(index) {
  if (!cropModalEl || !cropImgEl) return
  const photo = allPhotos[index]
  if (!photo) return
  cropPhotoIndex = index
  cropPhotoId = photo.id
  cropPhotoFilePath = photo.file_path
  cropPhotoUrl = getPublicUrl(photo.file_path)

  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
  setCropStatus('')
  if (cropSaveBtn) { cropSaveBtn.disabled = false; cropSaveBtn.textContent = 'Save Copy' }

  // Reset ratio buttons to Free
  if (cropRatiosEl) {
    cropRatiosEl.querySelectorAll('.crop-ratio-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === 'free')
    })
  }

  cropImgEl.src = ''
  cropModalEl.classList.add('show')
  document.body.style.overflow = 'hidden'

  // Fetch image as blob to avoid CORS canvas-tainting issues.
  // This ensures getCroppedCanvas() works regardless of storage CORS config.
  fetch(cropPhotoUrl)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch image: ' + res.status)
      return res.blob()
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      // Blob URLs are same-origin; crossorigin attribute is unnecessary and can
      // cause Cropper.js canvas operations to fail in some browsers.
      cropImgEl.removeAttribute('crossorigin')
      const initCropper = () => {
        if (typeof Cropper === 'undefined') {
          setCropStatus('Cropper library failed to load. Check your connection and reload.', true)
          return
        }
        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
        try {
          cropperInstance = new Cropper(cropImgEl, {
            viewMode: 1,
            autoCropArea: 0.85,
            responsive: true,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            toggleDragModeOnDblclick: false,
            checkCrossOrigin: false,
          })
        } catch (err) {
          console.error('Cropper init error:', err)
          setCropStatus('Failed to initialize cropper: ' + (err.message || String(err)), true)
        }
      }
      cropImgEl.addEventListener('load', initCropper, { once: true })
      cropImgEl.addEventListener('error', () => {
        setCropStatus('Could not load image for cropping.', true)
      }, { once: true })
      cropImgEl.src = blobUrl
    })
    .catch(err => {
      console.error('Crop image fetch error:', err)
      setCropStatus('Could not load image for cropping. Try again.', true)
    })
}

function closeCropModal() {
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
  if (cropModalEl) cropModalEl.classList.remove('show')
  document.body.style.overflow = ''
  if (cropImgEl) {
    // Revoke blob URL if one was created
    if (cropImgEl.src && cropImgEl.src.startsWith('blob:')) {
      URL.revokeObjectURL(cropImgEl.src)
    }
    cropImgEl.src = ''
  }
}

// Re-open the lightbox at the given index after canceling a crop
function reopenLightboxAfterCrop(index) {
  const photo = allPhotos[index]
  if (!photo) return
  const url = getPublicUrl(photo.file_path)
  openLightbox(url, photo.id, photo.file_path, index)
}

// Lightbox "Crop" button → close lightbox and open crop modal
if (lightboxCropBtn) {
  lightboxCropBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!currentUser) { showToast('Sign in to crop photos.'); return }
    const idx = lightboxController.getCurrentIndex()
    if (idx < 0) return
    closeLightbox()
    openCropModal(idx)
  })
}

if (cropCancelBtn) {
  cropCancelBtn.addEventListener('click', () => {
    const idx = cropPhotoIndex
    closeCropModal()
    if (idx >= 0) reopenLightboxAfterCrop(idx)
  })
}

if (cropModalEl) {
  cropModalEl.addEventListener('click', (e) => {
    if (e.target === cropModalEl) {
      const idx = cropPhotoIndex
      closeCropModal()
      if (idx >= 0) reopenLightboxAfterCrop(idx)
    }
  })
}

if (cropRatiosEl) {
  cropRatiosEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.crop-ratio-btn')
    if (!btn || !cropperInstance) return
    cropRatiosEl.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const parts = btn.dataset.ratio.split(':')
    const ratio = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : NaN
    cropperInstance.setAspectRatio(ratio)
  })
}

if (cropSaveBtn) {
  cropSaveBtn.addEventListener('click', async () => {
    if (!cropperInstance || !currentUser) return
    cropSaveBtn.disabled = true
    cropSaveBtn.textContent = 'Saving…'
    setCropStatus('')

    const filePath = cropPhotoFilePath || ''
    const extMatch = filePath.match(/\.([^.]+)$/)
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
    const quality = mimeType === 'image/jpeg' ? 0.92 : undefined

    const canvas = cropperInstance.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, fillColor: '#fff' })
    if (!canvas) {
      setCropStatus('Failed to get cropped image.', true)
      cropSaveBtn.disabled = false
      cropSaveBtn.textContent = 'Save Copy'
      return
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setCropStatus('Failed to create image file.', true)
        cropSaveBtn.disabled = false
        cropSaveBtn.textContent = 'Save Copy'
        return
      }

      const baseName = filePath.split('/').pop().replace(/\.[^.]+$/, '')
      const saveExt = mimeType === 'image/png' ? 'png' : 'jpg'
      const croppedPath = `${currentAlbumId}/${Date.now()}-crop-${baseName}.${saveExt}`

      const { error: uploadError } = await uploadFile(croppedPath, blob, {
        contentType: mimeType,
        upsert: false,
      })
      if (uploadError) {
        setCropStatus('Upload failed: ' + uploadError.message, true)
        cropSaveBtn.disabled = false
        cropSaveBtn.textContent = 'Save Copy'
        return
      }

      const { error: dbError } = await createPhoto({
        album_id: currentAlbumId,
        file_path: croppedPath,
        uploaded_by: currentUser.id,
      })
      if (dbError) {
        // Roll back the storage upload so we don't leave an orphan file
        await removeFiles([croppedPath])
        setCropStatus('Failed to save photo record: ' + dbError.message, true)
        cropSaveBtn.disabled = false
        cropSaveBtn.textContent = 'Save Copy'
        return
      }

      closeCropModal()
      showToast('Cropped copy saved.')
      // Refresh the album to pick up the new photo
      if (typeof loadAlbum === 'function') await loadAlbum()
    }, mimeType, quality)
  })
}
