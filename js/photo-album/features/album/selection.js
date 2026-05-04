export function createSelectionController({
  state,
  elements,
  dragSelectArea,
} = {}) {
  let isDraggingSelect = false
  let dragStartX = 0
  let dragStartY = 0

  function togglePhotoSelection(photoId) {
    if (state.selectedPhotos.has(photoId)) {
      state.selectedPhotos.delete(photoId)
    } else {
      state.selectedPhotos.add(photoId)
    }
    updateSelectionUI()
  }

  function selectPhotosInRect(startX, startY, endX, endY) {
    const rect = {
      left: Math.min(startX, endX),
      right: Math.max(startX, endX),
      top: Math.min(startY, endY),
      bottom: Math.max(startY, endY),
    }

    document.querySelectorAll('.photo-tile').forEach(tile => {
      const tileRect = tile.getBoundingClientRect()
      if (tileRect.left < rect.right &&
          tileRect.right > rect.left &&
          tileRect.top < rect.bottom &&
          tileRect.bottom > rect.top) {
        const photoId = tile.dataset.photoId
        state.selectedPhotos.add(photoId)
      }
    })
  }

  function startDragSelect(e) {
    if (e.target.closest('.photo-tile')) return

    isDraggingSelect = true
    dragStartX = e.clientX
    dragStartY = e.clientY

    dragSelectArea.classList.add('active')
    dragSelectArea.style.left = dragStartX + 'px'
    dragSelectArea.style.top = dragStartY + 'px'
    dragSelectArea.style.width = '0'
    dragSelectArea.style.height = '0'

    elements.photosGrid.classList.add('drag-selecting')
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
    elements.photosGrid.classList.remove('drag-selecting')

    selectPhotosInRect(dragStartX, dragStartY, e.clientX, e.clientY)
    updateSelectionUI()
  }

  function updateSelectionUI() {
    const count = state.selectedPhotos.size
    elements.selectionCount.textContent = `${count} photo${count !== 1 ? 's' : ''} selected`

    if (count > 0) {
      elements.bulkActionsBar.classList.add('show')
    } else {
      elements.bulkActionsBar.classList.remove('show')
    }

    if (elements.bulkDeleteBtn) elements.bulkDeleteBtn.style.display = state.isAlbumOwner ? '' : 'none'
    if (elements.bulkMoveBtn) elements.bulkMoveBtn.style.display = state.isAlbumOwner ? '' : 'none'

    document.querySelectorAll('.photo-checkbox').forEach(checkbox => {
      const photoId = checkbox.closest('.photo-tile')?.dataset.photoId
      if (photoId && state.selectedPhotos.has(photoId)) {
        checkbox.checked = true
      } else if (photoId) {
        checkbox.checked = false
      }
    })

    document.querySelectorAll('.photo-tile').forEach(tile => {
      const photoId = tile.dataset.photoId
      if (state.selectedPhotos.has(photoId)) {
        tile.classList.add('selected')
      } else {
        tile.classList.remove('selected')
      }
    })
  }

  function bindDragSelect() {
    if (!elements.photosGrid) return
    elements.photosGrid.addEventListener('mousedown', startDragSelect)
    document.addEventListener('mousemove', updateDragSelect)
    document.addEventListener('mouseup', endDragSelect)
  }

  return {
    togglePhotoSelection,
    selectPhotosInRect,
    startDragSelect,
    updateDragSelect,
    endDragSelect,
    updateSelectionUI,
    bindDragSelect,
  }
}
