import { supabase } from './supabase.js'
import {
  trackEvent,
  trackSlideshowStart,
  trackPhotoView,
  trackSlideshowModeChange,
  trackMusicPlay,
} from './analytics.js'
import { initSharePanel } from './share-panel.js'

const slideShowImageEl = document.getElementById('slideshow-image')
const collageViewerEl = document.getElementById('collage-viewer')
const collageGridEl = document.getElementById('collage-grid')
const photoCounterEl = document.getElementById('photo-counter')
const prevBtnEl = document.getElementById('prev-btn')
const nextBtnEl = document.getElementById('next-btn')
const playPauseBtnEl = document.getElementById('play-pause-btn')
const exitBtnEl = document.getElementById('exit-btn')
const fullscreenBtnEl = document.getElementById('fullscreen-btn')
const backToAlbumEl = document.getElementById('back-to-album')
const slideshowTitleEl = document.getElementById('slideshow-title')
const emptyStateEl = document.getElementById('empty-state')
const progressBarEl = document.getElementById('slideshow-progress')
const slideshowViewer = document.querySelector('.slideshow-viewer')
const slideshowControlsEl = document.querySelector('.slideshow-controls')
const slideshowTopBarEl = document.querySelector('.slideshow-top-bar')
const audioControlsEl = document.getElementById('audio-controls')
const audioPlayerEl = document.getElementById('slideshow-audio')
const audioMuteBtn = document.getElementById('audio-mute-btn')
const slideshowBgEl = document.getElementById('slideshow-bg')
const slideshowVideoEl = document.getElementById('slideshow-video')
const orderBtnEl = document.getElementById('order-btn')
const modeBtnEl = document.getElementById('mode-btn')
const shareBtnEl         = document.getElementById('share-btn')
const QUALITY_MIN_W = 1280
const QUALITY_MIN_H = 720

function isVideoPath(path) {
  return /\.(mp4|mov|webm|m4v)$/i.test(path || '')
}

function isPortraitMobile() {
  return window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches
}

let photos = []
let slides = []           // pre-built sequence: each photo appears in exactly one slide
let currentPhotoIndex = 0 // index into slides[], not photos[]
let isPlaying = false
let autoplayTimeout = null
let audioUrl = null
let hideControlsTimer = null
let isMultiAlbum = false
let singleAlbumId = null

// Playback order: 'sequential' | 'random'
let playOrder = 'sequential'
let _sharePanel = null
// View mode: 'mixed' | 'full' | 'collage'
let viewMode = 'mixed'

// ── Analytics session state ───────────────────────────────────────────────────
let _trackAlbumId        = null   // album ID sent on every event
let _trackAlbumName      = ''     // album display name
let _sessionStart        = null   // Date.now() when session initialised
let _viewedSlides        = new Set() // set of slide indices seen this session
let _lastTrackedSlideIdx = -1     // dedup guard for photo_view
let _autoplayUsed        = false  // whether autoplay advanced at least one slide
let _musicPlayTracked    = false  // fire music_play only once per session

const AUTOPLAY_DELAY = 4000
const COLLAGE_INTERVAL = 2

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Parse "43% 28%" focal_point string → [0.43, 0.28]
function parseFocalPoint(fp) {
  const m = String(fp || '50% 35%').match(/([\d.]+)%\s+([\d.]+)%/)
  return m ? [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100] : [0.5, 0.35]
}

// Compute object-position percentages that MATHEMATICALLY CENTER the focal point
// within the viewport when using object-fit: cover.
// Formula: p = 100 * (f * scaledDim - containerDim/2) / (scaledDim - containerDim)
function computeCenteredObjectPosition(fx, fy, naturalW, naturalH, containerW, containerH) {
  const s = Math.max(containerW / naturalW, containerH / naturalH)
  const scaledW = naturalW * s
  const scaledH = naturalH * s
  const overflowX = scaledW - containerW
  const overflowY = scaledH - containerH
  const px = overflowX > 0.5 ? Math.max(0, Math.min(100, 100 * (fx * scaledW - containerW / 2) / overflowX)) : 50
  const py = overflowY > 0.5 ? Math.max(0, Math.min(100, 100 * (fy * scaledH - containerH / 2) / overflowY)) : 50
  return `${px.toFixed(2)}% ${py.toFixed(2)}%`
}

// Named grid-template-area layouts for collage slides.
// template: CSS grid-template shorthand (areas + row sizes / col sizes)
// slots:    area names in order — photo[i] gets slotted into slots[i]
const COLLAGE_LAYOUTS = [
  {
    name: 'duo',
    count: 2,
    template: '"a b" 1fr / 1fr 1fr',
    slots: ['a', 'b'],
  },
  {
    name: 'trio',
    count: 3,
    template: '"a b" 2fr "a c" 1fr / 1fr 1fr',
    slots: ['a', 'b', 'c'],
  },
  {
    name: 'quad',
    count: 4,
    template: '"a b" 1fr "c d" 1fr / 1fr 1fr',
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'tall-stack',
    count: 4,
    template: '"a b" 1fr "a c" 1fr "a d" 1fr / 2fr 1fr',
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'feature-top',
    count: 4,
    template: '"top top top" 2fr "b1 b2 b3" 1fr / 1fr 1fr 1fr',
    slots: ['top', 'b1', 'b2', 'b3'],
  },
  {
    name: 'hero-left',
    count: 5,
    template: '"big big sm1" 1fr "big big sm2" 1fr "sm3 sm4 sm4" 1fr / 2fr 1fr 1fr',
    slots: ['big', 'sm1', 'sm2', 'sm3', 'sm4'],
  },
  {
    name: 'magazine',
    count: 6,
    template: '"a b c" 1fr "a d c" 1fr "e d f" 1fr / 1fr 1fr 1fr',
    slots: ['a', 'b', 'c', 'd', 'e', 'f'],
  },
]

// Build a slide sequence where every photo appears exactly once.
// Collage slides consume multiple photos from the queue so no photo repeats.
function buildSlides(photosArr, mode) {
  const maxSlots = isPortraitMobile() ? 3 : 99
  const queue = [...photosArr]
  const result = []

  if (mode === 'full') {
    queue.forEach(p => result.push({ type: 'single', photo: p }))
    return result
  }

  if (mode === 'collage') {
    while (queue.length > 0) {
      const validLayouts = COLLAGE_LAYOUTS.filter(l => l.count <= queue.length && l.count <= maxSlots)
      if (validLayouts.length === 0) {
        // Too few remaining photos for any collage layout — show as singles
        queue.forEach(p => result.push({ type: 'single', photo: p }))
        break
      }
      const layout = validLayouts[Math.floor(Math.random() * validLayouts.length)]
      result.push({ type: 'collage', photos: queue.splice(0, layout.count), layout })
    }
    return result
  }

  // mixed: alternate single → collage → single → collage…
  // Each collage consumes its layout's photo count from the queue.
  let wantCollage = false
  while (queue.length > 0) {
    if (wantCollage && queue.length >= 2) {
      const validLayouts = COLLAGE_LAYOUTS.filter(l => l.count <= queue.length && l.count <= maxSlots)
      if (validLayouts.length > 0) {
        const layout = validLayouts[Math.floor(Math.random() * validLayouts.length)]
        result.push({ type: 'collage', photos: queue.splice(0, layout.count), layout })
        wantCollage = false
        continue
      }
    }
    // Either wanted a single, or couldn't form a collage with remaining photos
    result.push({ type: 'single', photo: queue.shift() })
    wantCollage = true
  }
  return result
}

function rebuildSlides() {
  slides = buildSlides(photos, viewMode)
  currentPhotoIndex = 0
}

function getAlbumIds() {
  const params = new URLSearchParams(window.location.search)

  // Multi-album: ?albums=id1,id2,...
  const albumsParam = params.get('albums')
  if (albumsParam) {
    const ids = albumsParam.split(',').map(s => s.trim()).filter(id => UUID_REGEX.test(id))
    if (ids.length > 0) return ids
  }

  // Single album: ?album=id or ?id=id (legacy)
  const singleId = params.get('album') || params.get('id')
  if (singleId && UUID_REGEX.test(singleId.trim())) {
    return [singleId.trim()]
  }

  return []
}

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

async function loadSpecificPhotos(photoIds) {
  const { data, error } = await supabase
    .from('photos')
    .select('id, file_path, created_at, focal_point')
    .in('id', photoIds)
  if (error) throw error
  // Preserve caller's order
  const byId = Object.fromEntries((data || []).map(p => [p.id, p]))
  return photoIds.map(id => byId[id]).filter(Boolean)
}

async function loadByPhotoIds(photosParam) {
  const photoIds = photosParam.split(',').map(s => s.trim()).filter(id => UUID_REGEX.test(id))
  if (photoIds.length === 0) { showEmptyState('No valid photo IDs provided'); return }

  const params = new URLSearchParams(window.location.search)
  singleAlbumId = params.get('album') || null
  isMultiAlbum = false

  try {
    photos = await loadSpecificPhotos(photoIds)
    if (photos.length === 0) { showEmptyState('No photos found'); return }

    let albumName = 'Selected Photos'
    if (singleAlbumId && UUID_REGEX.test(singleAlbumId)) {
      const { data: albumData } = await supabase
        .from('albums').select('name, music_url').eq('id', singleAlbumId).single()
      if (albumData?.name) albumName = albumData.name
      if (albumData?.music_url) { audioUrl = albumData.music_url; setupAudioPlayer() }
    }

    slideshowTitleEl.textContent = `${albumName} \u2014 ${photos.length} Photo${photos.length !== 1 ? 's' : ''}`
    backToAlbumEl.href = singleAlbumId ? `/album.html?album=${encodeURIComponent(singleAlbumId)}` : '/albums.html'
    backToAlbumEl.textContent = '\u2190 Back'

    rebuildSlides()
    displayPhoto()
    updateUI()
    _initTracking(singleAlbumId, albumName)
  } catch (err) {
    console.error('loadByPhotoIds error:', err)
    showEmptyState(`Error loading photos: ${err.message}`)
  }
}

// Read per-album slideshow config from localStorage
function applyAlbumSsConfig(albumId, photosData) {
  try {
    const raw = localStorage.getItem(`ss_config_${albumId}`)
    if (!raw) return photosData
    const { orderedIds, excludedIds } = JSON.parse(raw)
    const excludedSet = new Set(excludedIds || [])
    let included = (photosData || []).filter(p => !excludedSet.has(p.id))
    if (orderedIds?.length) {
      const byId = Object.fromEntries(included.map(p => [p.id, p]))
      const ordered = orderedIds.map(id => byId[id]).filter(Boolean)
      const orderedSet = new Set(orderedIds)
      const extras = included.filter(p => !orderedSet.has(p.id))
      return [...ordered, ...extras]
    }
    return included
  } catch { return photosData }
}

async function loadMasterSlideshow() {
  try {
    const raw = localStorage.getItem('master_ss_config')
    if (!raw) { showEmptyState('No master slideshow saved. Configure one in Multi-Slideshow.'); return }
    const { photoIds } = JSON.parse(raw)
    if (!photoIds?.length) { showEmptyState('Master slideshow is empty.'); return }

    isMultiAlbum = true
    const { data, error } = await supabase
      .from('photos')
      .select('id, file_path, created_at, focal_point, sort_order')
      .in('id', photoIds)
    if (error) throw error

    const byId = Object.fromEntries((data || []).map(p => [p.id, p]))
    photos = photoIds.map(id => byId[id]).filter(Boolean)
    if (photos.length === 0) { showEmptyState('No photos found for master slideshow.'); return }

    slideshowTitleEl.textContent = `Master Slideshow — ${photos.length} Photos`
    backToAlbumEl.href = '/multi-slideshow.html'
    backToAlbumEl.textContent = '← Picker'

    rebuildSlides()
    displayPhoto()
    updateUI()
    _initTracking(null, 'Master Slideshow')
  } catch (err) {
    showEmptyState(`Error loading master slideshow: ${err.message}`)
  }
}

async function loadPhotos() {
  const params = new URLSearchParams(window.location.search)

  // Master slideshow mode
  if (params.get('master') === '1') { await loadMasterSlideshow(); return }

  const photosParam = params.get('photos')
  if (photosParam) { await loadByPhotoIds(photosParam); return }

  const albumIds = getAlbumIds()

  if (albumIds.length === 0) {
    showEmptyState('Invalid album ID')
    return
  }

  isMultiAlbum = albumIds.length > 1
  if (!isMultiAlbum) {
    singleAlbumId = albumIds[0]
  }

  try {
    let combinedPhotos = []
    let firstMusicUrl = null
    let albumNames = []

    for (const albumId of albumIds) {
      // Fetch album metadata
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('name, cover_photo_id, music_url')
        .eq('id', albumId)
        .single()

      if (albumError) throw albumError

      if (albumData?.name) {
        albumNames.push(albumData.name)
      }

      // Use first album's music_url if found
      if (!firstMusicUrl && albumData?.music_url) {
        firstMusicUrl = albumData.music_url
      }

      // Fetch photos for this album
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('id, file_path, created_at, focal_point, sort_order')
        .eq('album_id', albumId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (photosError) throw photosError

      if (photosData && photosData.length > 0) {
        // Respect per-album saved slideshow config (set on album page by any user)
        const configured = applyAlbumSsConfig(albumId, photosData)
        combinedPhotos = combinedPhotos.concat(configured)
      }
    }

    if (combinedPhotos.length === 0) {
      showEmptyState('No photos in the selected albums')
      return
    }

    // Apply playback order
    photos = playOrder === 'random' ? shuffle(combinedPhotos) : combinedPhotos

    // Set title
    if (isMultiAlbum) {
      slideshowTitleEl.textContent = `${albumIds.length} Albums · ${photos.length} Photos`
    } else {
      const name = albumNames[0] || 'Album'
      slideshowTitleEl.textContent = `${name} \u2014 Slideshow`
    }

    // Set back link
    if (isMultiAlbum) {
      backToAlbumEl.href = '/multi-slideshow.html'
      backToAlbumEl.textContent = '\u2190 Picker'
    } else {
      backToAlbumEl.href = `/album.html?album=${encodeURIComponent(singleAlbumId)}`
      backToAlbumEl.textContent = '\u2190 Back'
    }

    // Set up audio
    if (firstMusicUrl) {
      audioUrl = firstMusicUrl
      setupAudioPlayer()
    }

    rebuildSlides()
    displayPhoto()
    updateUI()
    _initTracking(
      isMultiAlbum ? null : singleAlbumId,
      isMultiAlbum ? `${albumIds.length} Albums` : (albumNames[0] || 'Album')
    )
    // If autoplay=1 was in the URL (set by social share links), start the timer now
    if (isPlaying) scheduleAutoplay()
  } catch (err) {
    console.error('Load photos error:', err)
    showEmptyState(`Error loading photos: ${err.message}`)
  }
}

function setupAudioPlayer() {
  audioControlsEl.style.display = 'flex'
  const playerContainer = audioPlayerEl.parentElement // .audio-player-small

  // Handle different audio source types
  if (audioUrl.includes('youtube.com') || audioUrl.includes('youtu.be')) {
    const videoId = extractYouTubeId(audioUrl)
    if (videoId) {
      audioPlayerEl.style.display = 'none'
      audioMuteBtn.style.display = 'none'
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'width:220px;height:80px;border:1px solid var(--color-primary);border-radius:4px'
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1`
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      playerContainer.appendChild(iframe)
    }
  } else if (audioUrl.includes('spotify.com')) {
    const trackId = extractSpotifyId(audioUrl)
    if (trackId) {
      audioPlayerEl.style.display = 'none'
      audioMuteBtn.style.display = 'none'
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'border-radius:6px;width:220px;height:80px;border:1px solid var(--color-primary)'
      iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&autoplay=1`
      iframe.allow = 'clipboard-write; encrypted-media; fullscreen; picture-in-picture; autoplay'
      iframe.loading = 'lazy'
      playerContainer.appendChild(iframe)
    }
  } else {
    // Assume it's a direct MP3 URL
    audioPlayerEl.type = 'audio/mpeg'
    audioPlayerEl.src = audioUrl
    audioPlayerEl.controls = true
    audioPlayerEl.loop = true
    audioPlayerEl.style.display = 'block'
    audioPlayerEl.muted = false
    audioMuteBtn.textContent = '🔊'
    audioMuteBtn.addEventListener('click', toggleAudioMute)
  }

  // Try to autoplay after a short delay (may be blocked by browser until user gesture)
  setTimeout(() => {
    playAudioIfPossible()
  }, 500)
}

function playAudioIfPossible() {
  // Only applies to native audio elements (MP3), not iframes
  if (audioPlayerEl.tagName === 'AUDIO' && audioPlayerEl.src) {
    audioPlayerEl.muted = false
    const playPromise = audioPlayerEl.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        audioMuteBtn.textContent = '🔊'
      }).catch(err => {
        console.log('Audio autoplay blocked, user interaction required:', err)
        audioMuteBtn.textContent = '🔊 (Click)'
      })
    }
  }
}

function extractYouTubeId(url) {
  // Handle various YouTube URL formats: youtube.com/watch?v=ID, youtu.be/ID, etc.
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i, // Standard watch and short URLs
    /youtube\.com\/(?:embed|v)\/([a-zA-Z0-9_-]{11})/i, // Embed and v URLs
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  // Fallback to legacy regex
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

function extractSpotifyId(url) {
  const regExp = /spotify\.com\/track\/([a-zA-Z0-9]+)/
  const match = url.match(regExp)
  return match ? match[1] : null
}

function toggleAudioMute() {
  if (audioPlayerEl.tagName !== 'AUDIO') return

  if (audioPlayerEl.paused) {
    audioPlayerEl.muted = false
    const playPromise = audioPlayerEl.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        audioMuteBtn.textContent = '🔊'
      }).catch(err => {
        console.log('Play failed:', err)
      })
    } else {
      audioMuteBtn.textContent = '🔊'
    }
  } else {
    audioPlayerEl.pause()
    audioMuteBtn.textContent = '🔇'
  }
}

function showEmptyState(message) {
  slideshowViewer.style.display = 'flex'
  emptyStateEl.style.display = 'block'
  emptyStateEl.innerHTML = `<h2>${message}</h2><p><a href="/albums.html" class="slide-btn" style="display: inline-block; margin-top: var(--space-4);">← Back to Gallery</a></p>`
  slideShowImageEl.style.display = 'none'
  collageViewerEl.style.display = 'none'
  document.querySelector('.slideshow-controls').style.display = 'none'
}

function isCollageSlide() {
  return slides[currentPhotoIndex]?.type === 'collage'
}

function generateCollage(slide) {
  const { layout, photos: collagePhotos } = slide

  collageGridEl.style.gridTemplate = layout.template
  collageGridEl.innerHTML = ''

  collagePhotos.forEach((photo, i) => {
    const publicUrl = supabase.storage
      .from('photos')
      .getPublicUrl(photo.file_path).data.publicUrl

    const collageItem = document.createElement('div')
    collageItem.className = 'collage-item'
    collageItem.style.gridArea = layout.slots[i]
    collageItem.style.animationDelay = `${i * 0.07}s`

    const img = document.createElement('img')
    img.src = publicUrl
    img.alt = 'Collage photo'
    img.loading = 'lazy'
    img.style.objectPosition = photo.focal_point || '50% 35%'

    collageItem.appendChild(img)
    collageGridEl.appendChild(collageItem)
  })
}

function displayPhoto() {
  if (slides.length === 0) return

  const slide = slides[currentPhotoIndex]
  if (!slide) return

  if (slide.type === 'collage') {
    // Show collage — photos are pre-assigned, no repeats possible
    slideShowImageEl.style.display = 'none'
    collageViewerEl.style.display = 'block'
    generateCollage(slide)
  } else {
    // Show single photo or video — full-screen
    collageViewerEl.style.display = 'none'

    const photo = slide.photo
    const publicUrl = supabase.storage
      .from('photos')
      .getPublicUrl(photo.file_path).data.publicUrl

    if (isVideoPath(photo.file_path)) {
      // ── VIDEO SLIDE ──────────────────────────────────────
      slideShowImageEl.style.display = 'none'
      slideShowImageEl.src = ''
      if (slideshowBgEl) { slideshowBgEl.style.display = 'none'; slideshowBgEl.style.backgroundImage = '' }

      slideshowVideoEl.style.display = 'block'
      // Remove old ended listener before reassigning
      slideshowVideoEl.onended = null
      slideshowVideoEl.src = publicUrl
      slideshowVideoEl.muted = false
      slideshowVideoEl.load()
      slideshowVideoEl.play().catch(() => {
        // Autoplay blocked — still show the video, user can hit Play
        slideshowVideoEl.muted = true
        slideshowVideoEl.play().catch(() => {})
      })
      // When video ends, advance if playing
      slideshowVideoEl.onended = () => {
        if (isPlaying) { nextPhoto(); scheduleAutoplay() }
      }
    } else {
      // ── IMAGE SLIDE ──────────────────────────────────────
      slideshowVideoEl.style.display = 'none'
      slideshowVideoEl.pause()
      slideshowVideoEl.src = ''

      slideShowImageEl.style.display = 'block'

      // Set initial object-position from stored focal_point (will be refined on load)
      const fp = photo.focal_point || '50% 35%'
      slideShowImageEl.style.objectPosition = fp
      if (slideshowBgEl) slideshowBgEl.style.backgroundPosition = fp

      // After image loads: mathematically center the face & check quality
      const checkQuality = () => {
        const nw = slideShowImageEl.naturalWidth
        const nh = slideShowImageEl.naturalHeight
        if (nw && nh) {
          const [fx, fy] = parseFocalPoint(fp)
          const centeredPos = computeCenteredObjectPosition(fx, fy, nw, nh, window.innerWidth, window.innerHeight)
          slideShowImageEl.style.objectPosition = centeredPos
          if (slideshowBgEl) slideshowBgEl.style.backgroundPosition = centeredPos
        }
        const lowRes = nw < QUALITY_MIN_W || nh < QUALITY_MIN_H
        if (slideshowBgEl) {
          if (lowRes) {
            slideshowBgEl.style.backgroundImage = `url("${publicUrl.replace(/"/g, '%22')}")`
            slideshowBgEl.style.display = 'block'
            slideShowImageEl.classList.add('low-res')
          } else {
            slideshowBgEl.style.backgroundImage = ''
            slideshowBgEl.style.display = 'none'
            slideShowImageEl.classList.remove('low-res')
          }
        }
      }
      slideShowImageEl.onload = checkQuality
      slideShowImageEl.src = publicUrl
      slideShowImageEl.alt = `Photo ${currentPhotoIndex + 1} of ${slides.length}`
      // Handle cached images (onload may not fire)
      if (slideShowImageEl.complete && slideShowImageEl.naturalWidth > 0) checkQuality()
    }
  }

  updateCounter()
  resetProgress()

  // photo_view — only when the displayed slide actually changes
  if (_sessionStart && currentPhotoIndex !== _lastTrackedSlideIdx) {
    _lastTrackedSlideIdx = currentPhotoIndex
    _viewedSlides.add(currentPhotoIndex)
    trackPhotoView(_trackAlbumId, currentPhotoIndex, slides.length)
  }
}


function updateCounter() {
  if (isCollageSlide()) {
    photoCounterEl.textContent = `Collage / ${slides.length}`
  } else {
    photoCounterEl.textContent = `${currentPhotoIndex + 1} / ${slides.length}`
  }
}

function nextPhoto() {
  if (slides.length === 0) return
  resetControlHide()
  currentPhotoIndex = (currentPhotoIndex + 1) % slides.length
  displayPhoto()
  resetAutoplay()
}

function prevPhoto() {
  if (slides.length === 0) return
  resetControlHide()
  currentPhotoIndex = (currentPhotoIndex - 1 + slides.length) % slides.length
  displayPhoto()
  resetAutoplay()
}

function togglePlayPause() {
  resetControlHide()
  isPlaying = !isPlaying
  updatePlayPauseButton()

  if (isPlaying) {
    // Start audio if an MP3 is configured and loaded
    if (audioUrl && audioPlayerEl && audioPlayerEl.src) {
      audioPlayerEl.muted = false
      const playPromise = audioPlayerEl.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Audio play blocked:', err)
          // Keep slideshow playing even if audio fails
        })
      }
    }
    scheduleAutoplay()
  } else {
    // Pause audio if playing
    if (audioUrl && audioPlayerEl && !audioPlayerEl.paused) {
      audioPlayerEl.pause()
    }
    clearAutoplay()
  }
}

function scheduleAutoplay() {
  if (!isPlaying || slides.length === 0) return

  autoplayTimeout = setTimeout(() => {
    _autoplayUsed = true
    nextPhoto()
    scheduleAutoplay()
  }, AUTOPLAY_DELAY)
}

function resetAutoplay() {
  if (isPlaying) {
    clearAutoplay()
    scheduleAutoplay()
  }
}

function clearAutoplay() {
  if (autoplayTimeout) {
    clearTimeout(autoplayTimeout)
    autoplayTimeout = null
  }
}

function updatePlayPauseButton() {
  playPauseBtnEl.textContent = isPlaying ? '⏸ Pause' : '▶ Play'
}

function updateUI() {
  prevBtnEl.disabled = slides.length <= 1
  nextBtnEl.disabled = slides.length <= 1
  updatePlayPauseButton()
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

function _getMusicTrackName() {
  if (!audioUrl) return 'Unknown'
  if (audioUrl.includes('youtube.com') || audioUrl.includes('youtu.be')) return 'YouTube'
  if (audioUrl.includes('spotify.com')) return 'Spotify'
  try {
    const seg = new URL(audioUrl).pathname.split('/').pop()
    return decodeURIComponent(seg || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Unknown'
  } catch { return 'Unknown' }
}

// ── Open Graph helpers ────────────────────────────────────────────────────────

function _setMetaProperty(property, value) {
  const el = document.querySelector(`meta[property="${property}"]`)
  if (el && value) el.setAttribute('content', value)
}

function _updateOgTags() {
  const title = _trackAlbumName
    ? `${_trackAlbumName} Slideshow — Who's 2 Say Foundation`
    : "Photo Slideshow — Who's 2 Say Foundation"
  document.title = title
  _setMetaProperty('og:title', title)
  _setMetaProperty('og:description', "Photo slideshow from Who's 2 Say Foundation")
  _setMetaProperty('og:url', window.location.href)

  if (photos.length > 0) {
    const coverUrl = supabase.storage
      .from('photos')
      .getPublicUrl(photos[0].file_path).data.publicUrl
    _setMetaProperty('og:image', coverUrl)
  }
}

function _initTracking(albumId, albumName) {
  _trackAlbumId        = albumId || null
  _trackAlbumName      = albumName || ''
  _sessionStart        = Date.now()
  _viewedSlides        = new Set()
  _lastTrackedSlideIdx = -1
  _autoplayUsed        = false
  _musicPlayTracked    = false
  _updateOgTags()
  trackSlideshowStart(_trackAlbumId, _trackAlbumName, slides.length)

  const params    = new URLSearchParams(window.location.search)
  const coverUrl  = photos.length > 0
    ? supabase.storage.from('photos').getPublicUrl(photos[0].file_path).data.publicUrl
    : null

  _sharePanel = initSharePanel({
    shareUrl:     (!isMultiAlbum && albumId)
      ? `${window.location.origin}/share/slideshow?album=${encodeURIComponent(albumId)}`
      : window.location.href,
    title:        albumName || '',
    contentLabel: 'slideshow',
    albumId:      albumId || null,
    targetType:   isMultiAlbum ? 'multi-slideshow' : 'slideshow',
    targetId:     isMultiAlbum
      ? (params.get('albums') || '')
      : (albumId || params.get('album') || ''),
    coverUrl,
  })
}

function _fireSlideshowComplete() {
  if (!_sessionStart) return
  const durationSeconds = (Date.now() - _sessionStart) / 1000
  _sessionStart = null  // prevent double-fire on rapid clicks
  trackEvent('slideshow_complete', {
    album_id:         _trackAlbumId,
    album_name:       _trackAlbumName,
    photos_viewed:    _viewedSlides.size,
    total_photos:     slides.length,
    duration_seconds: Math.round(durationSeconds),
    autoplay_used:    _autoplayUsed,
    view_mode:        viewMode,
  })
}

function resetProgress() {
  progressBarEl.style.width = '0%'
  // Animate progress bar
  setTimeout(() => {
    progressBarEl.style.width = '100%'
  }, 50)
}

// ---- Fullscreen ----

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen request failed:', err)
    })
  } else {
    document.exitFullscreen()
  }
}

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    fullscreenBtnEl.textContent = '\u26f6 Exit Full'
  } else {
    fullscreenBtnEl.textContent = '\u26f6 Full Screen'
  }
  // Re-evaluate control hide timer on fullscreen state change
  resetControlHide()
})

// ---- Auto-hide controls (TV casting) ----

function resetControlHide() {
  // Show controls
  slideshowControlsEl.style.opacity = '1'
  slideshowTopBarEl.style.opacity = '1'
  document.body.style.cursor = ''

  // Clear any existing timer
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }

  // Auto-hide only in fullscreen while playing
  if (document.fullscreenElement && isPlaying) {
    hideControlsTimer = setTimeout(() => {
      slideshowControlsEl.style.opacity = '0'
      slideshowTopBarEl.style.opacity = '0'
      document.body.style.cursor = 'none'
    }, 3500)
  }
}

document.addEventListener('mousemove', resetControlHide)
document.addEventListener('click', resetControlHide)

// Touch / swipe navigation (mobile)
let _touchX = 0, _touchY = 0
document.addEventListener('touchstart', e => {
  _touchX = e.touches[0].clientX
  _touchY = e.touches[0].clientY
  resetControlHide()
}, { passive: true })
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _touchX
  const dy = e.changedTouches[0].clientY - _touchY
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
    if (dx > 0) prevPhoto(); else nextPhoto()
  }
}, { passive: true })

// ---- Navigation helpers ----

function navigateBack() {
  _fireSlideshowComplete()
  if (isMultiAlbum) {
    window.location.href = '/multi-slideshow.html'
  } else {
    window.location.href = `/album.html?album=${encodeURIComponent(singleAlbumId || '')}`
  }
}

function handleKeyPress(e) {
  if (slides.length === 0) return

  switch (e.key) {
    case 'ArrowRight':
      nextPhoto()
      break
    case 'ArrowLeft':
      prevPhoto()
      break
    case ' ':
      e.preventDefault()
      togglePlayPause()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
    case 'Escape':
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        navigateBack()
      }
      break
  }
}

// Event listeners
prevBtnEl.addEventListener('click', prevPhoto)
nextBtnEl.addEventListener('click', nextPhoto)
playPauseBtnEl.addEventListener('click', togglePlayPause)
fullscreenBtnEl.addEventListener('click', toggleFullscreen)
exitBtnEl.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().then(() => navigateBack())
  } else {
    navigateBack()
  }
})

document.addEventListener('keydown', handleKeyPress)

function updateOrderBtn() {
  if (!orderBtnEl) return
  orderBtnEl.textContent = playOrder === 'random' ? '🔀 Random' : '→ In Order'
}

function updateModeBtn() {
  if (!modeBtnEl) return
  const labels = { mixed: '⚡ Mixed', full: '🖼 Full', collage: '⊞ Collage' }
  modeBtnEl.textContent = labels[viewMode] || '⚡ Mixed'
}

orderBtnEl?.addEventListener('click', () => {
  playOrder = playOrder === 'sequential' ? 'random' : 'sequential'
  updateOrderBtn()
  if (playOrder === 'random') photos = shuffle(photos)
  trackSlideshowModeChange(playOrder)
  rebuildSlides()
  displayPhoto()
})

modeBtnEl?.addEventListener('click', () => {
  const modes = ['mixed', 'full', 'collage']
  viewMode = modes[(modes.indexOf(viewMode) + 1) % modes.length]
  updateModeBtn()
  trackSlideshowModeChange(viewMode)
  rebuildSlides()
  displayPhoto()
})

function initFromUrlParams() {
  const params = new URLSearchParams(window.location.search)
  const orderParam = params.get('order')
  if (orderParam === 'random' || orderParam === 'sequential') playOrder = orderParam
  const modeParam = params.get('mode')
  if (modeParam === 'mixed' || modeParam === 'full' || modeParam === 'collage') viewMode = modeParam
  // autoplay=1 is added by the /share/slideshow serverless shim for social share links
  if (params.get('autoplay') === '1') {
    isPlaying = true
    playPauseBtnEl.textContent = '⏸ Pause'
  }
}

// Load photos on page load — call directly since this is a module script
// at end of <body>, so DOM is already fully parsed when this runs.
initFromUrlParams()
updateOrderBtn()
updateModeBtn()
loadPhotos()

// Analytics: music_play — fires once per session on first successful audio start.
// Uses the native 'play' DOM event so it covers both autoplay and manual resume.
// YouTube / Spotify iframes don't emit a catchable play event here.
audioPlayerEl?.addEventListener('play', () => {
  if (!_musicPlayTracked && _sessionStart) {
    _musicPlayTracked = true
    trackMusicPlay(_trackAlbumId, _getMusicTrackName())
  }
})

shareBtnEl?.addEventListener('click', () => _sharePanel?.open())


// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  clearAutoplay()
  if (hideControlsTimer) clearTimeout(hideControlsTimer)
  if (audioPlayerEl) audioPlayerEl.pause()
  if (slideshowVideoEl) slideshowVideoEl.pause()
})
