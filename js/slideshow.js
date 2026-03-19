import { supabase } from './supabase.js'

const slideShowImageEl = document.getElementById('slideshow-image')
const collageViewerEl = document.getElementById('collage-viewer')
const collageGridEl = document.getElementById('collage-grid')
const photoCounterEl = document.getElementById('photo-counter')
const prevBtnEl = document.getElementById('prev-btn')
const nextBtnEl = document.getElementById('next-btn')
const playPauseBtnEl = document.getElementById('play-pause-btn')
const exitBtnEl = document.getElementById('exit-btn')
const backToAlbumEl = document.getElementById('back-to-album')
const slideshowTitleEl = document.getElementById('slideshow-title')
const emptyStateEl = document.getElementById('empty-state')
const progressBarEl = document.getElementById('slideshow-progress')
const slideshowViewer = document.querySelector('.slideshow-viewer')
const audioControlsEl = document.getElementById('audio-controls')
const audioPlayerEl = document.getElementById('slideshow-audio')
const audioMuteBtn = document.getElementById('audio-mute-btn')

let photos = []
let currentPhotoIndex = 0
let isPlaying = false
let autoplayTimeout = null
let audioUrl = null
const AUTOPLAY_DELAY = 4000 // 4 seconds
const COLLAGE_INTERVAL = 4 // Show collage every 4th photo

function getAlbumId() {
  return new URLSearchParams(window.location.search).get('album') || 
         new URLSearchParams(window.location.search).get('id')
}

async function loadPhotos() {
  const albumId = getAlbumId()
  
  if (!albumId) {
    showEmptyState('Invalid album ID')
    return
  }

  try {
    // Fetch album data including cover_photo_id and music_url
    const { data: albumData, error: albumError } = await supabase
      .from('albums')
      .select('name, cover_photo_id, music_url')
      .eq('id', albumId)
      .single()

    if (albumError) throw albumError

    if (albumData?.name) {
      slideshowTitleEl.textContent = `${albumData.name} - Slideshow`
    }

    // Load music URL if available
    if (albumData?.music_url) {
      audioUrl = albumData.music_url
      setupAudioPlayer()
    }

    // Fetch photos
    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select('id, file_path, created_at')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })

    if (photosError) throw photosError

    if (!photosData || photosData.length === 0) {
      showEmptyState('No photos in this album')
      return
    }

    photos = photosData
    currentPhotoIndex = 0
    displayPhoto()
    updateUI()

    // Set back button href
    backToAlbumEl.href = `/album.html?album=${encodeURIComponent(albumId)}`
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
    audioPlayerEl.style.display = 'block'
    audioPlayerEl.muted = false
    audioMuteBtn.textContent = '🔊'
  }

  audioMuteBtn.addEventListener('click', toggleAudioMute)

  // Try to autoplay after a short delay
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

async function generateCollage() {
  // Select up to 10 random photos from the album (excluding the current set of 4)
  const collageSize = Math.min(10, photos.length)
  const collagePhotos = []
  
  for (let i = 0; i < collageSize; i++) {
    const randomIndex = Math.floor(Math.random() * photos.length)
    collagePhotos.push(photos[randomIndex])
  }

  collageGridEl.innerHTML = ''
  
  for (const photo of collagePhotos) {
    const publicUrl = supabase.storage
      .from('photos')
      .getPublicUrl(photo.file_path).data.publicUrl

    const collageItem = document.createElement('div')
    collageItem.className = 'collage-item'

    const img = document.createElement('img')
    img.src = publicUrl
    img.alt = 'Collage photo'
    img.loading = 'lazy'

    collageItem.appendChild(img)
    collageGridEl.appendChild(collageItem)
  }
}

function displayPhoto() {
  if (photos.length === 0) return

  if (isCollageSlide()) {
    // Show collage instead of single photo
    slideShowImageEl.style.display = 'none'
    collageViewerEl.style.display = 'flex'
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
  const pixelRatio = window.devicePixelRatio || 1

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
  currentPhotoIndex = (currentPhotoIndex + 1) % photos.length
  displayPhoto()
  resetAutoplay()
}

function prevPhoto() {
  if (photos.length === 0) return
  currentPhotoIndex = (currentPhotoIndex - 1 + photos.length) % photos.length
  displayPhoto()
  resetAutoplay()
}

function togglePlayPause() {
  isPlaying = !isPlaying
  updatePlayPauseButton()

  if (isPlaying) {
    // Start audio if available
    if (audioPlayerEl && audioPlayerEl.tagName === 'AUDIO') {
      audioPlayerEl.muted = false
      const playPromise = audioPlayerEl.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log('Audio autoplay blocked:', err)
          // Keep slideshow playing even if audio fails
        })
      }
    }
    scheduleAutoplay()
  } else {
    // Pause audio if playing
    if (audioPlayerEl && audioPlayerEl.tagName === 'AUDIO' && !audioPlayerEl.paused) {
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
    case 'Escape':
      window.location.href = `/album.html?album=${getAlbumId()}`
      break
  }
}

// Event listeners
prevBtnEl.addEventListener('click', prevPhoto)
nextBtnEl.addEventListener('click', nextPhoto)
playPauseBtnEl.addEventListener('click', togglePlayPause)
exitBtnEl.addEventListener('click', () => {
  window.location.href = `/album.html?album=${getAlbumId()}`
})

document.addEventListener('keydown', handleKeyPress)

// Handle window resize for scaling
window.addEventListener('resize', () => {
  if (photos.length > 0 && !isCollageSlide()) {
    scaleImageForDisplay()
  }
})

// Load photos on page load
document.addEventListener('DOMContentLoaded', loadPhotos)

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  clearAutoplay()
  if (audioPlayerEl) {
    audioPlayerEl.pause()
  }
})
