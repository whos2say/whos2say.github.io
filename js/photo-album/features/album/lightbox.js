import { isVideoPath } from '../../utils/media.js'

export function createLightboxController({
  state,
  elements,
  getPublicUrl,
  loadComments,
  trackPhotoView,
  downloadPhoto,
  getCropState,
  closeCropModal,
  reopenLightboxAfterCrop,
} = {}) {
  const lightboxState = {
    photoId: null,
    url: null,
    filePath: null,
    index: -1,
    enhanceFilter: 'brightness(1.5) contrast(1.15) saturate(1.05)',
  }

  function openLightbox(url, photoId, filePath, index) {
    const isVideo = isVideoPath(filePath || url)
    if (isVideo) {
      elements.img.style.display = 'none'
      elements.img.src = ''
      elements.video.style.display = 'block'
      elements.video.src = url
      elements.video.load()
    } else {
      elements.video.style.display = 'none'
      elements.video.src = ''
      elements.img.style.filter = ''
      elements.img.crossOrigin = 'anonymous'
      elements.img.style.display = 'block'
      elements.img.src = url
    }

    if (elements.enhanceBtn) {
      elements.enhanceBtn.classList.remove('active')
      const sourceTile = elements.photosGrid?.querySelector(`[data-photo-id="${photoId}"]`)
      const tileIsDark = !isVideo && sourceTile?.dataset.isDark === 'true'
      elements.enhanceBtn.style.display = tileIsDark ? 'block' : 'none'
      if (tileIsDark) {
        const bv = parseInt(sourceTile.dataset.brightness || '128', 10)
        const isMobile = window.matchMedia('(pointer: coarse)').matches
        const darkThreshold = isMobile ? 85 : 60
        lightboxState.enhanceFilter = bv < darkThreshold
          ? 'brightness(1.5) contrast(1.15) saturate(1.05)'
          : 'brightness(1.25) contrast(1.08)'
        const offLabel = bv < darkThreshold ? '✨ Enhance' : '☀ Brighten'
        elements.enhanceBtn.textContent = offLabel
        elements.enhanceBtn.dataset.label = offLabel
      }
    }

    elements.lightbox.classList.add('show')
    document.body.style.overflow = 'hidden'
    lightboxState.photoId = photoId || null
    lightboxState.url = url || null
    lightboxState.filePath = filePath || null
    lightboxState.index = (index !== undefined) ? index : state.allPhotos.findIndex(p => p.id === photoId)
    updateLightboxNavVisibility()

    const lbCropBtn = document.getElementById('lightbox-crop-btn')
    if (lbCropBtn) {
      lbCropBtn.style.display = (state.currentUser && !isVideo) ? 'inline-flex' : 'none'
    }
    if (photoId) loadComments(photoId)
    trackPhotoView(state.currentAlbumId, lightboxState.index, state.allPhotos.length)
  }

  function closeLightbox() {
    elements.lightbox.classList.remove('show')
    document.body.style.overflow = ''
    elements.img.src = ''
    elements.video.pause()
    elements.video.src = ''
    lightboxState.photoId = null
    lightboxState.url = null
    lightboxState.filePath = null
    lightboxState.index = -1
    const lbCropBtn = document.getElementById('lightbox-crop-btn')
    if (lbCropBtn) lbCropBtn.style.display = 'none'
  }

  function updateLightboxNavVisibility() {
    const prevBtn = document.getElementById('lightbox-prev')
    const nextBtn = document.getElementById('lightbox-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.style.display = (lightboxState.index > 0) ? '' : 'none'
    nextBtn.style.display = (lightboxState.index < state.allPhotos.length - 1) ? '' : 'none'
  }

  function navigateLightbox(delta) {
    if (!elements.lightbox.classList.contains('show') || state.allPhotos.length === 0) return
    const next = lightboxState.index + delta
    if (next < 0 || next >= state.allPhotos.length) return
    const photo = state.allPhotos[next]
    openLightbox(getPublicUrl(photo.file_path), photo.id, photo.file_path, next)
  }

  function bindLightboxEvents() {
    elements.closeBtn.addEventListener('click', closeLightbox)
    elements.lightbox.addEventListener('click', e => {
      if (e.target === elements.lightbox) closeLightbox()
    })

    if (elements.enhanceBtn) {
      elements.enhanceBtn.addEventListener('click', () => {
        const isActive = elements.enhanceBtn.classList.toggle('active')
        elements.img.style.filter = isActive ? lightboxState.enhanceFilter : ''
        elements.enhanceBtn.textContent = isActive
          ? '↩ Original'
          : elements.enhanceBtn.dataset.label || '✨ Enhance'
      })
    }

    if (elements.downloadBtn) {
      elements.downloadBtn.addEventListener('click', () => {
        if (!lightboxState.url) return
        const filename = lightboxState.filePath
          ? lightboxState.filePath.split('/').pop()
          : 'photo'
        downloadPhoto(lightboxState.url, filename)
      })
    }

    document.addEventListener('keydown', e => {
      const cropState = getCropState?.()
      if (cropState?.isOpen) {
        if (e.key === 'Escape') {
          const idx = cropState.photoIndex
          closeCropModal()
          if (idx >= 0) reopenLightboxAfterCrop(idx)
        }
        return
      }
      if (!elements.lightbox.classList.contains('show')) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') navigateLightbox(-1)
      if (e.key === 'ArrowRight') navigateLightbox(1)
    })

    let touchStartX = 0
    elements.lightbox.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX
    }, { passive: true })
    elements.lightbox.addEventListener('touchend', e => {
      const dx = touchStartX - e.changedTouches[0].clientX
      if (Math.abs(dx) > 48) navigateLightbox(dx > 0 ? 1 : -1)
    }, { passive: true })

    const prevBtn = document.getElementById('lightbox-prev')
    const nextBtn = document.getElementById('lightbox-next')
    if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); navigateLightbox(-1) })
    if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); navigateLightbox(1) })
  }

  return {
    openLightbox,
    closeLightbox,
    navigateLightbox,
    updateLightboxNavVisibility,
    bindLightboxEvents,
    getCurrentPhotoId: () => lightboxState.photoId,
    getCurrentIndex: () => lightboxState.index,
  }
}
