export function createCropController({
  state,
  elements,
  getPublicUrl,
  uploadFile,
  removeFiles,
  createPhoto,
  openLightbox,
  closeLightbox,
  getLightboxCurrentIndex,
  showToast,
  reloadAlbum,
}) {
  const {
    cropModal,
    cropImg,
    cropSaveBtn,
    cropCancelBtn,
    cropStatus,
    cropRatios,
    lightboxCropBtn,
  } = elements

  let cropperInstance = null
  let cropPhotoIndex = -1
  let cropPhotoId = null
  let cropPhotoFilePath = null
  let cropPhotoUrl = null

  function setCropStatus(msg, isError = false) {
    if (!cropStatus) return
    if (!msg) { cropStatus.style.display = 'none'; return }
    cropStatus.textContent = msg
    cropStatus.className = 'crop-status' + (isError ? ' crop-status-error' : ' crop-status-success')
    cropStatus.style.display = 'block'
  }

  function openCropModal(index) {
    if (!cropModal || !cropImg) return
    const photo = state.getAllPhotos()[index]
    if (!photo) return
    cropPhotoIndex = index
    cropPhotoId = photo.id
    cropPhotoFilePath = photo.file_path
    cropPhotoUrl = getPublicUrl(photo.file_path)

    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
    setCropStatus('')
    if (cropSaveBtn) { cropSaveBtn.disabled = false; cropSaveBtn.textContent = 'Save Copy' }

    if (cropRatios) {
      cropRatios.querySelectorAll('.crop-ratio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ratio === 'free')
      })
    }

    cropImg.src = ''
    cropModal.classList.add('show')
    document.body.style.overflow = 'hidden'

    fetch(cropPhotoUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch image: ' + res.status)
        return res.blob()
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        cropImg.removeAttribute('crossorigin')
        const initCropper = () => {
          if (typeof Cropper === 'undefined') {
            setCropStatus('Cropper library failed to load. Check your connection and reload.', true)
            return
          }
          if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
          try {
            cropperInstance = new Cropper(cropImg, {
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
        cropImg.addEventListener('load', initCropper, { once: true })
        cropImg.addEventListener('error', () => {
          setCropStatus('Could not load image for cropping.', true)
        }, { once: true })
        cropImg.src = blobUrl
      })
      .catch(err => {
        console.error('Crop image fetch error:', err)
        setCropStatus('Could not load image for cropping. Try again.', true)
      })
  }

  function closeCropModal() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
    if (cropModal) cropModal.classList.remove('show')
    document.body.style.overflow = ''
    if (cropImg) {
      if (cropImg.src && cropImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(cropImg.src)
      }
      cropImg.src = ''
    }
  }

  function reopenLightboxAfterCrop(index) {
    const photo = state.getAllPhotos()[index]
    if (!photo) return
    const url = getPublicUrl(photo.file_path)
    openLightbox(url, photo.id, photo.file_path, index)
  }

  function getCropState() {
    return {
      isOpen: cropModal && cropModal.classList.contains('show'),
      photoIndex: cropPhotoIndex,
    }
  }

  function bindEvents() {
    if (lightboxCropBtn) {
      lightboxCropBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!state.getCurrentUser()) { showToast('Sign in to crop photos.'); return }
        const idx = getLightboxCurrentIndex()
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

    if (cropModal) {
      cropModal.addEventListener('click', (e) => {
        if (e.target === cropModal) {
          const idx = cropPhotoIndex
          closeCropModal()
          if (idx >= 0) reopenLightboxAfterCrop(idx)
        }
      })
    }

    if (cropRatios) {
      cropRatios.addEventListener('click', (e) => {
        const btn = e.target.closest('.crop-ratio-btn')
        if (!btn || !cropperInstance) return
        cropRatios.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const parts = btn.dataset.ratio.split(':')
        const ratio = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : NaN
        cropperInstance.setAspectRatio(ratio)
      })
    }

    if (cropSaveBtn) {
      cropSaveBtn.addEventListener('click', async () => {
        const currentUser = state.getCurrentUser()
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
          const croppedPath = `${state.getCurrentAlbumId()}/${Date.now()}-crop-${baseName}.${saveExt}`

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
            album_id: state.getCurrentAlbumId(),
            file_path: croppedPath,
            uploaded_by: currentUser.id,
          })
          if (dbError) {
            await removeFiles([croppedPath])
            setCropStatus('Failed to save photo record: ' + dbError.message, true)
            cropSaveBtn.disabled = false
            cropSaveBtn.textContent = 'Save Copy'
            return
          }

          closeCropModal()
          showToast('Cropped copy saved.')
          await reloadAlbum()
        }, mimeType, quality)
      })
    }
  }

  return {
    bindEvents,
    openCropModal,
    closeCropModal,
    reopenLightboxAfterCrop,
    getCropState,
  }
}
