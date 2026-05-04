import { updatePhoto } from '../../services/photoService.js'

export function createDragReorderController({
  photosGridEl,
  showToast,
} = {}) {
  let dragSrcId = null

  function initDragAndDrop() {
    document.querySelectorAll('.photo-tile[draggable]').forEach(tile => {
      tile.addEventListener('dragstart', onDragStart)
      tile.addEventListener('dragover', onDragOver)
      tile.addEventListener('dragleave', onDragLeave)
      tile.addEventListener('drop', onDrop)
      tile.addEventListener('dragend', onDragEnd)
    })
  }

  function onDragStart(e) {
    dragSrcId = this.dataset.photoId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', dragSrcId)
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
          updatePhoto(tile.dataset.photoId, { sort_order: idx })
        )
      )
      showToast('✓ Order saved')
    } catch (err) {
      showToast('Failed to save order: ' + err.message, true)
    }
  }

  return {
    initDragAndDrop,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    savePhotoOrder,
  }
}
