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

      // Convert HEIC if needed (check both MIME type and file extension)
      let uploadFile = await convertHeicToJpeg(file)

      // Resize image — treat HEIC/blank-type blobs from conversion as jpeg
      let uploadBlob = uploadFile
      let contentType = uploadFile.type || 'image/jpeg'

      if (uploadFile.type.startsWith('image/') || uploadFile.type === '') {
        uploadBlob = await resizeImage(uploadFile, 1600, 0.8)
        contentType = 'image/jpeg'
      }

      // Detect face focal point for smart thumbnail cropping
      const focalPoint = await detectFocalPoint(uploadBlob)

      // Sanitize filename and handle HEIC conversion
      const baseName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
      
      // Always save as JPEG for consistency (handles HEIC, HEIF, and other formats)
      const filename = contentType === 'image/jpeg' ? `${baseName}.jpg` : file.name
      const path = `${albumId}/${Date.now()}_${filename}`

      fileItem.querySelector('.status').textContent = 'Uploading...'

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, uploadBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType
        })

      if (uploadError) throw uploadError

      // Record in database
      const { data: { user } } = await supabase.auth.getUser()
      
      // Validate album ID is UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(albumId)) {
        throw new Error(`Invalid album ID: ${albumId}. Must be a valid UUID.`)
      }

      const { error: dbError } = await supabase
        .from('photos')
        .insert([{
          album_id: albumId,
          file_path: path,
          uploaded_by: user?.id || null,
          focal_point: focalPoint
        }])

      if (dbError) throw dbError

      // Get public URL and show thumbnail
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(path)

      fileItem.querySelector('.status').textContent = '✓'
      fileItem.querySelector('.status').style.color = '#63f5ef'

      const img = document.createElement('img')
      img.src = publicUrl
      img.alt = filename
      img.loading = 'lazy'
      fileItem.appendChild(img)

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
      <strong style="color: var(--text-main); font-size: 1.1rem">✓ Uploaded ${uploadedCount} photo(s)</strong>
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
})
