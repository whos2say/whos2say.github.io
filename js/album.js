import { supabase } from './supabase.js'

const albumNameEl = document.getElementById('album-name')
const photosGridEl = document.getElementById('photos-grid')
const emptyStateEl = document.getElementById('empty-state')
const uploadBtnEl = document.getElementById('upload-btn')
const slideshowBtnEl = document.getElementById('slideshow-btn')
const musicBtnEl = document.getElementById('music-btn')
const bulkActionsBar = document.querySelector('.bulk-actions-bar')
const selectionCountEl = document.getElementById('selection-count')
const bulkDeleteBtn = document.getElementById('bulk-delete-btn')
const bulkMoveBtn = document.getElementById('bulk-move-btn')
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
let isAlbumOwner = false
let selectedPhotos = new Set()
let allPhotos = []
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
    isAlbumOwner = !!user
  } catch (err) {
    isAlbumOwner = false
  }
}

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
    const { error } = await supabase
      .from('albums')
      .update({ cover_photo_id: photoId })
      .eq('id', currentAlbumId)

    if (error) throw error

    coverPhotoId = photoId
    updateCoverIndicators()
  } catch (err) {
    console.error('Error setting cover:', err)
    alert('Failed to set cover photo')
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
  // Only allow drag select when clicking on empty grid space or with modifier key
  if (e.target.closest('.photo-tile') || !isAlbumOwner) return
  
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

async function deleteSelectedPhotos() {
  if (selectedPhotos.size === 0 || !isAlbumOwner) return

  const confirm = window.confirm(`Delete ${selectedPhotos.size} photo(s)? This cannot be undone.`)
  if (!confirm) return

  try {
    for (const photoId of selectedPhotos) {
      const photo = allPhotos.find(p => p.id === photoId)
      if (!photo) continue

      await supabase.storage.from('photos').remove([photo.file_path])
      await supabase.from('photos').delete().eq('id', photoId)
    }

    selectedPhotos.clear()
    loadAlbum()
  } catch (err) {
    console.error('Delete error:', err)
    alert(`Failed to delete photos: ${err.message}`)
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
  try {
    for (const photoId of selectedPhotos) {
      await supabase
        .from('photos')
        .update({ album_id: targetAlbumId })
        .eq('id', photoId)
    }

    moveModal.classList.remove('show')
    selectedPhotos.clear()
    alert(`Moved ${selectedPhotos.size} photo(s) to "${targetAlbumName}"`)
    loadAlbum()
  } catch (err) {
    console.error('Move error:', err)
    alert(`Failed to move photos: ${err.message}`)
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
    
    if (albumData?.music_url) {
      musicUrlInput.value = albumData.music_url
    } else {
      musicUrlInput.value = ''
    }
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
    const { error } = await supabase
      .from('albums')
      .update({ music_url: musicUrl || null })
      .eq('id', currentAlbumId)

    if (error) throw error

    showToast(musicUrl ? '✓ Music URL saved!' : '✓ Music removed.')
    updateMusicBadge(musicUrl ? true : false)
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

function updateMusicBadge(hasMusic) {
  const badge = document.getElementById('music-badge')
  if (badge) {
    badge.style.display = hasMusic ? 'inline-block' : 'none'
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

  // Show/hide music button based on ownership
  if (musicBtnEl) {
    musicBtnEl.style.display = isAlbumOwner ? 'inline-block' : 'none'
  }

  // Set upload link
  uploadBtnEl.href = `/upload.html?album=${encodeURIComponent(currentAlbumId)}`
  
  // Set slideshow link
  slideshowBtnEl.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`

  try {
    // Fetch album data including cover_photo_id
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('name, cover_photo_id')
      .eq('id', currentAlbumId)
      .limit(1)
      .single()

    if (albumError) throw albumError

    if (albumData?.name) {
      albumNameEl.textContent = albumData.name
    }
    
    if (albumData?.cover_photo_id) {
      coverPhotoId = albumData.cover_photo_id
    }

    // Fetch photos for this album
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, file_path, created_at')
      .eq('album_id', currentAlbumId)
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

      const img = document.createElement('img')
      img.src = publicUrl
      img.alt = `Photo from album`
      img.loading = 'lazy'
      img.width = 600
      img.height = 400

      tile.appendChild(img)

      // Add checkbox for selection
      if (isAlbumOwner) {
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'photo-checkbox'
        checkbox.addEventListener('change', () => togglePhotoSelection(photo.id))
        
        // Also allow Ctrl/Cmd+click on tile to toggle selection
        tile.addEventListener('click', (e) => {
          if ((e.ctrlKey || e.metaKey) && !e.target.closest('button')) {
            e.preventDefault()
            checkbox.checked = !checkbox.checked
            togglePhotoSelection(photo.id)
          }
        })
        
        tile.appendChild(checkbox)
      }

      // Add cover and delete controls if user is owner
      if (isAlbumOwner) {
        const controls = document.createElement('div')
        controls.className = 'photo-controls'

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
                await supabase.storage.from('photos').remove([photoToDelete.file_path])
                await supabase.from('photos').delete().eq('id', photo.id)
                loadAlbum()
              }
            } catch (err) {
              alert(`Failed to delete: ${err.message}`)
            }
          }
        })

        controls.appendChild(setCoverBtn)
        controls.appendChild(deleteBtn)
        tile.appendChild(controls)
      }

      // Mark if this is the cover
      if (photo.id === coverPhotoId) {
        tile.classList.add('is-cover')
      }

      photosGridEl.appendChild(tile)
    })
  } catch (err) {
    console.error('Load album error:', err)
    emptyStateEl.textContent = `Error loading album: ${err.message}`
    emptyStateEl.style.display = 'block'
  }
}

document.addEventListener('DOMContentLoaded', loadAlbum)

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
