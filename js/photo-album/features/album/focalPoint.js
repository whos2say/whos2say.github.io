import { updatePhoto } from '../../services/photoService.js'

export function createFocalPointController({
  showToast,
} = {}) {
  let repositionPhotoId = null
  let repositionFocalPoint = { x: 50, y: 50 }

  function openRepositionModal(photoId, publicUrl, currentFocalPoint) {
    repositionPhotoId = photoId
    const modal = document.getElementById('reposition-modal')
    const img = document.getElementById('reposition-img')
    if (!modal || !img) return

    const parts = (currentFocalPoint || '50% 50%').match(/([\d.]+)%\s*([\d.]+)%/)
    repositionFocalPoint = {
      x: parts ? parseFloat(parts[1]) : 50,
      y: parts ? parseFloat(parts[2]) : 50,
    }

    img.onload = () => updateRepositionCrosshair()
    img.src = publicUrl
    if (img.complete && img.naturalWidth) updateRepositionCrosshair()
    modal.classList.add('show')
  }

  function updateRepositionCrosshair() {
    const crosshair = document.getElementById('reposition-crosshair')
    const wrap = document.getElementById('reposition-image-wrap')
    const img = document.getElementById('reposition-img')
    if (!crosshair || !wrap || !img) return

    const wrapRect = wrap.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()

    const x = (imgRect.left - wrapRect.left) + (imgRect.width * repositionFocalPoint.x / 100)
    const y = (imgRect.top - wrapRect.top) + (imgRect.height * repositionFocalPoint.y / 100)

    crosshair.style.left = x + 'px'
    crosshair.style.top = y + 'px'
    crosshair.style.display = 'block'
  }

  function closeRepositionModal() {
    const modal = document.getElementById('reposition-modal')
    if (modal) modal.classList.remove('show')
    repositionPhotoId = null
  }

  async function saveRepositionFocalPoint() {
    if (!repositionPhotoId) return
    const focalPointStr = `${repositionFocalPoint.x.toFixed(1)}% ${repositionFocalPoint.y.toFixed(1)}%`
    try {
      const { error } = await updatePhoto(repositionPhotoId, { focal_point: focalPointStr })
      if (error) throw error

      const tile = document.querySelector(`[data-photo-id="${repositionPhotoId}"]`)
      if (tile) {
        const tileImg = tile.querySelector('img')
        if (tileImg) tileImg.style.objectPosition = focalPointStr
      }

      showToast('✓ Focal point saved')
      closeRepositionModal()
    } catch (err) {
      showToast('Failed to save: ' + err.message, true)
    }
  }

  function handleRepositionImageClick(e) {
    const wrap = document.getElementById('reposition-image-wrap')
    const img = document.getElementById('reposition-img')
    if (!wrap || !img) return
    const imgRect = img.getBoundingClientRect()
    const clampedX = Math.max(imgRect.left, Math.min(e.clientX, imgRect.right))
    const clampedY = Math.max(imgRect.top, Math.min(e.clientY, imgRect.bottom))
    repositionFocalPoint = {
      x: parseFloat(((clampedX - imgRect.left) / imgRect.width * 100).toFixed(1)),
      y: parseFloat(((clampedY - imgRect.top) / imgRect.height * 100).toFixed(1)),
    }
    updateRepositionCrosshair()
  }

  return {
    openRepositionModal,
    updateRepositionCrosshair,
    closeRepositionModal,
    saveRepositionFocalPoint,
    handleRepositionImageClick,
  }
}
