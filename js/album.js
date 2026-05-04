import { trackAlbumView, trackSlideshowStart, trackPhotoView } from './analytics.js'
import { initSharePanel } from './share-panel.js'
import { getCurrentUser } from './photo-album/services/authService.js'
import { updateAlbum } from './photo-album/services/albumService.js'
import {
  getAlbumMusicUrl,
  setAlbumMusicUrl,
  clearAlbumMusicUrl,
  getMusicTracks,
  getMusicPublicUrl,
  uploadMusicFile as uploadMusicStorage,
  createMusicTrack,
  deleteMusicFile,
  deleteMusicTrack as deleteMusicTrackRow,
} from './photo-album/services/musicService.js'
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
import { isAlbumAdmin } from './photo-album/features/album/permissions.js'
import { createPhotoGridController } from './photo-album/features/album/photoGrid.js'
import { createSelectionController } from './photo-album/features/album/selection.js'
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
let ssSelectedPhotos = new Set()
let ssSortedPhotos = []       // photos in current selector modal order
let ssLastClickedIdx = -1     // for shift-click range selection
let ssDragSrcIdx = null       // for drag-to-reorder within selector
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

function escapeHtmlMusic(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadMusicUrl() {
  try {
    const { data: albumData, error } = await getAlbumMusicUrl(currentAlbumId)

    if (error && error.code !== 'PGRST116') throw error

    const savedUrl = albumData?.music_url || ''
    if (musicUrlInput) musicUrlInput.value = savedUrl
    updateCurrentMusicStrip(savedUrl)
  } catch (err) {
    console.error('Load music URL error:', err)
  }
}

function updateCurrentMusicStrip(url) {
  const stripEl = document.getElementById('music-current')
  const labelEl = document.getElementById('music-current-label')
  if (!stripEl || !labelEl) return
  if (url) {
    let displayName = url
    // Try to show a readable name: last path segment without extension
    try {
      const seg = new URL(url).pathname.split('/').pop()
      if (seg) displayName = decodeURIComponent(seg).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    } catch (_) { /* url may not be absolute */ }
    labelEl.textContent = `♪ Now set: ${displayName}`
    stripEl.style.display = 'flex'
  } else {
    stripEl.style.display = 'none'
  }
}

async function saveMusicUrl() {
  if (!isAlbumOwner) {
    showToast('You must be the album owner to change music', true)
    return
  }

  const musicUrl = musicUrlInput ? musicUrlInput.value.trim() : ''

  try {
    const { data, error } = await setAlbumMusicUrl(currentAlbumId, musicUrl || null)

    if (error) throw error

    if (!data || data.length === 0) {
      throw new Error('Update blocked — check Supabase RLS policy for albums table (need UPDATE policy for authenticated users)')
    }

    showToast(musicUrl ? '✓ Music URL saved!' : '✓ Music removed.')
    updateMusicBadge(!!musicUrl, musicUrl)
    musicModal.classList.remove('show')
  } catch (err) {
    console.error('Save music error:', err)
    showToast(`Failed to save music: ${err.message}`, true)
  }
}

async function removeMusicFromAlbum() {
  if (!isAlbumOwner) return
  try {
    const { data, error } = await clearAlbumMusicUrl(currentAlbumId)
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Update blocked — check RLS policy')
    showToast('✓ Music removed.')
    updateMusicBadge(false, null)
    updateCurrentMusicStrip('')
    if (musicUrlInput) musicUrlInput.value = ''
  } catch (err) {
    showToast(`Failed to remove music: ${err.message}`, true)
  }
}

async function selectMusicTrack(url, title) {
  if (!isAlbumOwner) {
    showToast('You must be the album owner to change music', true)
    return
  }
  try {
    const { data, error } = await setAlbumMusicUrl(currentAlbumId, url)
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Update blocked — check RLS policy')
    showToast(`✓ Music set: ${title}`)
    updateMusicBadge(true, url)
    musicModal.classList.remove('show')
  } catch (err) {
    console.error('Select music track error:', err)
    showToast(`Failed to set music: ${err.message}`, true)
  }
}

async function loadMusicLibrary() {
  const listEl = document.getElementById('music-library-list')
  if (!listEl) return
  listEl.innerHTML = '<p class="music-library-loading">Loading library…</p>'

  try {
    const [tracksResult, albumResult] = await Promise.all([
      getMusicTracks(),
      getAlbumMusicUrl(currentAlbumId),
    ])

    if (tracksResult.error) throw tracksResult.error

    const tracks = tracksResult.data || []
    const currentUrl = albumResult.data?.music_url || ''

    if (tracks.length === 0) {
      listEl.innerHTML = '<p class="music-library-empty">No tracks yet — upload one using the ⬆ Upload tab.</p>'
      return
    }

    listEl.innerHTML = ''
    tracks.forEach(track => {
      const publicUrl = getMusicPublicUrl(track.file_path)
      const isActive = currentUrl === publicUrl
      const canDelete = currentUser?.id === track.uploaded_by || isAdmin

      const item = document.createElement('div')
      item.className = 'music-track-item' + (isActive ? ' active' : '')

      const selectBtn = document.createElement('button')
      selectBtn.className = 'music-track-select'
      selectBtn.title = isActive ? 'Currently selected' : 'Use this track'
      selectBtn.innerHTML = `<span class="music-track-icon">${isActive ? '▶' : '♪'}</span><span class="music-track-title">${escapeHtmlMusic(track.title)}</span>`
      selectBtn.addEventListener('click', () => selectMusicTrack(publicUrl, track.title))
      item.appendChild(selectBtn)

      if (canDelete) {
        const delBtn = document.createElement('button')
        delBtn.className = 'music-track-delete'
        delBtn.title = 'Delete from library'
        delBtn.textContent = '✕'
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          deleteMusicTrack(track.id, track.file_path, item)
        })
        item.appendChild(delBtn)
      }

      listEl.appendChild(item)
    })
  } catch (err) {
    console.error('Load music library error:', err)
    listEl.innerHTML = '<p class="music-library-error">Failed to load library.</p>'
  }
}

async function uploadMusicFile(file) {
  if (!currentUser) {
    showToast('You must be logged in to upload music', true)
    return
  }

  const allowedExts = /\.(mp3|m4a|wav|ogg)$/i
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/vorbis']
  if (!allowedExts.test(file.name) && !allowedTypes.includes(file.type)) {
    showToast('Only audio files are allowed (MP3, M4A, WAV, OGG)', true)
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('File too large — maximum 20 MB', true)
    return
  }

  const sanitized = file.name
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase()
  const filePath = `${currentUser.id}/${Date.now()}-${sanitized}`
  const title = file.name.replace(/\.[^.]+$/, '')

  // Show progress, hide upload zone
  if (musicUploadZone) musicUploadZone.style.display = 'none'
  if (musicUploadProgress) musicUploadProgress.style.display = 'flex'
  if (musicProgressFill) musicProgressFill.style.width = '20%'
  if (musicProgressLabel) musicProgressLabel.textContent = 'Uploading…'

  try {
    const { error: uploadError } = await uploadMusicStorage(filePath, file, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError

    if (musicProgressFill) musicProgressFill.style.width = '65%'
    if (musicProgressLabel) musicProgressLabel.textContent = 'Saving to library…'

    const { error: dbError } = await createMusicTrack({
      file_path: filePath,
      title,
      uploaded_by: currentUser.id,
    })
    if (dbError) throw dbError

    if (musicProgressFill) musicProgressFill.style.width = '100%'
    if (musicProgressLabel) musicProgressLabel.textContent = 'Done!'

    const publicUrl = getMusicPublicUrl(filePath)

    setTimeout(async () => {
      if (musicUploadProgress) musicUploadProgress.style.display = 'none'
      if (musicUploadZone) musicUploadZone.style.display = 'flex'
      if (musicProgressFill) musicProgressFill.style.width = '0%'
      if (musicFileInput) musicFileInput.value = ''
      await selectMusicTrack(publicUrl, title)
      showToast(`✓ "${title}" uploaded and set as album music!`)
    }, 700)
  } catch (err) {
    console.error('Music upload error:', err)
    showToast(`Upload failed: ${err.message}`, true)
    if (musicUploadProgress) musicUploadProgress.style.display = 'none'
    if (musicUploadZone) musicUploadZone.style.display = 'flex'
    if (musicProgressFill) musicProgressFill.style.width = '0%'
  }
}

async function deleteMusicTrack(trackId, filePath, itemEl) {
  if (!confirm('Delete this track from the library? This cannot be undone.')) return
  try {
    await deleteMusicFile(filePath)
    const { error } = await deleteMusicTrackRow(trackId)
    if (error) throw error
    itemEl.remove()
    showToast('Track deleted from library.')
  } catch (err) {
    console.error('Delete track error:', err)
    showToast(`Failed to delete: ${err.message}`, true)
  }
}

function switchMusicTab(tabName) {
  document.querySelectorAll('.music-tab').forEach(btn => {
    const active = btn.dataset.tab === tabName
    btn.classList.toggle('active', active)
    btn.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  document.querySelectorAll('.music-tab-panel').forEach(panel => {
    panel.classList.remove('active')
  })
  const activePanel = document.getElementById(`music-tab-${tabName}`)
  if (activePanel) activePanel.classList.add('active')
}

function clearMusicUrl() {
  if (musicUrlInput) musicUrlInput.value = ''
}

function closeMusicModal() {
  musicModal.classList.remove('show')
}

function updateMusicBadge(hasMusic, url) {
  const badge = document.getElementById('music-badge')
  if (badge) {
    badge.style.display = hasMusic ? 'inline-block' : 'none'
  }
  if (musicBtnEl) {
    musicBtnEl.title = hasMusic && url
      ? `Music: ${url}`
      : 'Add or edit slideshow music'
  }
}

// --- Slideshow config persistence (localStorage) ---
function getSlideshowConfigKey() { return `ss_config_${currentAlbumId}` }

function loadSlideshowConfig() {
  try {
    const raw = localStorage.getItem(getSlideshowConfigKey())
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveSlideshowConfig() {
  if (!currentAlbumId) return
  const orderedIds = ssSortedPhotos.map(p => p.id)
  const excludedIds = ssSortedPhotos.filter(p => !ssSelectedPhotos.has(p.id)).map(p => p.id)
  try {
    localStorage.setItem(getSlideshowConfigKey(), JSON.stringify({ orderedIds, excludedIds }))
    showToast(`💾 Slideshow saved — ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} photos`)
    const hint = document.getElementById('ss-config-hint')
    if (hint) hint.textContent = `✓ Saved · ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} included · Shift+click range · Drag to reorder`
  } catch (e) {
    showToast('Save failed: ' + e.message, true)
  }
}

// --- Slideshow selector ---
function openSlideshowSelector() {
  if (allPhotos.length === 0) {
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
    return
  }

  const modal = document.getElementById('ss-selector-modal')
  const grid = document.getElementById('ss-photo-grid')
  if (!modal || !grid) return

  // Load saved config, apply ordering + exclusions
  const savedConfig = loadSlideshowConfig()
  let orderedPhotos = [...allPhotos]
  if (savedConfig?.orderedIds?.length) {
    const byId = Object.fromEntries(allPhotos.map(p => [p.id, p]))
    const ordered = savedConfig.orderedIds.map(id => byId[id]).filter(Boolean)
    const savedSet = new Set(savedConfig.orderedIds)
    const extras = allPhotos.filter(p => !savedSet.has(p.id))
    orderedPhotos = [...ordered, ...extras]
  }
  ssSortedPhotos = orderedPhotos

  // Build selection set: start all-included, apply exclusions
  ssSelectedPhotos = new Set(orderedPhotos.map(p => p.id))
  if (savedConfig?.excludedIds?.length) {
    savedConfig.excludedIds.forEach(id => ssSelectedPhotos.delete(id))
  }
  ssLastClickedIdx = -1
  ssDragSrcIdx = null

  grid.innerHTML = ''
  ssSortedPhotos.forEach(photo => {
    const publicUrl = getPublicUrl(photo.file_path)
    const isSelected = ssSelectedPhotos.has(photo.id)

    const thumb = document.createElement('div')
    thumb.className = 'ss-thumb' + (isSelected ? ' selected' : ' ss-excluded')
    thumb.dataset.photoId = photo.id
    thumb.draggable = true

    const img = document.createElement('img')
    img.src = publicUrl
    img.alt = 'Photo thumbnail'
    img.loading = 'lazy'
    img.style.objectPosition = photo.focal_point || '50% 35%'

    const check = document.createElement('span')
    check.className = 'ss-check'
    check.textContent = '✓'

    const excl = document.createElement('div')
    excl.className = 'ss-excl'

    thumb.appendChild(img)
    thumb.appendChild(check)
    thumb.appendChild(excl)

    // Click: toggle with shift-click range support
    thumb.addEventListener('click', (e) => {
      const thumbs = [...grid.querySelectorAll('.ss-thumb')]
      const thisIdx = thumbs.indexOf(thumb)

      if (e.shiftKey && ssLastClickedIdx >= 0) {
        // Apply the state of the anchor item to the whole range
        const anchorId = thumbs[ssLastClickedIdx]?.dataset.photoId
        const targetIncluded = ssSelectedPhotos.has(anchorId)
        const start = Math.min(ssLastClickedIdx, thisIdx)
        const end   = Math.max(ssLastClickedIdx, thisIdx)
        for (let i = start; i <= end; i++) {
          const pid = thumbs[i].dataset.photoId
          if (targetIncluded) {
            ssSelectedPhotos.add(pid)
            thumbs[i].classList.add('selected')
            thumbs[i].classList.remove('ss-excluded')
          } else {
            ssSelectedPhotos.delete(pid)
            thumbs[i].classList.remove('selected')
            thumbs[i].classList.add('ss-excluded')
          }
        }
      } else {
        if (ssSelectedPhotos.has(photo.id)) {
          ssSelectedPhotos.delete(photo.id)
          thumb.classList.remove('selected')
          thumb.classList.add('ss-excluded')
        } else {
          ssSelectedPhotos.add(photo.id)
          thumb.classList.add('selected')
          thumb.classList.remove('ss-excluded')
        }
        ssLastClickedIdx = thisIdx
      }
      updateSSCount()
    })

    // Drag-to-reorder
    thumb.addEventListener('dragstart', (e) => {
      ssDragSrcIdx = [...grid.querySelectorAll('.ss-thumb')].indexOf(thumb)
      e.dataTransfer.effectAllowed = 'move'
      requestAnimationFrame(() => thumb.classList.add('ss-dragging'))
    })
    thumb.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if ([...grid.querySelectorAll('.ss-thumb')].indexOf(thumb) !== ssDragSrcIdx) {
        thumb.classList.add('ss-drag-over')
      }
    })
    thumb.addEventListener('dragleave', () => thumb.classList.remove('ss-drag-over'))
    thumb.addEventListener('drop', (e) => {
      e.preventDefault()
      thumb.classList.remove('ss-drag-over')
      const thumbs = [...grid.querySelectorAll('.ss-thumb')]
      const tgtIdx = thumbs.indexOf(thumb)
      if (ssDragSrcIdx === null || tgtIdx === ssDragSrcIdx) return
      const srcThumb = thumbs[ssDragSrcIdx]
      if (ssDragSrcIdx < tgtIdx) thumb.insertAdjacentElement('afterend', srcThumb)
      else thumb.insertAdjacentElement('beforebegin', srcThumb)
      // Rebuild ssSortedPhotos from new DOM order
      const byId = Object.fromEntries(allPhotos.map(p => [p.id, p]))
      ssSortedPhotos = [...grid.querySelectorAll('.ss-thumb')]
        .map(t => byId[t.dataset.photoId]).filter(Boolean)
      ssDragSrcIdx = null
    })
    thumb.addEventListener('dragend', () => {
      thumb.classList.remove('ss-dragging')
      grid.querySelectorAll('.ss-thumb').forEach(t => t.classList.remove('ss-drag-over'))
      ssDragSrcIdx = null
    })

    grid.appendChild(thumb)
  })

  updateSSCount()

  const hint = document.getElementById('ss-config-hint')
  if (hint) {
    if (savedConfig) {
      hint.textContent = `✓ Saved · ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} included · Shift+click range · Drag to reorder`
    } else {
      hint.textContent = 'Click to include/exclude · Shift+click for range · Drag to reorder'
    }
  }

  modal.classList.add('show')
}

function updateSSCount() {
  const total = ssSortedPhotos.length || allPhotos.length
  const selected = ssSelectedPhotos.size
  const countEl = document.getElementById('ss-selected-count')
  const startBtn = document.getElementById('ss-start-btn')
  if (countEl) countEl.textContent = selected === total ? `All ${total} selected` : `${selected} of ${total} selected`
  if (startBtn) startBtn.disabled = selected === 0
}

function startSlideshowFromSelector() {
  if (!currentAlbumId) return
  const modal = document.getElementById('ss-selector-modal')
  if (modal) modal.classList.remove('show')

  // Use sorted order, filtered to included only
  const includedInOrder = ssSortedPhotos.filter(p => ssSelectedPhotos.has(p.id))
  if (includedInOrder.length === 0) { showToast('No photos selected', true); return }

  // Check if it's the full unmodified default
  const isDefault = includedInOrder.length === allPhotos.length &&
    ssSortedPhotos.map(p => p.id).join() === allPhotos.map(p => p.id).join()

  trackSlideshowStart(currentAlbumId, albumNameEl.textContent, includedInOrder.length)

  if (isDefault) {
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
  } else {
    const ids = includedInOrder.map(p => p.id).join(',')
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}&photos=${encodeURIComponent(ids)}`
  }
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

    updateMusicBadge(!!albumData?.music_url, albumData?.music_url)

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

  commentsController.bindCommentForm()

  // Intercept slideshow button → open photo selector instead of navigating directly
  if (slideshowBtnEl) {
    slideshowBtnEl.addEventListener('click', e => {
      e.preventDefault()
      openSlideshowSelector()
    })
  }

  // Slideshow selector modal buttons
  const ssSelectorModal = document.getElementById('ss-selector-modal')
  document.getElementById('ss-select-all')?.addEventListener('click', () => {
    ssSelectedPhotos = new Set(ssSortedPhotos.map(p => p.id))
    document.querySelectorAll('.ss-thumb').forEach(t => {
      t.classList.add('selected')
      t.classList.remove('ss-excluded')
    })
    ssLastClickedIdx = -1
    updateSSCount()
  })
  document.getElementById('ss-clear-all')?.addEventListener('click', () => {
    ssSelectedPhotos.clear()
    document.querySelectorAll('.ss-thumb').forEach(t => {
      t.classList.remove('selected')
      t.classList.add('ss-excluded')
    })
    ssLastClickedIdx = -1
    updateSSCount()
  })
  document.getElementById('ss-save-btn')?.addEventListener('click', saveSlideshowConfig)
  document.getElementById('ss-selector-close')?.addEventListener('click', () => {
    ssSelectorModal?.classList.remove('show')
  })
  document.getElementById('ss-cancel-btn')?.addEventListener('click', () => {
    ssSelectorModal?.classList.remove('show')
  })
  document.getElementById('ss-start-btn')?.addEventListener('click', startSlideshowFromSelector)
  ssSelectorModal?.addEventListener('click', e => {
    if (e.target === ssSelectorModal) ssSelectorModal.classList.remove('show')
  })

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

// Music button — open modal
if (musicBtnEl) {
  musicBtnEl.addEventListener('click', () => {
    if (!isAlbumOwner) {
      showToast('Only album owners can manage music', true)
      return
    }
    loadMusicUrl()
    switchMusicTab('library')
    loadMusicLibrary()
    musicModal.classList.add('show')
  })
}

// Music modal — URL tab buttons
if (musicSaveBtn) musicSaveBtn.addEventListener('click', saveMusicUrl)
if (musicClearBtn) musicClearBtn.addEventListener('click', clearMusicUrl)
if (musicCloseBtn) musicCloseBtn.addEventListener('click', closeMusicModal)

// Music modal — remove current music
document.getElementById('music-remove-btn')?.addEventListener('click', removeMusicFromAlbum)

// Music modal — tab switching
document.querySelectorAll('.music-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    switchMusicTab(tab)
    if (tab === 'library') loadMusicLibrary()
  })
})

// Music modal — upload zone click
if (musicUploadZone) {
  musicUploadZone.addEventListener('click', () => musicFileInput?.click())
  musicUploadZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); musicFileInput?.click() }
  })
  musicUploadZone.addEventListener('dragover', e => {
    e.preventDefault()
    musicUploadZone.classList.add('drag-over')
  })
  musicUploadZone.addEventListener('dragleave', () => musicUploadZone.classList.remove('drag-over'))
  musicUploadZone.addEventListener('drop', e => {
    e.preventDefault()
    musicUploadZone.classList.remove('drag-over')
    const file = e.dataTransfer?.files?.[0]
    if (file) uploadMusicFile(file)
  })
}

// Music modal — file input change
if (musicFileInput) {
  musicFileInput.addEventListener('change', () => {
    const file = musicFileInput.files?.[0]
    if (file) uploadMusicFile(file)
  })
}

// Close music modal when clicking outside
if (musicModal) {
  musicModal.addEventListener('click', (e) => {
    if (e.target === musicModal) closeMusicModal()
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
