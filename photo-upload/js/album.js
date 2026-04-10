import { supabase } from './supabase.js'
import { getUser, onAuthChange, signOut } from './auth.js'

const BATCH_SIZE = 40
const SS_PAGE = 48
const PLAYER_INTERVAL = 4000

const params = new URLSearchParams(window.location.search)
const albumId = params.get('id')

// ── DOM refs ─────────────────────────────────────────────────────
const albumHeader   = document.getElementById('album-header')
const albumTitle    = document.getElementById('album-title')
const albumMeta     = document.getElementById('album-meta')
const photoCountEl  = document.getElementById('photo-count')
const lockBadge     = document.getElementById('lock-badge')
const photoGrid     = document.getElementById('photo-grid')
const loadingMsg    = document.getElementById('loading-msg')
const emptyMsg      = document.getElementById('empty-msg')
const errorMsg      = document.getElementById('error-msg')
const loadMoreArea  = document.getElementById('load-more-area')
const loadMoreBtn   = document.getElementById('load-more-btn')
const loadAllLink   = document.getElementById('load-all-link')
const slideshowBtn  = document.getElementById('slideshow-btn')
const authBtn       = document.getElementById('auth-btn')
const uploadLink    = document.getElementById('upload-link')
const lightbox      = document.getElementById('lightbox')
const lightboxImg   = document.getElementById('lightbox-img')
const lbPrev        = document.getElementById('lb-prev')
const lbNext        = document.getElementById('lb-next')
const lbClose       = document.getElementById('lightbox-close')

// Slideshow selector
const ssOverlay     = document.getElementById('ss-overlay')
const ssPhotoGrid   = document.getElementById('ss-photo-grid')
const ssStartBtn    = document.getElementById('ss-start-btn')
const ssCloseBtn    = document.getElementById('ss-close-btn')
const ssCountText   = document.getElementById('ss-count-text')
const ssPresets     = document.getElementById('ss-presets')
const ssLoadNotice  = document.getElementById('ss-load-notice')
const ssLoadedOf    = document.getElementById('ss-loaded-of')
const ssTotalOf     = document.getElementById('ss-total-of')
const ssLoadAllLink = document.getElementById('ss-load-all-link')

// Slideshow player
const ssPlayer          = document.getElementById('ss-player')
const ssPlayerImg       = document.getElementById('ss-player-img')
const ssPlayerPrev      = document.getElementById('ss-player-prev')
const ssPlayerNext      = document.getElementById('ss-player-next')
const ssPlayerClose     = document.getElementById('ss-player-close')
const ssPlayerPlaypause = document.getElementById('ss-player-playpause')
const ssPlayerCounter   = document.getElementById('ss-player-counter')

// ── State ─────────────────────────────────────────────────────────
// allPhotos: all photos loaded into the main grid so far
let allPhotos = []   // [{ id, file_path, publicUrl }]
let totalPhotos = 0
let lightboxIndex = 0
let isLoadingMore = false

// Slideshow selector state
let ssSortedPhotos = []       // all photos available to selector (full set in order)
let ssSelectedPhotos = new Set()  // IDs of included photos
let ssRenderedCount = 0
let ssLastClickIndex = -1

// Slideshow player state
let playerPhotos = []
let playerIndex = 0
let playerTimer = null
let playerPlaying = true

// ── Guard ────────────────────────────────────────────────────────
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
  if (user !== newUser) { user = newUser; updateNav() }
})

updateNav()

// ── Album metadata ───────────────────────────────────────────────
async function loadAlbum() {
  const { data: album, error } = await supabase
    .from('albums')
    .select('id, name, is_private, created_at')
    .eq('id', albumId)
    .single()

  if (error || !album) { showError('Album not found.'); return }

  if (album.is_private && !user) {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return
  }

  document.title = `${album.name} — Photo Albums`
  albumTitle.textContent = album.name
  albumMeta.textContent = new Date(album.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
  if (album.is_private) lockBadge.style.display = 'inline-flex'
  albumHeader.style.display = 'flex'

  await loadPhotos(0)
}

// ── Load photos (batched) ────────────────────────────────────────
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

  if (error) { showError('Failed to load photos: ' + error.message); return }

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

  if (allPhotos.length > 0) slideshowBtn.style.display = 'inline-flex'
}

function renderPhotoBatch(photos, startIndex) {
  photos.forEach((photo, i) => {
    const { data: thumbData } = supabase.storage.from('photos').getPublicUrl(photo.file_path, {
      transform: { width: 400, height: 400, resize: 'cover' }
    })
    const item = document.createElement('button')
    item.className = 'photo-item'
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
lbPrev.addEventListener('click', () => { if (lightboxIndex > 0) openLightbox(lightboxIndex - 1) })
lbNext.addEventListener('click', () => { if (lightboxIndex < allPhotos.length - 1) openLightbox(lightboxIndex + 1) })
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox() })

// ── Slideshow Selector ───────────────────────────────────────────
slideshowBtn.addEventListener('click', openSlideshowSelector)

function openSlideshowSelector() {
  ssSortedPhotos = [...allPhotos]
  ssSelectedPhotos = new Set(ssSortedPhotos.map(p => p.id))
  ssRenderedCount = 0
  ssLastClickIndex = -1

  // Load-all notice if main grid isn't fully loaded
  if (allPhotos.length < totalPhotos) {
    ssLoadedOf.textContent = allPhotos.length
    ssTotalOf.textContent = totalPhotos
    ssLoadNotice.style.display = 'block'
  } else {
    ssLoadNotice.style.display = 'none'
  }

  // Clear grid, keep sticky count element
  const stickyCount = ssPhotoGrid.querySelector('.ss-sticky-count')
  ssPhotoGrid.innerHTML = ''
  ssPhotoGrid.appendChild(stickyCount)

  // Restore saved config if available
  loadSSConfig()

  renderSSBatch()
  updateSSCount()

  ssOverlay.style.display = 'flex'
  document.body.style.overflow = 'hidden'
}

function renderSSBatch() {
  const end = Math.min(ssRenderedCount + SS_PAGE, ssSortedPhotos.length)
  const fragment = document.createDocumentFragment()

  for (let i = ssRenderedCount; i < end; i++) {
    fragment.appendChild(createSSThumb(ssSortedPhotos[i], i))
  }
  ssRenderedCount = end

  // Remove old show-more button before inserting new thumbs
  ssPhotoGrid.querySelector('.ss-show-more')?.remove()

  const stickyCount = ssPhotoGrid.querySelector('.ss-sticky-count')
  ssPhotoGrid.insertBefore(fragment, stickyCount)

  if (ssRenderedCount < ssSortedPhotos.length) {
    const remaining = ssSortedPhotos.length - ssRenderedCount
    const btn = document.createElement('button')
    btn.className = 'ss-show-more'
    btn.textContent = `Show more · ${remaining} photos`
    btn.addEventListener('click', () => renderSSBatch())
    ssPhotoGrid.insertBefore(btn, stickyCount)
  }
}

function createSSThumb(photo, index) {
  const { data: thumbData } = supabase.storage.from('photos').getPublicUrl(photo.file_path, {
    transform: { width: 300, height: 300, resize: 'cover' }
  })

  const thumb = document.createElement('div')
  thumb.className = 'ss-thumb'
  thumb.dataset.id = photo.id
  thumb.dataset.index = String(index)
  thumb.setAttribute('role', 'checkbox')

  const img = document.createElement('img')
  img.src = thumbData.publicUrl
  img.alt = `Photo ${index + 1}`
  img.loading = 'lazy'
  img.width = 300
  img.height = 300

  const check = document.createElement('div')
  check.className = 'ss-check'
  check.textContent = '✓'
  check.setAttribute('aria-hidden', 'true')

  const excl = document.createElement('div')
  excl.className = 'ss-excl'
  excl.setAttribute('aria-hidden', 'true')

  thumb.append(img, check, excl)
  applySSThumbState(thumb, photo.id)

  thumb.addEventListener('click', (e) => {
    const idx = parseInt(thumb.dataset.index, 10)

    if (e.shiftKey && ssLastClickIndex >= 0) {
      const willSelect = !ssSelectedPhotos.has(photo.id)
      const lo = Math.min(ssLastClickIndex, idx)
      const hi = Math.max(ssLastClickIndex, idx)
      for (let i = lo; i <= hi; i++) {
        if (willSelect) ssSelectedPhotos.add(ssSortedPhotos[i].id)
        else ssSelectedPhotos.delete(ssSortedPhotos[i].id)
      }
      ssPhotoGrid.querySelectorAll('.ss-thumb').forEach(t => {
        const ti = parseInt(t.dataset.index, 10)
        if (ti >= lo && ti <= hi) applySSThumbState(t, ssSortedPhotos[ti].id)
      })
    } else {
      if (ssSelectedPhotos.has(photo.id)) ssSelectedPhotos.delete(photo.id)
      else ssSelectedPhotos.add(photo.id)
      applySSThumbState(thumb, photo.id)
    }

    ssLastClickIndex = idx
    updateSSCount()
  })

  return thumb
}

function applySSThumbState(thumbEl, photoId) {
  const selected = ssSelectedPhotos.has(photoId)
  thumbEl.classList.toggle('ss-selected', selected)
  thumbEl.classList.toggle('ss-excluded', !selected)
  thumbEl.setAttribute('aria-checked', String(selected))
}

function updateSSCount() {
  const n = ssSelectedPhotos.size
  const total = ssSortedPhotos.length
  ssCountText.textContent = `${n} of ${total} selected`
  ssStartBtn.disabled = n === 0
}

// ── Presets ──────────────────────────────────────────────────────
ssPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.ss-preset')
  if (!btn) return
  const p = btn.dataset.preset

  if (p === 'all') {
    ssSelectedPhotos = new Set(ssSortedPhotos.map(x => x.id))
  } else if (p === 'newest20') {
    ssSelectedPhotos = new Set(ssSortedPhotos.slice(0, 20).map(x => x.id))
  } else if (p === 'newest50') {
    ssSelectedPhotos = new Set(ssSortedPhotos.slice(0, 50).map(x => x.id))
  } else if (p === 'invert') {
    ssSelectedPhotos = new Set(ssSortedPhotos.filter(x => !ssSelectedPhotos.has(x.id)).map(x => x.id))
  }

  ssPhotoGrid.querySelectorAll('.ss-thumb').forEach(t => {
    applySSThumbState(t, ssSortedPhotos[parseInt(t.dataset.index, 10)].id)
  })
  updateSSCount()
})

// ── Load all from selector ────────────────────────────────────────
ssLoadAllLink.addEventListener('click', async (e) => {
  e.preventDefault()
  ssLoadAllLink.textContent = 'Loading…'

  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, file_path, created_at')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .range(allPhotos.length, totalPhotos - 1)

  if (error || !photos) { ssLoadAllLink.textContent = 'Load all'; return }

  const newPhotos = photos.map(p => {
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(p.file_path)
    return { id: p.id, file_path: p.file_path, publicUrl: urlData.publicUrl }
  })

  // Update main allPhotos + render into main grid
  const mainBatchStart = allPhotos.length
  allPhotos = [...allPhotos, ...newPhotos]
  renderPhotoBatch(newPhotos, mainBatchStart)
  updateLoadMoreUI()

  // Add to selector, default to selected
  ssSortedPhotos = [...ssSortedPhotos, ...newPhotos]
  newPhotos.forEach(p => ssSelectedPhotos.add(p.id))
  renderSSBatch()

  ssLoadNotice.style.display = 'none'
  updateSSCount()
})

// ── Saved config ──────────────────────────────────────────────────
function saveSSConfig() {
  try {
    localStorage.setItem(`ss-config-${albumId}`, JSON.stringify({
      orderedIds: ssSortedPhotos.map(p => p.id),
      excludedIds: ssSortedPhotos.filter(p => !ssSelectedPhotos.has(p.id)).map(p => p.id)
    }))
  } catch {}
}

function loadSSConfig() {
  try {
    const raw = localStorage.getItem(`ss-config-${albumId}`)
    if (!raw) return
    const { orderedIds, excludedIds } = JSON.parse(raw)

    if (orderedIds?.length) {
      const idMap = new Map(ssSortedPhotos.map(p => [p.id, p]))
      const ordered = orderedIds.map(id => idMap.get(id)).filter(Boolean)
      const inConfig = new Set(orderedIds)
      ssSortedPhotos = [...ordered, ...ssSortedPhotos.filter(p => !inConfig.has(p.id))]
    }

    if (excludedIds?.length) {
      excludedIds.forEach(id => ssSelectedPhotos.delete(id))
    }
  } catch {}
}

// ── Selector close ────────────────────────────────────────────────
function closeSSOverlay() {
  ssOverlay.style.display = 'none'
  document.body.style.overflow = ''
}

ssCloseBtn.addEventListener('click', closeSSOverlay)
ssOverlay.addEventListener('click', (e) => { if (e.target === ssOverlay) closeSSOverlay() })

ssStartBtn.addEventListener('click', () => {
  saveSSConfig()
  closeSSOverlay()
  startSlideshowFromSelector()
})

// ── Slideshow Player ──────────────────────────────────────────────
function startSlideshowFromSelector() {
  const playlist = ssSortedPhotos.filter(p => ssSelectedPhotos.has(p.id))
  if (playlist.length === 0) return
  openPlayer(playlist)
}

const PAUSE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
const PLAY_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`

function openPlayer(photos) {
  playerPhotos = photos
  playerIndex = 0
  playerPlaying = true
  ssPlayerPlaypause.innerHTML = PAUSE_SVG
  ssPlayerPlaypause.setAttribute('aria-label', 'Pause slideshow')
  ssPlayer.style.display = 'flex'
  document.body.style.overflow = 'hidden'
  showPlayerSlide(0)
  startPlayerTimer()
}

function showPlayerSlide(index) {
  playerIndex = index
  ssPlayerImg.src = playerPhotos[index].publicUrl
  ssPlayerImg.alt = `Photo ${index + 1}`
  ssPlayerPrev.disabled = index === 0
  ssPlayerNext.disabled = index === playerPhotos.length - 1
  ssPlayerCounter.textContent = `${index + 1} / ${playerPhotos.length}`
}

function startPlayerTimer() {
  clearInterval(playerTimer)
  if (!playerPlaying) return
  playerTimer = setInterval(() => {
    showPlayerSlide(playerIndex < playerPhotos.length - 1 ? playerIndex + 1 : 0)
  }, PLAYER_INTERVAL)
}

function closePlayer() {
  clearInterval(playerTimer)
  playerTimer = null
  ssPlayer.style.display = 'none'
  document.body.style.overflow = ''
}

ssPlayerClose.addEventListener('click', closePlayer)

ssPlayerPrev.addEventListener('click', () => {
  if (playerIndex > 0) { showPlayerSlide(playerIndex - 1); if (playerPlaying) startPlayerTimer() }
})
ssPlayerNext.addEventListener('click', () => {
  if (playerIndex < playerPhotos.length - 1) { showPlayerSlide(playerIndex + 1); if (playerPlaying) startPlayerTimer() }
})

ssPlayerPlaypause.addEventListener('click', () => {
  playerPlaying = !playerPlaying
  ssPlayerPlaypause.innerHTML = playerPlaying ? PAUSE_SVG : PLAY_SVG
  ssPlayerPlaypause.setAttribute('aria-label', playerPlaying ? 'Pause slideshow' : 'Play slideshow')
  startPlayerTimer()
})

// ── Keyboard ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Player takes priority
  if (ssPlayer.style.display !== 'none') {
    if (e.key === 'Escape') { closePlayer(); return }
    if (e.key === ' ') { e.preventDefault(); ssPlayerPlaypause.click(); return }
    if (e.key === 'ArrowLeft' && playerIndex > 0) {
      showPlayerSlide(playerIndex - 1); if (playerPlaying) startPlayerTimer(); return
    }
    if (e.key === 'ArrowRight' && playerIndex < playerPhotos.length - 1) {
      showPlayerSlide(playerIndex + 1); if (playerPlaying) startPlayerTimer(); return
    }
    return
  }
  // Selector close on Escape
  if (ssOverlay.style.display !== 'none') {
    if (e.key === 'Escape') { closeSSOverlay(); return }
    return
  }
  // Lightbox
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
