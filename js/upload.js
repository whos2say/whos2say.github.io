import { supabase } from './supabase.js'

const dropAreaEl = document.getElementById('drop-area')
const fileInputEl = document.getElementById('file-input')
const uploadStatusEl = document.getElementById('upload-status')
const albumIdDisplayEl = document.getElementById('album-id-display')

function getAlbumId() {
  return new URLSearchParams(window.location.search).get('album') || 
         new URLSearchParams(window.location.search).get('id')
}

async function checkAuth() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Redirect to login with return URL
      const currentUrl = window.location.pathname + window.location.search
      window.location.href = `/login.html?redirect=${encodeURIComponent(currentUrl)}`
    }
  } catch (err) {
    console.error('Auth check error:', err)
    window.location.href = '/login.html'
  }
}

function resizeImage(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (file.type && !file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.naturalWidth
        let height = img.naturalHeight
        const ratio = width / height

        if (width > maxDimension || height > maxDimension) {
          if (ratio > 1) {
            width = maxDimension
            height = Math.round(maxDimension / ratio)
          } else {
            height = maxDimension
            width = Math.round(maxDimension * ratio)
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('Image resize failed'))
          else resolve(blob)
        }, 'image/jpeg', quality)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

const VIDEO_MAX_BYTES = 200 * 1024 * 1024  // 200 MB
const VIDEO_MAX_SECONDS = 30

function isVideoFile(file) {
  return file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v)$/i.test(file.name)
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read video metadata')) }
    v.src = url
  })
}

function getOriginalDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url) }
    img.src = url
  })
}

async function handleGooglePhotosClick() {
  const btn = document.getElementById('google-photos-btn')
  const statusEl = document.getElementById('google-photos-status')
  const setupNote = document.getElementById('google-setup-note')

  try {
    const { openGooglePhotosPicker } = await import('./google-photos.js')
    btn.disabled = true
    statusEl.style.display = 'block'
    statusEl.textContent = 'Opening Google Photos…'

    await openGooglePhotosPicker(
      async (blobs, failedVideos) => {
        // Upload photos that downloaded successfully
        if (blobs.length > 0) {
          statusEl.textContent = `Importing ${blobs.length} photo(s)…`
          const fileList = blobs.map(b => new File([b.blob], b.name, { type: b.mimeType || 'image/jpeg' }))
          await handleFiles(fileList)
        }
        statusEl.style.display = 'none'

        // Show manual download links for videos (browser CORS blocks direct import)
        if (failedVideos?.length > 0) {
          const notice = document.createElement('div')
          notice.style.cssText = 'margin-top:1rem;padding:1rem;border:1px solid #f59e0b;border-radius:6px;background:color-mix(in srgb,#f59e0b 8%,transparent)'
          notice.innerHTML = `
            <p style="font-family:var(--font-body);font-weight:700;color:#f59e0b;margin:0 0 0.5rem">
              ⚠ ${failedVideos.length} video(s) need a manual step
            </p>
            <p style="font-family:var(--font-body);font-size:0.82rem;color:var(--text-muted);margin:0 0 0.75rem">
              Browser security prevents direct video import from Google Photos.
              Click each link to download, then drag the file into the upload area above.
            </p>
            <div style="display:flex;flex-direction:column;gap:0.4rem">
              ${failedVideos.map(v => `
                <a href="${v.downloadUrl}" target="_blank" rel="noopener"
                   style="display:inline-flex;align-items:center;gap:0.4rem;color:#f59e0b;font-family:var(--font-body);font-size:0.85rem;font-weight:600;text-decoration:none">
                  ⬇ ${v.filename}
                </a>`).join('')}
            </div>
          `
          uploadStatusEl.appendChild(notice)
        }
      },
      (msg) => { statusEl.textContent = msg }
    )
  } catch (err) {
    console.error('Google Photos error:', err)
    statusEl.textContent = '⚠ ' + (err.message || 'Google Photos setup required')
    if (setupNote) setupNote.style.display = 'block'
  } finally {
    btn.disabled = false
  }
}

// Lazy-load the TinyFaceDetector model once on first upload
let faceApiReady = null
async function ensureFaceApi() {
  if (faceApiReady !== null) return faceApiReady
  faceApiReady = (async () => {
    if (!window.faceapi) return false
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
      )
      return true
    } catch (err) {
      console.warn('[face] model load failed:', err)
      return false
    }
  })()
  return faceApiReady
}

async function detectFocalPoint(blob) {
  const ready = await ensureFaceApi()
  if (!ready) return '50% 50%'
  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    bitmap.close()

    const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
    if (!detections.length) return '50% 50%'

    // Use the largest face as the focal point
    const primary = detections.reduce((a, b) =>
      a.box.width * a.box.height > b.box.width * b.box.height ? a : b
    )
    const cx = Math.round((primary.box.left + primary.box.width / 2) / canvas.width * 100)
    const cy = Math.round((primary.box.top + primary.box.height / 2) / canvas.height * 100)
    return `${cx}% ${cy}%`
  } catch (err) {
    console.warn('[face] detection error:', err)
    return '50% 50%'
  }
}

async function convertHeicToJpeg(file) {
  const lowerName = file.name.toLowerCase()
  const isHeic = file.type.includes('image/heic') || file.type.includes('image/heif') ||
                 lowerName.endsWith('.heic') || lowerName.endsWith('.heif')

  if (!isHeic) return file

  if (typeof window.heic2any === 'undefined') {
    throw new Error('HEIC conversion library not available. Try a different browser or convert the file first.')
  }

  const convertedBlobs = await window.heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.8
  })

  const blob = Array.isArray(convertedBlobs) ? convertedBlobs[0] : convertedBlobs
  return blob
}

async function handleFiles(files) {
  const albumId = getAlbumId()
  
  if (!files || files.length === 0) return

  const fileArray = Array.from(files)
  let uploadedCount = 0

  uploadStatusEl.innerHTML = ''

  for (const file of fileArray) {
    try {
      // Show processing state
      const fileItem = document.createElement('div')
      fileItem.className = 'upload-item'
      fileItem.innerHTML = `<span>${file.name}</span><span class="status">Processing...</span>`
      uploadStatusEl.appendChild(fileItem)

      const setStatus = (text, color) => {
        const s = fileItem.querySelector('.status')
        s.textContent = text
        if (color) s.style.color = color
      }

      // Validate album ID is UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(albumId)) throw new Error(`Invalid album ID: ${albumId}`)

      const { data: { user } } = await supabase.auth.getUser()
      let path, contentType, focalPoint = '50% 50%', previewEl

      if (isVideoFile(file)) {
        // ── VIDEO ──────────────────────────────────────────────
        if (file.size > VIDEO_MAX_BYTES) {
          throw new Error(`Video too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Max 200 MB.`)
        }
        const duration = await getVideoDuration(file)
        if (duration > VIDEO_MAX_SECONDS) {
          throw new Error(`Video is ${Math.ceil(duration)}s — max ${VIDEO_MAX_SECONDS} seconds.`)
        }

        contentType = file.type || 'video/mp4'
        const ext = file.name.match(/\.[^/.]+$/)?.[0]?.toLowerCase() || '.mp4'
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_').toLowerCase()
        path = `${albumId}/${Date.now()}_${baseName}${ext}`

        setStatus('Uploading…')
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType })
        if (uploadError) throw uploadError

        previewEl = document.createElement('video')
        previewEl.muted = true
        previewEl.playsInline = true
        previewEl.preload = 'metadata'
      } else {
        // ── IMAGE ──────────────────────────────────────────────
        let uploadFile = await convertHeicToJpeg(file)

        // Quality warning
        const dims = await getOriginalDimensions(uploadFile)
        const isLowRes = dims.width > 0 && (dims.width < 1280 || dims.height < 720)
        if (isLowRes) {
          const warn = document.createElement('span')
          warn.className = 'quality-warn'
          warn.title = `Original: ${dims.width}×${dims.height}px. May look soft full-screen.`
          warn.textContent = '⚠ Low res'
          fileItem.appendChild(warn)
        }

        let uploadBlob = uploadFile
        contentType = uploadFile.type || 'image/jpeg'
        if (uploadFile.type.startsWith('image/') || uploadFile.type === '') {
          uploadBlob = await resizeImage(uploadFile, 1600, 0.8)
          contentType = 'image/jpeg'
        }

        focalPoint = await detectFocalPoint(uploadBlob)

        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_').toLowerCase()
        const filename = contentType === 'image/jpeg' ? `${baseName}.jpg` : file.name
        path = `${albumId}/${Date.now()}_${filename}`

        setStatus('Uploading…')
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, uploadBlob, { cacheControl: '3600', upsert: false, contentType })
        if (uploadError) throw uploadError

        previewEl = document.createElement('img')
        previewEl.alt = filename
        previewEl.loading = 'lazy'
      }

      // Record in database
      const { error: dbError } = await supabase.from('photos').insert([{
        album_id: albumId,
        file_path: path,
        uploaded_by: user?.id || null,
        focal_point: focalPoint
      }])
      if (dbError) throw dbError

      // Show preview thumbnail
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
      previewEl.src = publicUrl
      fileItem.appendChild(previewEl)

      setStatus('✓', '#63f5ef')

      uploadedCount++
    } catch (err) {
      console.error('Upload error:', err)
      const fileItem = uploadStatusEl.querySelector('.upload-item:last-child')
      if (fileItem) {
        fileItem.querySelector('.status').textContent = `✗ ${err.message}`
        fileItem.querySelector('.status').style.color = '#ff6b6b'
      }
    }
  }

  // Show completion message
  const completeMsg = document.createElement('div')
  completeMsg.className = 'upload-complete'
  completeMsg.innerHTML = `
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border)">
      <strong style="color: var(--text-main); font-size: 1.1rem">✓ Uploaded ${uploadedCount} file(s)</strong>
      <div style="margin-top: 12px">
        <a href="album.html?album=${encodeURIComponent(albumId)}" class="btn btn-primary" style="display: inline-block">View Album</a>
      </div>
    </div>
  `
  uploadStatusEl.appendChild(completeMsg)
}

// Drag and drop handlers
function preventDefault(e) {
  e.preventDefault()
  e.stopPropagation()
}

;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
  dropAreaEl.addEventListener(evt, preventDefault)
})

dropAreaEl.addEventListener('dragover', () => {
  dropAreaEl.classList.add('drag-over')
})

dropAreaEl.addEventListener('dragleave', () => {
  dropAreaEl.classList.remove('drag-over')
})

dropAreaEl.addEventListener('drop', (e) => {
  dropAreaEl.classList.remove('drag-over')
  const files = e.dataTransfer.files
  handleFiles(files)
})

fileInputEl.addEventListener('change', (e) => {
  handleFiles(e.target.files)
})

// Load
document.addEventListener('DOMContentLoaded', () => {
  const albumId = getAlbumId()
  
  if (!albumId) {
    uploadStatusEl.innerHTML = '<div style="color: #ff6b6b">No album ID specified in URL. Add ?album=ALBUM_UUID</div>'
    dropAreaEl.style.display = 'none'
  } else {
    albumIdDisplayEl.textContent = albumId
  }

  checkAuth()

  // Google Photos import button
  const googleBtn = document.getElementById('google-photos-btn')
  if (googleBtn) googleBtn.addEventListener('click', handleGooglePhotosClick)

  // Show iOS iCloud hint on mobile Apple devices
  const iosHint = document.getElementById('ios-hint')
  if (iosHint && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    iosHint.style.display = 'inline-flex'
  }
})
