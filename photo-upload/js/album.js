import { supabase } from './supabase.js'

const PAGE_SIZE = 30

const params = new URLSearchParams(window.location.search)
const albumId = params.get('id')

const albumHeader = document.getElementById('album-header')
const albumTitle = document.getElementById('album-title')
const albumMeta = document.getElementById('album-meta')
const lockBadge = document.getElementById('lock-badge')
const photoGrid = document.getElementById('photo-grid')
const loadingMsg = document.getElementById('loading-msg')
const emptyMsg = document.getElementById('empty-msg')
const errorMsg = document.getElementById('error-msg')
const pagination = document.getElementById('pagination')
const prevBtn = document.getElementById('prev-btn')
const nextBtn = document.getElementById('next-btn')
const pageInfo = document.getElementById('page-info')
const authBtn = document.getElementById('auth-btn')
const uploadLink = document.getElementById('upload-link')
const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightbox-img')
const lbPrev = document.getElementById('lb-prev')
const lbNext = document.getElementById('lb-next')
const lbClose = document.getElementById('lightbox-close')

let currentPage = 0
let totalCount = 0
let currentPhotos = []
let lightboxIndex = 0

// ── Guard: no album ID ───────────────────────────────────────────
if (!albumId) {
  showError('No album specified.')
  throw new Error('No album ID')
}

// ── Auth ─────────────────────────────────────────────────────────
const { data: { session } } = await supabase.auth.getSession()
let user = session?.user ?? null

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
    await supabase.auth.signOut()
    user = null
    updateNav()
  } else {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
})

supabase.auth.onAuthStateChange((_event, s) => {
  user = s?.user ?? null
  updateNav()
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

  await loadPhotos()
}

// ── Load photos (paginated) ──────────────────────────────────────
async function loadPhotos() {
  loadingMsg.style.display = 'block'
  photoGrid.style.display = 'none'
  emptyMsg.style.display = 'none'
  errorMsg.style.display = 'none'
  pagination.style.display = 'none'
  photoGrid.innerHTML = ''

  const from = currentPage * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: photos, error, count } = await supabase
    .from('photos')
    .select('id, file_path, created_at', { count: 'exact' })
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    showError('Failed to load photos: ' + error.message)
    return
  }

  totalCount = count ?? 0
  loadingMsg.style.display = 'none'

  if (!photos || photos.length === 0) {
    emptyMsg.style.display = 'block'
    return
  }

  currentPhotos = photos.map(p => {
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(p.file_path)
    return urlData.publicUrl
  })

  photoGrid.style.display = 'grid'

  photos.forEach((photo, i) => {
    const url = currentPhotos[i]
    const item = document.createElement('button')
    item.className = 'photo-item'
    item.setAttribute('aria-label', `View photo ${from + i + 1}`)

    const img = document.createElement('img')
    img.src = url
    img.alt = `Photo ${from + i + 1}`
    img.loading = 'lazy'
    img.width = 400
    img.height = 400

    item.appendChild(img)
    item.addEventListener('click', () => openLightbox(i))
    photoGrid.appendChild(item)
  })

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  if (totalPages > 1) {
    pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`
    prevBtn.disabled = currentPage === 0
    nextBtn.disabled = currentPage >= totalPages - 1
    pagination.style.display = 'flex'
  }
}

prevBtn.addEventListener('click', () => {
  if (currentPage > 0) { currentPage--; loadPhotos() }
})

nextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  if (currentPage < totalPages - 1) { currentPage++; loadPhotos() }
})

// ── Lightbox ─────────────────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index
  lightboxImg.src = currentPhotos[index]
  lightboxImg.alt = `Photo ${currentPage * PAGE_SIZE + index + 1}`
  lightbox.classList.add('open')
  lbPrev.disabled = index === 0
  lbNext.disabled = index === currentPhotos.length - 1
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
  if (lightboxIndex < currentPhotos.length - 1) openLightbox(lightboxIndex + 1)
})

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox()
})

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) openLightbox(lightboxIndex - 1)
  if (e.key === 'ArrowRight' && lightboxIndex < currentPhotos.length - 1) openLightbox(lightboxIndex + 1)
})

// ── Helpers ──────────────────────────────────────────────────────
function showError(msg) {
  loadingMsg.style.display = 'none'
  errorMsg.textContent = msg
  errorMsg.style.display = 'block'
}

// ── Init ─────────────────────────────────────────────────────────
loadAlbum()
