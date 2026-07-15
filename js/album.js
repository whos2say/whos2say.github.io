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
import { createCropController } from './photo-album/features/album/crop.js'
import { createDragReorderController } from './photo-album/features/album/dragReorder.js'
import { downloadPhoto as downloadPhotoFile } from './photo-album/features/album/download.js'
import { createFocalPointController } from './photo-album/features/album/focalPoint.js'
import { createLightboxController } from './photo-album/features/album/lightbox.js'
import { createMusicController } from './photo-album/features/album/music.js'
import { isAlbumAdmin } from './photo-album/features/album/permissions.js'
import { createPhotoGridController } from './photo-album/features/album/photoGrid.js'
import { createSelectionController } from './photo-album/features/album/selection.js'
import { createAlbumShareController } from './photo-album/features/album/share.js'
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
const shareBtnEl = document.getElementById('share-btn')
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
const cropModalEl = document.getElementById('crop-modal')
const cropImgEl = document.getElementById('crop-img')
const cropSaveBtn = document.getElementById('crop-save-btn')
const cropCancelBtn = document.getElementById('crop-cancel-btn')
const cropStatusEl = document.getElementById('crop-status')
const cropRatiosEl = document.getElementById('crop-ratios')
const lightboxCropBtn = document.getElementById('lightbox-crop-btn')

let currentAlbumId = null
let coverPhotoId = null
let currentUser = null
let isAlbumOwner = false
let isAdmin = false
let selectedPhotos = new Set()
let allPhotos = []
setAlbumState({ selectedPhotos, allPhotos })

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
let cropController
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
  getCropState: () => cropController?.getCropState() || { isOpen: false, photoIndex: -1 },
  closeCropModal: () => cropController?.closeCropModal(),
  reopenLightboxAfterCrop: (index) => cropController?.reopenLightboxAfterCrop(index),
})

const { openLightbox, closeLightbox } = lightboxController
lightboxController.bindLightboxEvents()

cropController = createCropController({
  state: {
    getCurrentAlbumId: () => currentAlbumId,
    getCurrentUser: () => currentUser,
    getAllPhotos: () => allPhotos,
  },
  elements: {
    cropModal: cropModalEl,
    cropImg: cropImgEl,
    cropSaveBtn,
    cropCancelBtn,
    cropStatus: cropStatusEl,
    cropRatios: cropRatiosEl,
    lightboxCropBtn,
  },
  getPublicUrl,
  uploadFile,
  removeFiles,
  createPhoto,
  openLightbox,
  closeLightbox,
  getLightboxCurrentIndex: () => lightboxController.getCurrentIndex(),
  showToast,
  reloadAlbum: loadAlbum,
})

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

const shareController = createAlbumShareController({
  getCurrentAlbumId: () => currentAlbumId,
  getAlbumName: () => albumNameEl.textContent,
  getPhotos: () => allPhotos,
  getPublicUrl,
  initSharePanel,
  elements: {
    shareBtn: shareBtnEl,
  },
})

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

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text == null ? '' : String(text)
  return div.innerHTML
}

async function copyToClipboard(value, button) {
  try {
    await navigator.clipboard.writeText(value)
    if (button) {
      const original = button.textContent
      button.textContent = 'Copied'
      button.classList.add('is-copied')
      setTimeout(() => {
        button.textContent = original
        button.classList.remove('is-copied')
      }, 1400)
    }
    showToast('Copied')
  } catch {
    window.prompt('Copy this value:', value)
  }
}

function renderAlbumMediaHubInfo(albumId) {
  const hero = document.querySelector('.album-hero-inner')
  if (!hero || !albumId) return

  let panel = document.getElementById('album-media-hub-info')
  if (!panel) {
    panel = document.createElement('div')
    panel.id = 'album-media-hub-info'
    panel.className = 'media-hub-panel'
    hero.insertAdjacentElement('afterend', panel)
  }

  panel.innerHTML = `
    <p class="media-hub-helper">Use Album UUID and Photo IDs in Participant Pages.</p>
    <div class="media-hub-copy-row">
      <span class="media-hub-copy-label">Album UUID</span>
      <code>${escapeHtml(albumId)}</code>
      <button class="media-hub-copy-btn" type="button">Copy</button>
    </div>
  `
  panel.querySelector('.media-hub-copy-btn')?.addEventListener('click', event => {
    event.preventDefault()
    copyToClipboard(albumId, event.currentTarget)
  })
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

  renderAlbumMediaHubInfo(currentAlbumId)
  
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

      shareController.configureAlbumShare(albumData)
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
    shareController.updateCoverUrl(photos)

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
  cropController.bindEvents()

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
