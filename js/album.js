import { supabase } from './supabase.js'

const albumNameEl = document.getElementById('album-name')
const albumNameEditEl = document.getElementById('album-name-edit')
const editTitleBtnEl = document.getElementById('edit-title-btn')
const saveTitleBtnEl = document.getElementById('save-title-btn')
const cancelTitleBtnEl = document.getElementById('cancel-title-btn')
const titleEditBtnsEl = document.getElementById('title-edit-btns')
const lightboxEl = document.getElementById('lightbox')
const lightboxImgEl = document.getElementById('lightbox-img')
const lightboxVideoEl = document.getElementById('lightbox-video')
const lightboxCloseEl = document.getElementById('lightbox-close')
const lightboxDownloadEl = document.getElementById('lightbox-download')

function isVideoPath(path) {
  return /\.(mp4|mov|webm|m4v)$/i.test(path || '')
}
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

let currentAlbumId = null
let coverPhotoId = null
let currentUser = null
let isAlbumOwner = false
let isAdmin = false
let currentLightboxPhotoId = null
let currentLightboxUrl = null
let currentLightboxFilePath = null
let selectedPhotos = new Set()
let allPhotos = []
let ssSelectedPhotos = new Set()
let isDraggingSelect = false
let dragStartX = 0
let dragStartY = 0
const dragSelectArea = document.createElement('div')
dragSelectArea.className = 'drag-select-area'
document.body.appendChild(dragSelectArea)

function getAlbumId() {
  return new URLSearchParams(window.location.search).get('album') || 
         new URLSearchParams(window.location.search).get('id')
}

async function checkAlbumOwner() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
    isAlbumOwner = !!user
    isAdmin = user?.email === 'joe@whostosay.org'
  } catch (err) {
    currentUser = null
    isAlbumOwner = false
    isAdmin = false
  }
}

// --- Title size (S/M/L) — admin only ---
// SQL required: ALTER TABLE albums ADD COLUMN IF NOT EXISTS title_size TEXT;
const TITLE_SIZES = { sm: '1.2rem', md: '1.8rem', lg: '2.5rem' }

function applyTitleSize(size) {
  if (size && TITLE_SIZES[size]) {
    albumNameEl.style.fontSize = TITLE_SIZES[size]
    albumNameEl.dataset.sizeOverride = size
  } else {
    delete albumNameEl.dataset.sizeOverride
    albumNameEl.style.fontSize = ''
    window.fitAlbumTitle?.()
  }
  document.querySelectorAll('.title-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size)
  })
}

async function saveTitleSize(size) {
  if (!isAdmin || !currentAlbumId) return
  try {
    const { error } = await supabase
      .from('albums')
      .update({ title_size: size })
      .eq('id', currentAlbumId)
    if (error) throw error
    applyTitleSize(size)
    showToast(`Title size: ${size.toUpperCase()}`)
  } catch (err) {
    showToast('Failed to save size: ' + err.message, true)
  }
}

// --- Lightbox ---
function openLightbox(url, photoId, filePath) {
  const isVideo = isVideoPath(filePath || url)
  if (isVideo) {
    lightboxImgEl.style.display = 'none'
    lightboxImgEl.src = ''
    lightboxVideoEl.style.display = 'block'
    lightboxVideoEl.src = url
    lightboxVideoEl.load()
  } else {
    lightboxVideoEl.style.display = 'none'
    lightboxVideoEl.src = ''
    lightboxImgEl.style.display = 'block'
    lightboxImgEl.src = url
  }
  lightboxEl.classList.add('show')
  document.body.style.overflow = 'hidden'
  currentLightboxPhotoId = photoId || null
  currentLightboxUrl = url || null
  currentLightboxFilePath = filePath || null
  if (photoId) loadComments(photoId)
}

function closeLightbox() {
  lightboxEl.classList.remove('show')
  document.body.style.overflow = ''
  lightboxImgEl.src = ''
  lightboxVideoEl.pause()
  lightboxVideoEl.src = ''
  currentLightboxPhotoId = null
  currentLightboxUrl = null
  currentLightboxFilePath = null
}

// --- Comments ---
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return `${Math.floor(d/86400)}d ago`
}

async function loadComments(photoId) {
  const listEl  = document.getElementById('lc-list')
  const countEl = document.getElementById('lc-count')
  const formEl  = document.getElementById('lc-form')
  const signinEl= document.getElementById('lc-signin')
  if (!listEl) return

  // Show/hide input based on login state
  if (currentUser) {
    formEl.style.display = 'flex'
    signinEl.style.display = 'none'
    // Set sign-in link to return here after login
    const loginLink = document.getElementById('lc-login-link')
    if (loginLink) loginLink.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
  } else {
    formEl.style.display = 'none'
    signinEl.style.display = 'block'
  }

  listEl.innerHTML = '<div class="lc-loading">Loading…</div>'

  try {
    const { data: comments, error } = await supabase
      .from('photo_comments')
      .select('id, user_id, user_email, comment, created_at')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true })

    if (error) throw error

    countEl.textContent = comments?.length ? `(${comments.length})` : ''
    listEl.innerHTML = ''

    if (!comments || comments.length === 0) {
      listEl.innerHTML = '<div class="lc-empty">No comments yet.</div>'
      return
    }

    comments.forEach(c => listEl.appendChild(buildCommentEl(c)))
    listEl.scrollTop = listEl.scrollHeight
  } catch (err) {
    console.error('loadComments error:', err)
    listEl.innerHTML = '<div class="lc-empty">Could not load comments.</div>'
  }
}

function buildCommentEl(c) {
  const isAdmin = currentUser?.email === 'joe@whostosay.org'
  const isOwn   = currentUser?.id === c.user_id
  const canDel  = isAdmin || isOwn

  const item = document.createElement('div')
  item.className = 'lc-item'
  item.dataset.commentId = c.id

  const shortName = escHtml(c.user_email.split('@')[0])
  const timeStr   = escHtml(timeAgo(c.created_at))
  const text      = escHtml(c.comment)

  item.innerHTML = `
    <div class="lc-item-meta">
      <span class="lc-author">${shortName}</span>
      <span class="lc-time">${timeStr}</span>
    </div>
    <p class="lc-text">${text}</p>
    ${canDel ? `<button class="lc-del" title="Delete comment">✕</button>` : ''}
  `

  if (canDel) {
    item.querySelector('.lc-del').addEventListener('click', () => deleteComment(c.id, item))
  }
  return item
}

async function postComment() {
  if (!currentUser || !currentLightboxPhotoId) return
  const input     = document.getElementById('lc-input')
  const submitBtn = document.getElementById('lc-submit')
  const text = input.value.trim()
  if (!text) return

  submitBtn.disabled = true
  try {
    const { error } = await supabase.from('photo_comments').insert({
      photo_id:   currentLightboxPhotoId,
      user_id:    currentUser.id,
      user_email: currentUser.email,
      comment:    text
    })
    if (error) throw error
    input.value = ''
    await loadComments(currentLightboxPhotoId)
  } catch (err) {
    showToast('Failed to post comment: ' + err.message, true)
  } finally {
    submitBtn.disabled = false
  }
}

async function deleteComment(commentId, itemEl) {
  try {
    const { error } = await supabase.from('photo_comments').delete().eq('id', commentId)
    if (error) throw error
    itemEl.remove()
    // Update count
    const listEl  = document.getElementById('lc-list')
    const countEl = document.getElementById('lc-count')
    const remaining = listEl.querySelectorAll('.lc-item').length
    countEl.textContent = remaining ? `(${remaining})` : ''
    if (remaining === 0) listEl.innerHTML = '<div class="lc-empty">No comments yet.</div>'
    showToast('Comment deleted')
  } catch (err) {
    showToast('Delete failed: ' + err.message, true)
  }
}

lightboxCloseEl.addEventListener('click', closeLightbox)
lightboxEl.addEventListener('click', e => { if (e.target === lightboxEl) closeLightbox() })

if (lightboxDownloadEl) {
  lightboxDownloadEl.addEventListener('click', () => {
    if (!currentLightboxUrl) return
    const filename = currentLightboxFilePath
      ? currentLightboxFilePath.split('/').pop()
      : 'photo'
    downloadPhoto(currentLightboxUrl, filename)
  })
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && lightboxEl.classList.contains('show')) closeLightbox()
})

// --- Title edit ---
function startTitleEdit() {
  albumNameEditEl.value = albumNameEl.textContent
  albumNameEl.style.display = 'none'
  editTitleBtnEl.style.display = 'none'
  albumNameEditEl.style.display = ''
  titleEditBtnsEl.style.display = 'flex'
  albumNameEditEl.focus()
  albumNameEditEl.select()
}

async function saveTitleEdit() {
  const name = albumNameEditEl.value.trim()
  if (!name) return
  try {
    const { data, error } = await supabase
      .from('albums')
      .update({ name })
      .eq('id', currentAlbumId)
      .select('name')
    if (error) throw error
    if (!data || !data.length) throw new Error('Update blocked — check Supabase RLS UPDATE policy for albums')
    albumNameEl.textContent = name
    showToast('✓ Album name updated')
  } catch (err) {
    showToast(err.message, true)
  }
  cancelTitleEdit()
}

function cancelTitleEdit() {
  albumNameEl.style.display = ''
  editTitleBtnEl.style.display = ''   // let CSS (.admin-bar-btn) control display
  albumNameEditEl.style.display = 'none'
  titleEditBtnsEl.style.display = 'none'
}

editTitleBtnEl.addEventListener('click', startTitleEdit)
saveTitleBtnEl.addEventListener('click', saveTitleEdit)
cancelTitleBtnEl.addEventListener('click', cancelTitleEdit)
albumNameEditEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveTitleEdit()
  if (e.key === 'Escape') cancelTitleEdit()
})

function showToast(message, isError = false) {
  const toast = document.createElement('div')
  toast.className = 'toast-notification' + (isError ? ' error' : '')
  toast.textContent = message
  
  document.body.appendChild(toast)
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10)
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

async function setCoverPhoto(photoId) {
  if (!isAlbumOwner || !currentAlbumId) return

  try {
    const { data, error } = await supabase
      .from('albums')
      .update({ cover_photo_id: photoId })
      .eq('id', currentAlbumId)
      .select('cover_photo_id')

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Cover update blocked — check Supabase RLS UPDATE policy for albums table')

    coverPhotoId = photoId
    updateCoverIndicators()
    showToast('✓ Cover photo set')
  } catch (err) {
    console.error('Error setting cover:', err)
    showToast(err.message, true)
  }
}

function updateCoverIndicators() {
  document.querySelectorAll('.photo-tile').forEach(tile => {
    const photoId = tile.dataset.photoId
    if (photoId === coverPhotoId) {
      tile.classList.add('is-cover')
    } else {
      tile.classList.remove('is-cover')
    }
  })
}

function togglePhotoSelection(photoId) {
  if (selectedPhotos.has(photoId)) {
    selectedPhotos.delete(photoId)
  } else {
    selectedPhotos.add(photoId)
  }
  updateSelectionUI()
}

function selectPhotosInRect(startX, startY, endX, endY) {
  // Normalize coordinates
  const rect = {
    left: Math.min(startX, endX),
    right: Math.max(startX, endX),
    top: Math.min(startY, endY),
    bottom: Math.max(startY, endY)
  }

  // Get all photo tiles and check which ones are in the selection area
  document.querySelectorAll('.photo-tile').forEach(tile => {
    const tileRect = tile.getBoundingClientRect()
    
    // Check if tile overlaps with selection rectangle
    if (tileRect.left < rect.right &&
        tileRect.right > rect.left &&
        tileRect.top < rect.bottom &&
        tileRect.bottom > rect.top) {
      const photoId = tile.dataset.photoId
      selectedPhotos.add(photoId)
    }
  })
}

function startDragSelect(e) {
  // Only allow drag select when clicking on empty grid space
  if (e.target.closest('.photo-tile')) return
  
  isDraggingSelect = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  
  dragSelectArea.classList.add('active')
  dragSelectArea.style.left = dragStartX + 'px'
  dragSelectArea.style.top = dragStartY + 'px'
  dragSelectArea.style.width = '0'
  dragSelectArea.style.height = '0'
  
  photosGridEl.classList.add('drag-selecting')
  
  // Don't select text during drag
  e.preventDefault()
}

function updateDragSelect(e) {
  if (!isDraggingSelect) return
  
  const currentX = e.clientX
  const currentY = e.clientY
  
  const width = Math.abs(currentX - dragStartX)
  const height = Math.abs(currentY - dragStartY)
  const left = Math.min(dragStartX, currentX)
  const top = Math.min(dragStartY, currentY)
  
  dragSelectArea.style.left = left + 'px'
  dragSelectArea.style.top = top + 'px'
  dragSelectArea.style.width = width + 'px'
  dragSelectArea.style.height = height + 'px'
}

function endDragSelect(e) {
  if (!isDraggingSelect) return
  
  isDraggingSelect = false
  dragSelectArea.classList.remove('active')
  photosGridEl.classList.remove('drag-selecting')
  
  // Select photos in the dragged area
  selectPhotosInRect(dragStartX, dragStartY, e.clientX, e.clientY)
  updateSelectionUI()
}

function updateSelectionUI() {
  const count = selectedPhotos.size
  selectionCountEl.textContent = `${count} photo${count !== 1 ? 's' : ''} selected`

  if (count > 0) {
    bulkActionsBar.classList.add('show')
  } else {
    bulkActionsBar.classList.remove('show')
  }

  // Delete and Move are owner-only
  if (bulkDeleteBtn) bulkDeleteBtn.style.display = isAlbumOwner ? '' : 'none'
  if (bulkMoveBtn) bulkMoveBtn.style.display = isAlbumOwner ? '' : 'none'

  document.querySelectorAll('.photo-checkbox').forEach(checkbox => {
    const photoId = checkbox.closest('.photo-tile')?.dataset.photoId
    if (photoId && selectedPhotos.has(photoId)) {
      checkbox.checked = true
    } else if (photoId) {
      checkbox.checked = false
    }
  })

  document.querySelectorAll('.photo-tile').forEach(tile => {
    const photoId = tile.dataset.photoId
    if (selectedPhotos.has(photoId)) {
      tile.classList.add('selected')
    } else {
      tile.classList.remove('selected')
    }
  })
}

async function deletePhoto(photoId, filePath) {
  const { error: storageError } = await supabase.storage.from('photos').remove([filePath])
  if (storageError) throw new Error(`Storage delete failed: ${storageError.message}`)

  const { data, error: dbError } = await supabase.from('photos').delete().eq('id', photoId).select('id')
  if (dbError) throw new Error(`DB delete failed: ${dbError.message}`)
  if (!data || data.length === 0) throw new Error('Delete blocked — add a DELETE policy for the photos table in Supabase (Authentication → Policies)')
}

async function deleteSelectedPhotos() {
  if (selectedPhotos.size === 0 || !isAlbumOwner) return

  const confirm = window.confirm(`Delete ${selectedPhotos.size} photo(s)? This cannot be undone.`)
  if (!confirm) return

  try {
    for (const photoId of selectedPhotos) {
      const photo = allPhotos.find(p => p.id === photoId)
      if (!photo) continue
      await deletePhoto(photoId, photo.file_path)
    }

    selectedPhotos.clear()
    updateSelectionUI()
    loadAlbum()
  } catch (err) {
    console.error('Delete error:', err)
    showToast(err.message, true)
  }
}

async function showMoveModal() {
  if (selectedPhotos.size === 0 || !isAlbumOwner) return

  try {
    const { data: albums, error } = await supabase
      .from('albums')
      .select('id, name')
      .neq('id', currentAlbumId)
      .order('name')

    if (error) throw error

    albumListEl.innerHTML = ''
    if (!albums || albums.length === 0) {
      albumListEl.innerHTML = '<p style="color: var(--text-muted);">No other albums available</p>'
    } else {
      albums.forEach(album => {
        const option = document.createElement('div')
        option.className = 'album-option'
        option.textContent = album.name
        option.addEventListener('click', () => movePhotos(album.id, album.name))
        albumListEl.appendChild(option)
      })
    }

    moveModal.classList.add('show')
  } catch (err) {
    console.error('Error loading albums:', err)
    alert('Failed to load albums')
  }
}

async function movePhotos(targetAlbumId, targetAlbumName) {
  const count = selectedPhotos.size
  try {
    for (const photoId of selectedPhotos) {
      const { error } = await supabase
        .from('photos')
        .update({ album_id: targetAlbumId })
        .eq('id', photoId)
      if (error) throw error
    }

    moveModal.classList.remove('show')
    selectedPhotos.clear()
    updateSelectionUI()
    showToast(`Moved ${count} photo${count !== 1 ? 's' : ''} to "${targetAlbumName}"`)
    loadAlbum()
  } catch (err) {
    console.error('Move error:', err)
    showToast(`Failed to move photos: ${err.message}`, true)
  }
}

// --- Drag-to-reorder ---
let dragSrcId = null

function initDragAndDrop() {
  document.querySelectorAll('.photo-tile[draggable]').forEach(tile => {
    tile.addEventListener('dragstart', onDragStart)
    tile.addEventListener('dragover',  onDragOver)
    tile.addEventListener('dragleave', onDragLeave)
    tile.addEventListener('drop',      onDrop)
    tile.addEventListener('dragend',   onDragEnd)
  })
}

function onDragStart(e) {
  dragSrcId = this.dataset.photoId
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', dragSrcId)
  // Slight delay so the ghost image captures the un-dimmed tile
  requestAnimationFrame(() => this.classList.add('dragging'))
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (this.dataset.photoId !== dragSrcId) this.classList.add('drag-over')
}

function onDragLeave() {
  this.classList.remove('drag-over')
}

async function onDrop(e) {
  e.preventDefault()
  this.classList.remove('drag-over')
  const targetId = this.dataset.photoId
  if (!targetId || targetId === dragSrcId) return

  const srcTile = photosGridEl.querySelector(`[data-photo-id="${dragSrcId}"]`)
  const tgtTile = this
  if (!srcTile || !tgtTile) return

  const tiles = [...photosGridEl.querySelectorAll('.photo-tile')]
  const srcIdx = tiles.indexOf(srcTile)
  const tgtIdx = tiles.indexOf(tgtTile)

  if (srcIdx < tgtIdx) {
    tgtTile.insertAdjacentElement('afterend', srcTile)
  } else {
    tgtTile.insertAdjacentElement('beforebegin', srcTile)
  }

  await savePhotoOrder()
}

function onDragEnd() {
  this.classList.remove('dragging')
  document.querySelectorAll('.photo-tile').forEach(t => t.classList.remove('drag-over'))
  dragSrcId = null
}

async function savePhotoOrder() {
  const tiles = [...photosGridEl.querySelectorAll('.photo-tile')]
  try {
    await Promise.all(
      tiles.map((tile, idx) =>
        supabase.from('photos').update({ sort_order: idx }).eq('id', tile.dataset.photoId)
      )
    )
    showToast('✓ Order saved')
  } catch (err) {
    showToast('Failed to save order: ' + err.message, true)
  }
}

// --- Download ---
async function downloadPhoto(url, filename) {
  showToast('Downloading…')
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'photo'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (err) {
    showToast('Download failed: ' + err.message, true)
  }
}

async function downloadSelectedPhotos() {
  if (selectedPhotos.size === 0) return

  const photos = [...selectedPhotos]
    .map(id => allPhotos.find(p => p.id === id))
    .filter(Boolean)

  if (photos.length === 1) {
    const photo = photos[0]
    const url = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl
    await downloadPhoto(url, photo.file_path.split('/').pop())
    return
  }

  // Multiple photos → zip
  showToast(`Preparing ${photos.length} files…`)
  try {
    const zip = new JSZip() // eslint-disable-line no-undef
    for (const photo of photos) {
      const url = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl
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

async function loadMusicUrl() {
  try {
    const { data: albumData, error } = await supabase
      .from('albums')
      .select('music_url')
      .eq('id', currentAlbumId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    
    const savedUrl = albumData?.music_url || ''
    musicUrlInput.value = savedUrl

    // Show/hide the saved URL preview in modal
    let urlPreview = document.getElementById('music-url-preview')
    if (!urlPreview) {
      urlPreview = document.createElement('div')
      urlPreview.id = 'music-url-preview'
      urlPreview.style.cssText = 'margin-top:8px;font-size:0.8rem;color:var(--text-muted);word-break:break-all;'
      musicUrlInput.parentElement.appendChild(urlPreview)
    }
    urlPreview.textContent = savedUrl ? `Saved: ${savedUrl}` : ''
  } catch (err) {
    console.error('Load music URL error:', err)
  }
}

async function saveMusicUrl() {
  if (!isAlbumOwner) {
    showToast('You must be the album owner to change music', true)
    return
  }

  const musicUrl = musicUrlInput.value.trim()

  try {
    const { data, error } = await supabase
      .from('albums')
      .update({ music_url: musicUrl || null })
      .eq('id', currentAlbumId)
      .select('music_url')

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

function clearMusicUrl() {
  musicUrlInput.value = ''
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

// --- Slideshow selector ---
function openSlideshowSelector() {
  if (allPhotos.length === 0) {
    // Fallback: navigate directly if photos not yet loaded
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
    return
  }

  const modal = document.getElementById('ss-selector-modal')
  const grid = document.getElementById('ss-photo-grid')
  if (!modal || !grid) return

  // Default: all selected
  ssSelectedPhotos = new Set(allPhotos.map(p => p.id))
  grid.innerHTML = ''

  allPhotos.forEach(photo => {
    const publicUrl = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl

    const thumb = document.createElement('div')
    thumb.className = 'ss-thumb selected'
    thumb.dataset.photoId = photo.id

    const img = document.createElement('img')
    img.src = publicUrl
    img.alt = 'Photo thumbnail'
    img.loading = 'lazy'
    img.style.objectPosition = photo.focal_point || '50% 35%'

    const check = document.createElement('span')
    check.className = 'ss-check'
    check.textContent = '✓'

    thumb.appendChild(img)
    thumb.appendChild(check)
    thumb.addEventListener('click', () => {
      if (ssSelectedPhotos.has(photo.id)) {
        ssSelectedPhotos.delete(photo.id)
        thumb.classList.remove('selected')
      } else {
        ssSelectedPhotos.add(photo.id)
        thumb.classList.add('selected')
      }
      updateSSCount()
    })
    grid.appendChild(thumb)
  })

  updateSSCount()
  modal.classList.add('show')
}

function updateSSCount() {
  const total = allPhotos.length
  const selected = ssSelectedPhotos.size
  const countEl = document.getElementById('ss-selected-count')
  const startBtn = document.getElementById('ss-start-btn')
  if (countEl) countEl.textContent = selected === total ? 'All selected' : `${selected} of ${total} selected`
  if (startBtn) startBtn.disabled = selected === 0
}

function startSlideshowFromSelector() {
  if (!currentAlbumId) return
  const modal = document.getElementById('ss-selector-modal')
  if (modal) modal.classList.remove('show')

  if (ssSelectedPhotos.size === allPhotos.length) {
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
  } else {
    const ids = [...ssSelectedPhotos].join(',')
    window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}&photos=${encodeURIComponent(ids)}`
  }
}

async function loadAlbum() {
  currentAlbumId = getAlbumId()
  
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
    // Fetch album data
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('name, cover_photo_id, music_url, title_size')
      .eq('id', currentAlbumId)
      .limit(1)
      .single()

    if (albumError) throw albumError

    if (albumData?.name) {
      albumNameEl.textContent = albumData.name
      if (albumData.title_size) {
        applyTitleSize(albumData.title_size)
      } else {
        window.fitAlbumTitle?.()
      }
    }

    if (albumData?.cover_photo_id) {
      coverPhotoId = albumData.cover_photo_id
    }

    updateMusicBadge(!!albumData?.music_url, albumData?.music_url)

    // Fetch photos for this album
    // SQL required: ALTER TABLE photos ADD COLUMN IF NOT EXISTS sort_order INTEGER;
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, file_path, created_at, focal_point, sort_order')
      .eq('album_id', currentAlbumId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (photosError) throw photosError

    if (!photos || photos.length === 0) {
      emptyStateEl.style.display = 'block'
      photosGridEl.innerHTML = ''
      return
    }

    emptyStateEl.style.display = 'none'
    photosGridEl.innerHTML = ''

    // Store all photos for bulk operations
    allPhotos = photos

    // Render photos with staggered animation and cover buttons
    photos.forEach((photo, idx) => {
      const publicUrl = supabase.storage
        .from('photos')
        .getPublicUrl(photo.file_path).data.publicUrl

      const tile = document.createElement('div')
      tile.className = 'photo-tile'
      tile.dataset.photoId = photo.id
      tile.style.animationDelay = `${idx * 0.05}s`

      const isVid = isVideoPath(photo.file_path)
      let media
      if (isVid) {
        media = document.createElement('video')
        media.src = publicUrl
        media.muted = true
        media.playsInline = true
        media.loop = true
        media.preload = 'metadata'
        media.style.cursor = 'pointer'
        media.addEventListener('mouseenter', () => media.play())
        media.addEventListener('mouseleave', () => { media.pause(); media.currentTime = 0 })

        const badge = document.createElement('span')
        badge.className = 'video-badge'
        badge.textContent = '▶ Video'
        tile.appendChild(badge)
      } else {
        media = document.createElement('img')
        media.src = publicUrl
        media.alt = 'Photo from album'
        media.loading = 'lazy'
        media.width = 600
        media.height = 400
        media.style.objectPosition = photo.focal_point || '50% 50%'
        media.style.cursor = 'zoom-in'
      }
      media.addEventListener('click', () => openLightbox(publicUrl, photo.id, photo.file_path))

      tile.appendChild(media)

      // Checkbox for selection — available to all users
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'photo-checkbox'
      checkbox.addEventListener('change', () => togglePhotoSelection(photo.id))

      // Ctrl/Cmd+click to toggle selection
      tile.addEventListener('click', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.target.closest('button')) {
          e.preventDefault()
          checkbox.checked = !checkbox.checked
          togglePhotoSelection(photo.id)
        }
      })

      tile.appendChild(checkbox)

      // Photo controls — download for all, cover/delete for owners only
      const controls = document.createElement('div')
      controls.className = isAlbumOwner ? 'photo-controls full-width' : 'photo-controls'

      const downloadBtn = document.createElement('button')
      downloadBtn.className = 'photo-btn download-photo'
      downloadBtn.textContent = '⬇ Save'
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const filename = photo.file_path.split('/').pop()
        downloadPhoto(publicUrl, filename)
      })
      controls.appendChild(downloadBtn)

      if (isAlbumOwner) {
        const setCoverBtn = document.createElement('button')
        setCoverBtn.className = 'photo-btn set-cover'
        setCoverBtn.textContent = photo.id === coverPhotoId ? '★ Cover' : 'Set Cover'
        setCoverBtn.addEventListener('click', () => setCoverPhoto(photo.id))

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'photo-btn delete-photo'
        deleteBtn.textContent = '🗑 Delete'
        deleteBtn.addEventListener('click', async () => {
          const confirm = window.confirm('Delete this photo?')
          if (confirm) {
            try {
              const photoToDelete = allPhotos.find(p => p.id === photo.id)
              if (photoToDelete) {
                await deletePhoto(photo.id, photoToDelete.file_path)
                loadAlbum()
              }
            } catch (err) {
              console.error('Delete error:', err)
              showToast(err.message, true)
            }
          }
        })

        controls.appendChild(setCoverBtn)
        controls.appendChild(deleteBtn)
      }

      tile.appendChild(controls)

      // Drag-to-reorder: owner only
      if (isAlbumOwner) {
        tile.draggable = true
        const handle = document.createElement('div')
        handle.className = 'drag-handle'
        handle.title = 'Drag to reorder'
        handle.textContent = '⠿'
        tile.appendChild(handle)
      }

      // Mark if this is the cover
      if (photo.id === coverPhotoId) {
        tile.classList.add('is-cover')
      }

      photosGridEl.appendChild(tile)
    })

    if (isAlbumOwner) initDragAndDrop()

  } catch (err) {
    console.error('Load album error:', err)
    emptyStateEl.textContent = `Error loading album: ${err.message}`
    emptyStateEl.style.display = 'block'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAlbum()

  document.querySelectorAll('.title-size-btn').forEach(btn => {
    btn.addEventListener('click', () => saveTitleSize(btn.dataset.size))
  })

  const submitBtn = document.getElementById('lc-submit')
  const inputEl   = document.getElementById('lc-input')
  if (submitBtn) submitBtn.addEventListener('click', postComment)
  if (inputEl) {
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() }
    })
  }

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
    ssSelectedPhotos = new Set(allPhotos.map(p => p.id))
    document.querySelectorAll('.ss-thumb').forEach(t => t.classList.add('selected'))
    updateSSCount()
  })
  document.getElementById('ss-clear-all')?.addEventListener('click', () => {
    ssSelectedPhotos.clear()
    document.querySelectorAll('.ss-thumb').forEach(t => t.classList.remove('selected'))
    updateSSCount()
  })
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
})

// Drag-select event listeners
if (photosGridEl) {
  photosGridEl.addEventListener('mousedown', startDragSelect)
  document.addEventListener('mousemove', updateDragSelect)
  document.addEventListener('mouseup', endDragSelect)
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
    updateSelectionUI()
  })
}

if (modalCancelBtn) {
  modalCancelBtn.addEventListener('click', () => {
    moveModal.classList.remove('show')
  })
}

// Music button event listeners
if (musicBtnEl) {
  musicBtnEl.addEventListener('click', () => {
    if (!isAlbumOwner) {
      alert('Only album owners can manage music')
      return
    }
    loadMusicUrl()
    musicModal.classList.add('show')
  })
}

if (musicSaveBtn) {
  musicSaveBtn.addEventListener('click', saveMusicUrl)
}

if (musicClearBtn) {
  musicClearBtn.addEventListener('click', clearMusicUrl)
}

if (musicCloseBtn) {
  musicCloseBtn.addEventListener('click', closeMusicModal)
}

// Close music modal when clicking outside
if (musicModal) {
  musicModal.addEventListener('click', (e) => {
    if (e.target === musicModal) {
      closeMusicModal()
    }
  })
}
