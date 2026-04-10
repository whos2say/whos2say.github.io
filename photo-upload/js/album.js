import { supabase } from './supabase.js'
import { getUser, onAuthChange, signOut } from './auth.js'

const BATCH_SIZE = 40

const params = new URLSearchParams(window.location.search)
const albumId = params.get('id')

const albumHeader = document.getElementById('album-header')
const albumTitle = document.getElementById('album-title')
const albumMeta = document.getElementById('album-meta')
const photoCountEl = document.getElementById('photo-count')
const lockBadge = document.getElementById('lock-badge')
const photoGrid = document.getElementById('photo-grid')
const loadingMsg = document.getElementById('loading-msg')
const emptyMsg = document.getElementById('empty-msg')
const errorMsg = document.getElementById('error-msg')
const loadMoreArea = document.getElementById('load-more-area')
const loadMoreBtn = document.getElementById('load-more-btn')
const loadAllLink = document.getElementById('load-all-link')
const authBtn = document.getElementById('auth-btn')
const uploadLink = document.getElementById('upload-link')
const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightbox-img')
const lbPrev = document.getElementById('lb-prev')
const lbNext = document.getElementById('lb-next')
const lbClose = document.getElementById('lightbox-close')

// allPhotos holds every photo object loaded so far.
// Downstream features (bulk ops, slideshow selector) read from this array.
let allPhotos = []   // [{ id, file_path, publicUrl }]
let totalPhotos = 0  // total in DB (set from count on first load)
let lightboxIndex = 0
let isLoadingMore = false

// ── Guard: no album ID ───────────────────────────────────────────
if (!albumId) {
  showError('No album specified.')
  throw new Error('No album ID')
}

// ── Auth ─────────────────────────────────────────────────────────
let user = getUser()

function updateNav() {
  if (user) {
    authBtn.textContent = 'Sign Out'
    uploadLink.href = `upload.html?album=${albumId}`
    uploadLink.style.display = 'inline-flex'
  } else {
    authBtn.textContent = 'Sign In'
    uploadLink.style.display = 'none'
  }
}

authBtn.addEventListener('click', async () => {
  if (user) {
    await signOut()
    user = null
    updateNav()
  } else {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
})

onAuthChange((newUser) => {
  if (user !== newUser) {
    user = newUser
    updateNav()
  }
})

updateNav()

// ── Load album metadata ──────────────────────────────────────────
async function loadAlbum() {
  const { data: album, error } = await supabase
    .from('albums')
    .select('id, name, is_private, created_at')
    .eq('id', albumId)
    .single()

  if (error || !album) {
    showError('Album not found.')
    return
  }

  // Auth gate: private albums require login
  if (album.is_private && !user) {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return
  }

  document.title = `${album.name} — Photo Albums`
  albumTitle.textContent = album.name
  albumMeta.textContent = new Date(album.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  if (album.is_private) {
    lockBadge.style.display = 'inline-flex'
  }

  albumHeader.style.display = 'flex'

  await loadPhotos(0)
}

// ── Load a batch of photos ───────────────────────────────────────
async function loadPhotos(offset) {
  if (offset === 0) {
    loadingMsg.style.display = 'block'
    photoGrid.style.display = 'none'
    emptyMsg.style.display = 'none'
    errorMsg.style.display = 'none'
    loadMoreArea.style.display = 'none'
    photoGrid.innerHTML = ''
    allPhotos = []
  }

  const { data: photos, error, count } = await supabase
    .from('photos')
    .select('id, file_path, created_at', { count: 'exact' })
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1)

  loadingMsg.style.display = 'none'

  if (error) {
    showError('Failed to load photos: ' + error.message)
    return
  }

  // Capture total count from first batch
  if (offset === 0 && count != null) {
    totalPhotos = count
    if (totalPhotos > 0 && photoCountEl) {
      photoCountEl.textContent = `${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`
    }
  }

  if (!photos || photos.length === 0) {
    if (offset === 0) emptyMsg.style.display = 'block'
    loadMoreArea.style.display = 'none'
    return
  }

  const batchStart = allPhotos.length

  const newPhotos = photos.map(p => {
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(p.file_path)
    return { id: p.id, file_path: p.file_path, publicUrl: urlData.publicUrl }
  })

  allPhotos = [...allPhotos, ...newPhotos]

  photoGrid.style.display = 'grid'
  renderPhotoBatch(newPhotos, batchStart)
  updateLoadMoreUI()
}

// ── Render a batch of photo tiles ────────────────────────────────
function renderPhotoBatch(photos, startIndex) {
  photos.forEach((photo, i) => {
    const { data: thumbData } = supabase.storage.from('photos').getPublicUrl(photo.file_path, {
      transform: { width: 400, height: 400, resize: 'cover' }
    })

    const item = document.createElement('button')
    item.className = 'photo-item'
    // Reset delay from 0 for each batch
    item.style.animationDelay = `${Math.min(i, 11) * 40}ms`
    item.setAttribute('aria-label', `View photo ${startIndex + i + 1}`)

    const img = document.createElement('img')
    img.src = thumbData.publicUrl
    img.alt = `Photo ${startIndex + i + 1}`
    img.loading = 'lazy'
    img.width = 400
    img.height = 400

    item.appendChild(img)
    item.addEventListener('click', () => openLightbox(startIndex + i))
    photoGrid.appendChild(item)
  })
}

// ── Load More UI ─────────────────────────────────────────────────
function updateLoadMoreUI() {
  const remaining = totalPhotos - allPhotos.length
  if (remaining > 0) {
    loadMoreBtn.textContent = `Load More · ${remaining} remaining`
    loadMoreArea.style.display = 'flex'
  } else {
    loadMoreArea.style.display = 'none'
  }
}

loadMoreBtn.addEventListener('click', async () => {
  if (isLoadingMore) return
  isLoadingMore = true
  loadMoreBtn.disabled = true
  loadMoreBtn.textContent = 'Loading…'

  await loadPhotos(allPhotos.length)

  loadMoreBtn.disabled = false
  isLoadingMore = false
})

// ── Load All link ────────────────────────────────────────────────
loadAllLink.addEventListener('click', async (e) => {
  e.preventDefault()
  if (isLoadingMore) return
  isLoadingMore = true
  loadAllLink.textContent = 'Loading…'
  loadMoreArea.style.display = 'none'

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, file_path, created_at')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .range(allPhotos.length, totalPhotos - 1)

  if (error) {
    showError('Failed to load photos: ' + error.message)
    loadAllLink.textContent = 'or load all'
    isLoadingMore = false
    return
  }

  if (photos && photos.length > 0) {
    const batchStart = allPhotos.length
    const newPhotos = photos.map(p => {
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(p.file_path)
      return { id: p.id, file_path: p.file_path, publicUrl: urlData.publicUrl }
    })
    allPhotos = [...allPhotos, ...newPhotos]
    renderPhotoBatch(newPhotos, batchStart)
  }

  loadAllLink.textContent = 'or load all'
  loadMoreArea.style.display = 'none'
  isLoadingMore = false
})

// ── Lightbox ─────────────────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index
  lightboxImg.src = allPhotos[index].publicUrl
  lightboxImg.alt = `Photo ${index + 1}`
  lightbox.classList.add('open')
  lbPrev.disabled = index === 0
  lbNext.disabled = index === allPhotos.length - 1
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightbox.classList.remove('open')
  lightboxImg.src = ''
  document.body.style.overflow = ''
}

lbClose.addEventListener('click', closeLightbox)

lbPrev.addEventListener('click', () => {
  if (lightboxIndex > 0) openLightbox(lightboxIndex - 1)
})

lbNext.addEventListener('click', () => {
  if (lightboxIndex < allPhotos.length - 1) openLightbox(lightboxIndex + 1)
})

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox()
})

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) openLightbox(lightboxIndex - 1)
  if (e.key === 'ArrowRight' && lightboxIndex < allPhotos.length - 1) openLightbox(lightboxIndex + 1)
})

// ── Helpers ──────────────────────────────────────────────────────
function showError(msg) {
  loadingMsg.style.display = 'none'
  errorMsg.textContent = msg
  errorMsg.style.display = 'block'
}

// ── Init ─────────────────────────────────────────────────────────
loadAlbum()
