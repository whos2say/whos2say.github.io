import { isVideoPath } from '../../utils/media.js'

export function createPhotoGridController({
  state,
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
} = {}) {
  function updateCoverIndicators() {
    document.querySelectorAll('.photo-tile').forEach(tile => {
      const photoId = tile.dataset.photoId
      if (photoId === state.coverPhotoId) {
        tile.classList.add('is-cover')
      } else {
        tile.classList.remove('is-cover')
      }
    })
  }

  function renderPhotos(photos) {
    photos.forEach((photo, idx) => {
      const publicUrl = getPublicUrl(photo.file_path)
      const tile = buildPhotoTile(photo, idx, publicUrl)
      photosGridEl.appendChild(tile)
    })
  }

  function buildPhotoTile(photo, idx, publicUrl) {
    const tile = document.createElement('div')
    tile.className = 'photo-tile'
    tile.dataset.photoId = photo.id
    tile.style.animationDelay = `${idx * 0.05}s`

    const isVid = isVideoPath(photo.file_path)
    const media = isVid
      ? buildVideoMedia(photo, publicUrl, tile)
      : buildImageMedia(photo, idx, publicUrl, tile)

    media.draggable = false
    media.addEventListener('click', () => openLightbox(publicUrl, photo.id, photo.file_path, idx))
    tile.appendChild(media)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'photo-checkbox'
    checkbox.addEventListener('change', () => togglePhotoSelection(photo.id))

    tile.addEventListener('click', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.target.closest('button')) {
        e.preventDefault()
        checkbox.checked = !checkbox.checked
        togglePhotoSelection(photo.id)
      }
    })

    tile.appendChild(checkbox)

    const controls = buildPhotoControls(photo, publicUrl)
    tile.appendChild(controls)

    if (!isVid) {
      addDarkPhotoDetection({ tile, media, controls, idx })
    }

    if (state.isAlbumOwner) {
      tile.draggable = true
      const handle = document.createElement('div')
      handle.className = 'drag-handle'
      handle.title = 'Drag to reorder'
      handle.textContent = '⠿'
      tile.appendChild(handle)
    }

    if (photo.id === state.coverPhotoId) {
      tile.classList.add('is-cover')
    }

    return tile
  }

  function buildVideoMedia(photo, publicUrl, tile) {
    const media = document.createElement('video')
    media.src = publicUrl
    media.muted = true
    media.playsInline = true
    media.loop = true
    media.preload = 'metadata'
    media.style.cursor = 'pointer'
    if (window.matchMedia('(hover: none)').matches) {
      media.autoplay = true
    } else {
      media.addEventListener('mouseenter', () => media.play())
      media.addEventListener('mouseleave', () => { media.pause(); media.currentTime = 0 })
    }

    const badge = document.createElement('span')
    badge.className = 'video-badge'
    badge.textContent = '▶ Video'
    tile.appendChild(badge)
    return media
  }

  function buildImageMedia(photo, idx, publicUrl, tile) {
    const media = document.createElement('img')
    media.crossOrigin = 'anonymous'
    media.src = publicUrl
    media.alt = 'Photo from album'
    media.loading = 'lazy'
    media.width = 600
    media.height = 400
    media.style.objectPosition = photo.focal_point || '50% 50%'
    media.style.cursor = 'zoom-in'

    const darkBadge = document.createElement('div')
    darkBadge.className = 'dark-badge'
    darkBadge.innerHTML = '🌙 Dark'
    darkBadge.style.display = 'none'
    tile.appendChild(darkBadge)

    const enhancedBadge = document.createElement('div')
    enhancedBadge.className = 'enhanced-badge'
    enhancedBadge.innerHTML = '✨ Enhanced'
    tile.appendChild(enhancedBadge)
    return media
  }

  function addDarkPhotoDetection({ tile, media, controls, idx }) {
    const darkBadge = tile.querySelector('.dark-badge')
    analyzeImageBrightness(media).then(brightness => {
      const isMobile = window.matchMedia('(pointer: coarse)').matches
      const darkThreshold = isMobile ? 85 : 60
      const dimThreshold = isMobile ? 110 : 85

      console.log(
        `[brightness] Photo ${idx + 1}: ${Math.round(brightness)}/255` +
        ` | thresholds: dark<${darkThreshold} dim<${dimThreshold}` +
        ` | ${isMobile ? 'mobile' : 'desktop'}` +
        (brightness < darkThreshold ? ' → DARK' : brightness < dimThreshold ? ' → DIM' : ' → OK')
      )

      tile.dataset.brightness = Math.round(brightness)

      if (brightness < dimThreshold) {
        const isDark = brightness < darkThreshold
        tile.dataset.isDark = 'true'

        darkBadge.innerHTML = isDark ? '🌙 Dark' : '🌤 Dim'
        darkBadge.style.display = 'flex'
        if (!isDark) {
          darkBadge.style.color = '#ffa94d'
          darkBadge.style.borderColor = 'rgba(255, 169, 77, 0.3)'
        }

        const enhanceFilter = isDark
          ? 'brightness(1.5) contrast(1.15) saturate(1.05)'
          : 'brightness(1.25) contrast(1.08)'

        const enhanceBtn = document.createElement('button')
        enhanceBtn.className = 'photo-btn enhance-photo'
        enhanceBtn.textContent = isDark ? '✨ Enhance' : '☀ Brighten'
        enhanceBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (tile.classList.contains('enhanced')) {
            tile.classList.remove('enhanced')
            media.style.filter = ''
            enhanceBtn.textContent = isDark ? '✨ Enhance' : '☀ Brighten'
            enhanceBtn.className = 'photo-btn enhance-photo'
          } else {
            tile.classList.add('enhanced')
            media.style.filter = enhanceFilter
            enhanceBtn.textContent = '↩ Original'
            enhanceBtn.className = 'photo-btn unenhance-photo'
          }
        })
        controls.appendChild(enhanceBtn)

        if (isMobile && isDark) {
          tile.classList.add('enhanced')
          media.style.filter = enhanceFilter
          enhanceBtn.textContent = '↩ Original'
          enhanceBtn.className = 'photo-btn unenhance-photo'
        }
      }
    })
  }

  function buildPhotoControls(photo, publicUrl) {
    const controls = document.createElement('div')
    controls.className = state.isAlbumOwner ? 'photo-controls full-width' : 'photo-controls'

    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'photo-btn download-photo'
    downloadBtn.textContent = '⬇ Save'
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const filename = photo.file_path.split('/').pop()
      downloadPhoto(publicUrl, filename)
    })
    controls.appendChild(downloadBtn)

    if (state.isAlbumOwner) {
      const setCoverBtn = document.createElement('button')
      setCoverBtn.className = 'photo-btn set-cover'
      setCoverBtn.textContent = photo.id === state.coverPhotoId ? '★ Cover' : 'Set Cover'
      setCoverBtn.addEventListener('click', () => setCoverPhoto(photo.id))

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'photo-btn delete-photo'
      deleteBtn.textContent = '🗑 Delete'
      deleteBtn.addEventListener('click', async () => {
        const confirmed = window.confirm('Delete this photo?')
        if (confirmed) {
          try {
            const photoToDelete = state.allPhotos.find(p => p.id === photo.id)
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

      const repositionBtn = document.createElement('button')
      repositionBtn.className = 'photo-btn reposition-photo'
      repositionBtn.textContent = '⊹ Reposition'
      repositionBtn.title = 'Set focal point for cropping'
      repositionBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        openRepositionModal(photo.id, publicUrl, photo.focal_point)
      })

      controls.appendChild(setCoverBtn)
      controls.appendChild(deleteBtn)
      controls.appendChild(repositionBtn)
    }

    return controls
  }

  return {
    renderPhotos,
    buildPhotoTile,
    updateCoverIndicators,
  }
}
