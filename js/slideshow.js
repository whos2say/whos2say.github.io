import { supabase } from './supabase.js'

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

let photos = []
let currentPhotoIndex = 0
let isPlaying = false
let autoplayTimeout = null
let audioUrl = null
let hideControlsTimer = null
// Track whether we are in multi-album mode
let isMultiAlbum = false
// Track the single album ID for back-navigation (single mode only)
let singleAlbumId = null

const AUTOPLAY_DELAY = 4000 // 4 seconds
const COLLAGE_INTERVAL = 2 // Show collage every other slide

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

async function loadPhotos() {
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
        .select('id, file_path, created_at, focal_point')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false })

      if (photosError) throw photosError

      if (photosData && photosData.length > 0) {
        combinedPhotos = combinedPhotos.concat(photosData)
      }
    }

    if (combinedPhotos.length === 0) {
      showEmptyState('No photos in the selected albums')
      return
    }

    // Multi-album: shuffle combined photos; single album: keep chronological order
    photos = isMultiAlbum ? shuffle(combinedPhotos) : combinedPhotos

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

    currentPhotoIndex = 0
    displayPhoto()
    updateUI()
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
  // Every 4th photo (indices 3, 7, 11, etc.) should be a collage
  return (currentPhotoIndex + 1) % COLLAGE_INTERVAL === 0
}

function generateCollage() {
  // Pick a layout whose slot count fits the number of available photos
  const validLayouts = COLLAGE_LAYOUTS.filter(l => l.count <= photos.length)
  const layout = validLayouts[Math.floor(Math.random() * validLayouts.length)]

  // Shuffle photos and take as many as the layout needs
  const shuffled = [...photos].sort(() => Math.random() - 0.5)
  const collagePhotos = shuffled.slice(0, layout.count)

  // Apply the grid template
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
  if (photos.length === 0) return

  if (isCollageSlide()) {
    // Show collage instead of single photo
    slideShowImageEl.style.display = 'none'
    collageViewerEl.style.display = 'block'
    generateCollage()
  } else {
    // Show single photo
    collageViewerEl.style.display = 'none'
    slideShowImageEl.style.display = 'block'

    const photo = photos[currentPhotoIndex]
    const publicUrl = supabase.storage
      .from('photos')
      .getPublicUrl(photo.file_path).data.publicUrl

    slideShowImageEl.src = publicUrl
    slideShowImageEl.alt = `Photo ${currentPhotoIndex + 1} of ${photos.length}`

    // Scale based on resolution
    scaleImageForDisplay()
  }

  updateCounter()
  resetProgress()
}

function scaleImageForDisplay() {
  // Check if screen resolution supports HQ 1080x720
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  if (screenWidth >= 1080 && screenHeight >= 720) {
    // Scale for HQ display
    slideShowImageEl.style.maxWidth = '1080px'
    slideShowImageEl.style.maxHeight = '720px'
  } else {
    // Use full viewport
    slideShowImageEl.style.maxWidth = '100vw'
    slideShowImageEl.style.maxHeight = '100vh'
  }
}

function updateCounter() {
  if (isCollageSlide()) {
    photoCounterEl.textContent = `Collage / ${photos.length}`
  } else {
    photoCounterEl.textContent = `${currentPhotoIndex + 1} / ${photos.length}`
  }
}

function nextPhoto() {
  if (photos.length === 0) return
  resetControlHide()
  currentPhotoIndex = (currentPhotoIndex + 1) % photos.length
  displayPhoto()
  resetAutoplay()
}

function prevPhoto() {
  if (photos.length === 0) return
  resetControlHide()
  currentPhotoIndex = (currentPhotoIndex - 1 + photos.length) % photos.length
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
  if (!isPlaying || photos.length === 0) return

  autoplayTimeout = setTimeout(() => {
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
  prevBtnEl.disabled = photos.length <= 1
  nextBtnEl.disabled = photos.length <= 1
  updatePlayPauseButton()
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

// ---- Navigation helpers ----

function navigateBack() {
  if (isMultiAlbum) {
    window.location.href = '/multi-slideshow.html'
  } else {
    window.location.href = `/album.html?album=${encodeURIComponent(singleAlbumId || '')}`
  }
}

function handleKeyPress(e) {
  if (photos.length === 0) return

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

// Handle window resize for scaling
window.addEventListener('resize', () => {
  if (photos.length > 0 && !isCollageSlide()) {
    scaleImageForDisplay()
  }
})

// Load photos on page load — call directly since this is a module script
// at end of <body>, so DOM is already fully parsed when this runs.
loadPhotos()

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  clearAutoplay()
  if (hideControlsTimer) clearTimeout(hideControlsTimer)
  if (audioPlayerEl) {
    audioPlayerEl.pause()
  }
})
