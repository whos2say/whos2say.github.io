import { supabase } from './supabase.js'

const mainContent = document.getElementById('main-content')
const loadingMsg = document.getElementById('loading-msg')
const authBtn = document.getElementById('auth-btn')
const albumSelect = document.getElementById('album-select')
const newAlbumBtn = document.getElementById('new-album-btn')
const newAlbumForm = document.getElementById('new-album-form')
const albumNameInput = document.getElementById('album-name')
const isPrivateToggle = document.getElementById('is-private-toggle')
const createAlbumBtn = document.getElementById('create-album-btn')
const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const fileList = document.getElementById('file-list')
const uploadBtn = document.getElementById('upload-btn')
const uploadMessage = document.getElementById('upload-message')

// ── Auth guard ───────────────────────────────────────────────────
const { data: { session } } = await supabase.auth.getSession()
let user = session?.user ?? null

if (!user) {
  window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  throw new Error('Not authenticated')
}

loadingMsg.style.display = 'none'
mainContent.style.display = 'block'

authBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
})

supabase.auth.onAuthStateChange((_event, s) => {
  if (!s?.user) window.location.href = 'login.html'
})

// ── Load albums ──────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search)
const preselectedAlbum = urlParams.get('album')

async function loadAlbums() {
  const { data: albums, error } = await supabase
    .from('albums')
    .select('id, name, is_private')
    .order('created_at', { ascending: false })

  if (error) {
    albumSelect.innerHTML = '<option value="">Failed to load albums</option>'
    return
  }

  albumSelect.innerHTML = albums.length === 0
    ? '<option value="">No albums yet — create one below</option>'
    : albums.map(a =>
        `<option value="${a.id}"${a.id === preselectedAlbum ? ' selected' : ''}>
          ${escapeHtml(a.name)}${a.is_private ? ' 🔒' : ''}
        </option>`
      ).join('')

  if (albums.length === 0) {
    // Auto-open the new album form
    showNewAlbumForm()
  }
}

loadAlbums()

// ── New album form ───────────────────────────────────────────────
newAlbumBtn.addEventListener('click', () => {
  if (newAlbumForm.classList.contains('visible')) {
    newAlbumForm.classList.remove('visible')
    newAlbumBtn.textContent = '+ New Album'
  } else {
    showNewAlbumForm()
  }
})

function showNewAlbumForm() {
  newAlbumForm.classList.add('visible')
  newAlbumBtn.textContent = '− Cancel'
  albumNameInput.focus()
}

createAlbumBtn.addEventListener('click', async () => {
  const name = albumNameInput.value.trim()
  if (!name) {
    albumNameInput.focus()
    return
  }

  createAlbumBtn.disabled = true
  createAlbumBtn.textContent = 'Creating…'

  const isPrivate = isPrivateToggle.checked

  const { data: album, error } = await supabase
    .from('albums')
    .insert({ name, is_private: isPrivate })
    .select('id, name, is_private')
    .single()

  if (error) {
    showMessage('Failed to create album: ' + error.message, 'error')
    createAlbumBtn.disabled = false
    createAlbumBtn.textContent = 'Create Album'
    return
  }

  // Add to select and choose it
  const option = document.createElement('option')
  option.value = album.id
  option.textContent = album.name + (album.is_private ? ' 🔒' : '')
  option.selected = true
  albumSelect.insertBefore(option, albumSelect.firstChild)

  // Reset form
  albumNameInput.value = ''
  isPrivateToggle.checked = false
  newAlbumForm.classList.remove('visible')
  newAlbumBtn.textContent = '+ New Album'
  createAlbumBtn.disabled = false
  createAlbumBtn.textContent = 'Create Album'
})

// ── File selection ───────────────────────────────────────────────
let selectedFiles = []

fileInput.addEventListener('change', () => {
  addFiles(Array.from(fileInput.files))
  fileInput.value = '' // reset so same files can be re-added if needed
})

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropZone.classList.add('drag-over')
})

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over')
})

dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropZone.classList.remove('drag-over')
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  addFiles(files)
})

function addFiles(files) {
  selectedFiles = [...selectedFiles, ...files]
  renderFileList()
  uploadBtn.disabled = selectedFiles.length === 0
  hideMessage()
}

function renderFileList() {
  fileList.innerHTML = ''
  selectedFiles.forEach((file, i) => {
    const item = document.createElement('div')
    item.className = 'file-item'
    item.id = `file-item-${i}`
    item.innerHTML = `
      <span class="file-item-name">${escapeHtml(file.name)}</span>
      <span class="file-item-size">${formatSize(file.size)}</span>
      <span class="file-item-status" id="file-status-${i}">Queued</span>
    `
    fileList.appendChild(item)
  })
}

// ── Upload ───────────────────────────────────────────────────────
uploadBtn.addEventListener('click', uploadFiles)

async function uploadFiles() {
  const albumId = albumSelect.value
  if (!albumId) {
    showMessage('Please select or create an album first.', 'error')
    return
  }

  if (selectedFiles.length === 0) {
    showMessage('Please choose at least one photo.', 'error')
    return
  }

  uploadBtn.disabled = true
  uploadBtn.textContent = 'Uploading…'
  hideMessage()

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i]
    const statusEl = document.getElementById(`file-status-${i}`)
    if (statusEl) { statusEl.textContent = 'Uploading…'; statusEl.className = 'file-item-status uploading' }

    const sanitizedName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '-').replace(/-+/g, '-')
    const filePath = `${albumId}/${Date.now()}-${sanitizedName}`

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      if (statusEl) { statusEl.textContent = 'Failed'; statusEl.className = 'file-item-status error' }
      errorCount++
      continue
    }

    const { error: dbError } = await supabase
      .from('photos')
      .insert({ album_id: albumId, file_path: filePath, uploaded_by: user.id })

    if (dbError) {
      if (statusEl) { statusEl.textContent = 'DB error'; statusEl.className = 'file-item-status error' }
      errorCount++
      continue
    }

    if (statusEl) { statusEl.textContent = '✓ Done'; statusEl.className = 'file-item-status done' }
    successCount++
  }

  uploadBtn.textContent = 'Upload Photos'

  if (errorCount === 0) {
    showMessage(`${successCount} photo${successCount !== 1 ? 's' : ''} uploaded successfully.`, 'success')
    selectedFiles = []
    fileList.innerHTML = ''
    uploadBtn.disabled = true
  } else {
    uploadBtn.disabled = false
    const msg = `${successCount} uploaded, ${errorCount} failed. Check the list above.`
    showMessage(msg, 'error')
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function showMessage(text, type) {
  uploadMessage.textContent = text
  uploadMessage.className = `message ${type}`
  uploadMessage.style.display = 'block'
}

function hideMessage() {
  uploadMessage.style.display = 'none'
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
