import { supabase } from './supabase.js'
import { getUser, onAuthChange, signOut } from './auth.js'
import { escapeHtml } from './utils.js'

const albumGrid = document.getElementById('album-grid')
const loadingMsg = document.getElementById('loading-msg')
const emptyMsg = document.getElementById('empty-msg')
const errorMsg = document.getElementById('error-msg')
const authBtn = document.getElementById('auth-btn')
const uploadLink = document.getElementById('upload-link')
const newAlbumBtn = document.getElementById('new-album-btn')
const privateNotice = document.getElementById('private-notice')

// Modal
const modalBackdrop = document.getElementById('modal-backdrop')
const albumNameInput = document.getElementById('album-name-input')
const isPrivateInput = document.getElementById('is-private-input')
const modalCancel = document.getElementById('modal-cancel')
const modalCreate = document.getElementById('modal-create')
const modalError = document.getElementById('modal-error')

// ── Auth state ──────────────────────────────────────────────
let user = getUser()

function updateNav() {
  if (user) {
    authBtn.textContent = 'Sign Out'
    uploadLink.style.display = 'inline-flex'
    newAlbumBtn.style.display = 'inline-flex'
    privateNotice.style.display = 'none'
  } else {
    authBtn.textContent = 'Sign In'
    uploadLink.style.display = 'none'
    newAlbumBtn.style.display = 'none'
    privateNotice.style.display = 'inline-flex'
  }
}

authBtn.addEventListener('click', async () => {
  if (user) {
    await signOut()
    user = null
    updateNav()
    loadAlbums()
  } else {
    window.location.href = 'login.html'
  }
})

onAuthChange((newUser) => {
  if (user !== newUser) {
    user = newUser
    updateNav()
  }
})

updateNav()

// ── New Album Modal ──────────────────────────────────────────
newAlbumBtn.addEventListener('click', openModal)
modalCancel.addEventListener('click', closeModal)

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal()
})

function openModal() {
  albumNameInput.value = ''
  isPrivateInput.checked = false
  modalError.style.display = 'none'
  modalBackdrop.classList.add('open')
  setTimeout(() => albumNameInput.focus(), 50)
}

function closeModal() {
  modalBackdrop.classList.remove('open')
}

albumNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') modalCreate.click()
})

modalCreate.addEventListener('click', async () => {
  const name = albumNameInput.value.trim()
  if (!name) {
    albumNameInput.focus()
    return
  }

  modalCreate.disabled = true
  modalCreate.textContent = 'Creating…'
  modalError.style.display = 'none'

  const isPrivate = isPrivateInput.checked

  const { data: album, error } = await supabase
    .from('albums')
    .insert({ name, is_private: isPrivate })
    .select('id, name, is_private, created_at')
    .single()

  modalCreate.disabled = false
  modalCreate.textContent = 'Create Album'

  if (error) {
    modalError.textContent = 'Failed to create album: ' + error.message
    modalError.style.display = 'block'
    return
  }

  closeModal()

  // Prepend the new card without reloading
  if (albumGrid.style.display === 'none') {
    albumGrid.style.display = 'grid'
    emptyMsg.style.display = 'none'
  }
  const card = buildCard(album)
  albumGrid.insertBefore(card, albumGrid.firstChild)
})

// ── Load albums ──────────────────────────────────────────────
async function loadAlbums() {
  loadingMsg.style.display = 'block'
  albumGrid.style.display = 'none'
  emptyMsg.style.display = 'none'
  errorMsg.style.display = 'none'
  albumGrid.innerHTML = ''

  const { data: albums, error } = await supabase
    .from('albums')
    .select('id, name, is_private, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    loadingMsg.style.display = 'none'
    errorMsg.textContent = 'Failed to load albums: ' + error.message
    errorMsg.style.display = 'block'
    return
  }

  const visible = user ? albums : albums.filter(a => !a.is_private)

  loadingMsg.style.display = 'none'

  if (!visible || visible.length === 0) {
    emptyMsg.style.display = 'block'
    return
  }

  albumGrid.style.display = 'grid'
  visible.forEach(album => {
    const card = buildCard(album)
    albumGrid.appendChild(card)
    fetchCover(album.id, card)
  })
}

function buildCard(album) {
  const wrap = document.createElement('div')
  wrap.className = 'album-card'
  wrap.style.animation = 'none' // already displayed

  const date = new Date(album.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
  const unlockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`

  wrap.innerHTML = `
    <a href="album.html?id=${album.id}" class="album-cover-link" style="display:contents" aria-label="View album: ${escapeHtml(album.name)}">
      <div class="album-cover" id="cover-${album.id}">
        <div class="album-cover-empty" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        ${album.is_private ? `<div class="album-badge">${lockIcon} Private</div>` : ''}
      </div>
      <div class="album-info">
        <div class="album-info-text">
          <div class="album-name">${escapeHtml(album.name)}</div>
          <div class="album-meta">${date}</div>
        </div>
        ${user ? `<button class="card-privacy-btn ${album.is_private ? 'is-private' : ''}" data-album-id="${album.id}" data-private="${album.is_private}" aria-label="${album.is_private ? 'Make public' : 'Make private'}" title="${album.is_private ? 'Make public' : 'Make private'}">
          ${album.is_private ? lockIcon + ' Private' : unlockIcon + ' Public'}
        </button>` : ''}
      </div>
    </a>
  `

  // Privacy toggle button
  const privBtn = wrap.querySelector('.card-privacy-btn')
  if (privBtn) {
    privBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const albumId = privBtn.dataset.albumId
      const currentlyPrivate = privBtn.dataset.private === 'true'
      const newPrivate = !currentlyPrivate

      privBtn.disabled = true

      const { error } = await supabase
        .from('albums')
        .update({ is_private: newPrivate })
        .eq('id', albumId)

      privBtn.disabled = false

      if (error) {
        alert('Failed to update: ' + error.message)
        return
      }

      // Update button state
      privBtn.dataset.private = String(newPrivate)
      privBtn.className = `card-privacy-btn ${newPrivate ? 'is-private' : ''}`
      privBtn.setAttribute('aria-label', newPrivate ? 'Make public' : 'Make private')
      privBtn.setAttribute('title', newPrivate ? 'Make public' : 'Make private')
      privBtn.innerHTML = newPrivate
        ? lockIcon + ' Private'
        : unlockIcon + ' Public'

      // Update badge on cover
      const cover = document.getElementById(`cover-${albumId}`)
      if (cover) {
        const existing = cover.querySelector('.album-badge')
        if (existing) existing.remove()
        if (newPrivate) {
          const badge = document.createElement('div')
          badge.className = 'album-badge'
          badge.innerHTML = lockIcon + ' Private'
          cover.appendChild(badge)
        }
      }
    })
  }

  fetchCover(album.id, wrap)
  return wrap
}

async function fetchCover(albumId, card) {
  const { data, error } = await supabase
    .from('photos')
    .select('file_path')
    .eq('album_id', albumId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) return

  // Using transform to optimize cover image loading
  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data[0].file_path, {
    transform: {
      width: 400,
      height: 300,
      resize: 'cover'
    }
  })
  
  const coverEl = document.getElementById(`cover-${albumId}`)
  if (!coverEl) return

  const img = document.createElement('img')
  img.src = urlData.publicUrl
  img.alt = ''
  img.loading = 'lazy'
  img.width = 400
  img.height = 300
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;'
  img.addEventListener('load', () => {
    coverEl.querySelector('.album-cover-empty')?.remove()
    coverEl.insertBefore(img, coverEl.firstChild)
  })
  coverEl.style.position = 'relative'
}

loadAlbums()
