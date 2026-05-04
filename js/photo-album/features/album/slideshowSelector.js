export function createSlideshowSelectorController({
  getCurrentAlbumId,
  getAllPhotos,
  getAlbumName,
  getPublicUrl,
  showToast,
  trackSlideshowStart,
  elements,
}) {
  const {
    slideshowBtn,
    modal,
    grid,
    selectedCount,
    startBtn,
    hint,
    selectAllBtn,
    clearAllBtn,
    saveBtn,
    closeBtn,
    cancelBtn,
  } = elements

  let ssSelectedPhotos = new Set()
  let ssSortedPhotos = []
  let ssLastClickedIdx = -1
  let ssDragSrcIdx = null

  function getSlideshowConfigKey() {
    return `ss_config_${getCurrentAlbumId()}`
  }

  function loadSlideshowConfig() {
    try {
      const raw = localStorage.getItem(getSlideshowConfigKey())
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function saveConfig() {
    const currentAlbumId = getCurrentAlbumId()
    if (!currentAlbumId) return
    const orderedIds = ssSortedPhotos.map(p => p.id)
    const excludedIds = ssSortedPhotos.filter(p => !ssSelectedPhotos.has(p.id)).map(p => p.id)
    try {
      localStorage.setItem(getSlideshowConfigKey(), JSON.stringify({ orderedIds, excludedIds }))
      showToast(`💾 Slideshow saved — ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} photos`)
      if (hint) hint.textContent = `✓ Saved · ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} included · Shift+click range · Drag to reorder`
    } catch (e) {
      showToast('Save failed: ' + e.message, true)
    }
  }

  function updateSSCount() {
    const total = ssSortedPhotos.length || getAllPhotos().length
    const selected = ssSelectedPhotos.size
    if (selectedCount) selectedCount.textContent = selected === total ? `All ${total} selected` : `${selected} of ${total} selected`
    if (startBtn) startBtn.disabled = selected === 0
  }

  function openSelector() {
    const currentAlbumId = getCurrentAlbumId()
    const allPhotos = getAllPhotos()
    if (allPhotos.length === 0) {
      window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
      return
    }

    if (!modal || !grid) return

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

      thumb.addEventListener('click', (e) => {
        const thumbs = [...grid.querySelectorAll('.ss-thumb')]
        const thisIdx = thumbs.indexOf(thumb)

        if (e.shiftKey && ssLastClickedIdx >= 0) {
          const anchorId = thumbs[ssLastClickedIdx]?.dataset.photoId
          const targetIncluded = ssSelectedPhotos.has(anchorId)
          const start = Math.min(ssLastClickedIdx, thisIdx)
          const end = Math.max(ssLastClickedIdx, thisIdx)
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
        const byId = Object.fromEntries(getAllPhotos().map(p => [p.id, p]))
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

    if (hint) {
      if (savedConfig) {
        hint.textContent = `✓ Saved · ${ssSelectedPhotos.size} of ${ssSortedPhotos.length} included · Shift+click range · Drag to reorder`
      } else {
        hint.textContent = 'Click to include/exclude · Shift+click for range · Drag to reorder'
      }
    }

    modal.classList.add('show')
  }

  function startSlideshow() {
    const currentAlbumId = getCurrentAlbumId()
    if (!currentAlbumId) return
    if (modal) modal.classList.remove('show')

    const allPhotos = getAllPhotos()
    const includedInOrder = ssSortedPhotos.filter(p => ssSelectedPhotos.has(p.id))
    if (includedInOrder.length === 0) {
      showToast('No photos selected', true)
      return
    }

    const isDefault = includedInOrder.length === allPhotos.length &&
      ssSortedPhotos.map(p => p.id).join() === allPhotos.map(p => p.id).join()

    trackSlideshowStart(currentAlbumId, getAlbumName(), includedInOrder.length)

    if (isDefault) {
      window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}`
    } else {
      const ids = includedInOrder.map(p => p.id).join(',')
      window.location.href = `/slideshow.html?album=${encodeURIComponent(currentAlbumId)}&photos=${encodeURIComponent(ids)}`
    }
  }

  function bindEvents() {
    if (slideshowBtn) {
      slideshowBtn.addEventListener('click', e => {
        e.preventDefault()
        openSelector()
      })
    }

    selectAllBtn?.addEventListener('click', () => {
      ssSelectedPhotos = new Set(ssSortedPhotos.map(p => p.id))
      grid?.querySelectorAll('.ss-thumb').forEach(t => {
        t.classList.add('selected')
        t.classList.remove('ss-excluded')
      })
      ssLastClickedIdx = -1
      updateSSCount()
    })
    clearAllBtn?.addEventListener('click', () => {
      ssSelectedPhotos.clear()
      grid?.querySelectorAll('.ss-thumb').forEach(t => {
        t.classList.remove('selected')
        t.classList.add('ss-excluded')
      })
      ssLastClickedIdx = -1
      updateSSCount()
    })
    saveBtn?.addEventListener('click', saveConfig)
    closeBtn?.addEventListener('click', () => {
      modal?.classList.remove('show')
    })
    cancelBtn?.addEventListener('click', () => {
      modal?.classList.remove('show')
    })
    startBtn?.addEventListener('click', startSlideshow)
    modal?.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('show')
    })
  }

  return {
    bindEvents,
    openSelector,
    saveConfig,
    startSlideshow,
  }
}
