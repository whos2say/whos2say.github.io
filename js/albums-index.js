import { supabase } from './supabase.js'

const albumsGridEl = document.getElementById('albums-grid')
const emptyStateEl = document.getElementById('albums-empty')
const createSectionEl = document.getElementById('create-album-section')
const createFormEl = document.getElementById('create-album-form')
const albumNameInputEl = document.getElementById('album-name-input')
const createMessageEl = document.getElementById('create-message')

let userIsAdmin = false
let userIsLoggedIn = false

// --- Album drag-to-reorder (admin only) ---
// SQL required: ALTER TABLE albums ADD COLUMN IF NOT EXISTS sort_order INTEGER;
let dragSrcAlbumId = null

function initAlbumDragAndDrop() {
  document.querySelectorAll('.album-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', onAlbumDragStart)
    card.addEventListener('dragover',  onAlbumDragOver)
    card.addEventListener('dragleave', onAlbumDragLeave)
    card.addEventListener('drop',      onAlbumDrop)
    card.addEventListener('dragend',   onAlbumDragEnd)
  })
}

function onAlbumDragStart(e) {
  dragSrcAlbumId = this.dataset.albumId
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', dragSrcAlbumId)
  requestAnimationFrame(() => this.classList.add('dragging'))
}

function onAlbumDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (this.dataset.albumId !== dragSrcAlbumId) this.classList.add('drag-over')
}

function onAlbumDragLeave() {
  this.classList.remove('drag-over')
}

async function onAlbumDrop(e) {
  e.preventDefault()
  this.classList.remove('drag-over')
  const targetId = this.dataset.albumId
  if (!targetId || targetId === dragSrcAlbumId) return

  const grid = document.getElementById('albums-grid')
  const srcCard = grid.querySelector(`[data-album-id="${dragSrcAlbumId}"]`)
  const tgtCard = this
  if (!srcCard || !tgtCard) return

  const cards = [...grid.querySelectorAll('.album-card')]
  const srcIdx = cards.indexOf(srcCard)
  const tgtIdx = cards.indexOf(tgtCard)

  if (srcIdx < tgtIdx) tgtCard.insertAdjacentElement('afterend', srcCard)
  else tgtCard.insertAdjacentElement('beforebegin', srcCard)

  await saveAlbumOrder()
}

function onAlbumDragEnd() {
  this.classList.remove('dragging')
  document.querySelectorAll('.album-card').forEach(c => c.classList.remove('drag-over'))
  dragSrcAlbumId = null
}

async function saveAlbumOrder() {
  const grid = document.getElementById('albums-grid')
  const cards = [...grid.querySelectorAll('.album-card')]
  try {
    await Promise.all(
      cards.map((card, idx) =>
        supabase.from('albums').update({ sort_order: idx }).eq('id', card.dataset.albumId)
      )
    )
    // Brief visual confirmation
    const msg = document.createElement('div')
    msg.style.cssText = 'position:fixed;top:1rem;right:1rem;background:#51cf66;color:#0a0a0a;padding:.5rem 1rem;border-radius:6px;font-weight:700;z-index:9999;font-family:var(--font-body)'
    msg.textContent = '✓ Album order saved'
    document.body.appendChild(msg)
    setTimeout(() => msg.remove(), 2000)
  } catch (err) {
    alert('Failed to save order: ' + err.message)
  }
}

async function loadAlbums() {
  try {
    const { data: albums, error } = await supabase
      .from('albums')
      .select('id, name, created_at, cover_photo_id')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!albums || albums.length === 0) {
      if (userIsLoggedIn) {
        emptyStateEl.innerHTML = `
          <p>No albums yet.</p>
          <button class="btn btn-primary btn-create-first" onclick="document.getElementById('album-name-input').focus(); document.getElementById('create-album-section').scrollIntoView({behavior:'smooth'})">
            + Create Your First Album
          </button>`
      } else {
        emptyStateEl.innerHTML = '<p>No albums yet.</p>'
      }
      emptyStateEl.style.display = 'block'
      return
    }

    emptyStateEl.style.display = 'none'
    albumsGridEl.innerHTML = ''

    for (const album of albums) {
      let coverFilePath = null
      let coverFocalPoint = '50% 35%'

      if (album.cover_photo_id) {
        // Use the designated cover photo
        const { data: coverPhoto } = await supabase
          .from('photos')
          .select('file_path, focal_point')
          .eq('id', album.cover_photo_id)
          .single()
        coverFilePath = coverPhoto?.file_path || null
        coverFocalPoint = coverPhoto?.focal_point || '50% 35%'
      }

      if (!coverFilePath) {
        // Fall back to most recent photo
        const { data: photos } = await supabase
          .from('photos')
          .select('file_path, focal_point')
          .eq('album_id', album.id)
          .order('created_at', { ascending: false })
          .limit(1)
        coverFilePath = photos?.[0]?.file_path || null
        coverFocalPoint = photos?.[0]?.focal_point || '50% 35%'
      }

      const card = document.createElement('div')
      card.className = 'album-card'
      card.style.animationDelay = `${albums.indexOf(album) * 0.05}s`

      const createdDate = new Date(album.created_at).toLocaleDateString()
      let coverHtml = ''

      if (coverFilePath) {
        const publicUrl = supabase.storage.from('photos').getPublicUrl(coverFilePath).data.publicUrl
        coverHtml = `<div class="album-cover"><img src="${publicUrl}" alt="Album cover" loading="lazy" width="280" height="160" style="object-position:${coverFocalPoint}" /></div>`
      } else {
        coverHtml = `<div class="album-cover"><div class="album-cover-placeholder">📷</div></div>`
      }

      card.dataset.albumId = album.id

      card.innerHTML = `
        ${coverHtml}
        <div class="album-info">
          <h3>${escapeHtml(album.name)}</h3>
          <p>Created ${createdDate}</p>
          <a href="/album.html?album=${encodeURIComponent(album.id)}">View Album</a>
        </div>
      `

      if (userIsAdmin) {
        card.draggable = true

        const handle = document.createElement('div')
        handle.className = 'album-drag-handle'
        handle.title = 'Drag to reorder'
        handle.textContent = '⠿'
        card.appendChild(handle)

        const deleteBtn = document.createElement('button')
        deleteBtn.className = 'album-delete-btn'
        deleteBtn.textContent = '🗑 Delete Album'
        deleteBtn.addEventListener('click', e => {
          e.preventDefault()
          e.stopPropagation()
          deleteAlbum(album.id, album.name)
        })
        card.querySelector('.album-info').appendChild(deleteBtn)
      }

      albumsGridEl.appendChild(card)
    }
    if (userIsAdmin) initAlbumDragAndDrop()

  } catch (err) {
    console.error('Error loading albums:', err)
    emptyStateEl.textContent = 'Error loading albums'
    emptyStateEl.style.display = 'block'
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function checkAuth() {
  const authEl = document.getElementById('auth-header-action')
  try {
    const { data: { user } } = await supabase.auth.getUser()
    userIsAdmin = user?.email === 'joe@whostosay.org'
    userIsLoggedIn = !!user
    createSectionEl.style.display = user ? 'block' : 'none'
    if (authEl) {
      if (user) {
        authEl.innerHTML = `
          <span style="font-family:var(--font-body);font-size:0.85rem;color:var(--text-muted);margin-right:var(--space-2)">${escapeHtml(user.email)}</span>
          <button id="sign-out-btn" class="btn btn-primary" style="background:transparent;border-color:#ff6b6b;color:#ff6b6b">Sign Out</button>`
        document.getElementById('sign-out-btn').addEventListener('click', signOut)
      } else {
        authEl.innerHTML = `<a href="/login.html" class="btn btn-primary">Sign In</a>`
      }
    }
  } catch (err) {
    console.error('Auth check error:', err)
    createSectionEl.style.display = 'none'
  }
}

async function signOut() {
  await supabase.auth.signOut()
  window.location.reload()
}

async function deleteAlbum(albumId, albumName) {
  if (!confirm(`Delete "${albumName}" and ALL its photos? This cannot be undone.`)) return
  try {
    // 1. Fetch all photo file paths
    const { data: photos } = await supabase
      .from('photos').select('file_path').eq('album_id', albumId)

    // 2. Remove storage files
    if (photos && photos.length > 0) {
      await supabase.storage.from('photos').remove(photos.map(p => p.file_path))
    }

    // 3. Delete photo records
    await supabase.from('photos').delete().eq('album_id', albumId)

    // 4. Delete album record
    const { data, error } = await supabase
      .from('albums').delete().eq('id', albumId).select('id')

    if (error) throw error
    if (!data || !data.length) throw new Error('Delete blocked — add admin DELETE policy for albums in Supabase')

    loadAlbums()
  } catch (err) {
    console.error('Delete album error:', err)
    alert(`Failed to delete album: ${err.message}`)
  }
}

async function handleCreateAlbum(e) {
  e.preventDefault()
  const albumName = albumNameInputEl.value.trim()

  if (!albumName) {
    createMessageEl.textContent = 'Please enter an album name'
    createMessageEl.style.color = '#ff6b6b'
    return
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login.html'
      return
    }

    createMessageEl.textContent = 'Creating album...'
    createMessageEl.style.color = 'var(--text-muted)'

    const { data: newAlbum, error } = await supabase
      .from('albums')
      .insert([{ name: albumName }])
      .select()

    if (error) throw error

    createMessageEl.textContent = '✓ Album created!'
    createMessageEl.style.color = '#51cf66'
    albumNameInputEl.value = ''

    // Reload albums list
    setTimeout(loadAlbums, 500)
  } catch (err) {
    console.error('Album creation error:', err)
    createMessageEl.textContent = err.message || 'Failed to create album'
    createMessageEl.style.color = '#ff6b6b'
  }
}

// --- Gallery title size (S/M/L) — admin only ---
// SQL required:
//   CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
//   ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "settings_read" ON site_settings FOR SELECT USING (true);
//   CREATE POLICY "settings_write" ON site_settings FOR ALL USING (auth.email() = 'joe@whostosay.org');

const GALLERY_SIZES = { sm: '1.2rem', md: '1.8rem', lg: '2.5rem' }

function applyGalleryTitleSize(size) {
  const h1 = document.getElementById('gallery-title')
  if (h1 && GALLERY_SIZES[size]) h1.style.fontSize = GALLERY_SIZES[size]
  document.querySelectorAll('.title-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size)
  })
}

async function loadGalleryTitleSize() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'gallery_title_size')
      .single()
    if (!error && data?.value) applyGalleryTitleSize(data.value)
  } catch {
    // site_settings table may not exist yet — silently ignore
  }
}

async function saveGalleryTitleSize(size) {
  if (!userIsAdmin) return
  try {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'gallery_title_size', value: size })
    if (error) throw error
    applyGalleryTitleSize(size)
  } catch (err) {
    alert('Failed to save title size: ' + err.message)
  }
}

function renderGalleryTitleSizePicker() {
  const h1 = document.getElementById('gallery-title')
  if (!h1) return
  const picker = document.createElement('div')
  picker.className = 'title-size-btns'
  picker.title = 'Title font size (admin)'
  picker.style.marginLeft = 'var(--space-2)'
  ;['sm', 'md', 'lg'].forEach(size => {
    const btn = document.createElement('button')
    btn.className = 'title-size-btn'
    btn.dataset.size = size
    btn.textContent = size.toUpperCase()[0]
    btn.title = { sm: 'Small', md: 'Medium', lg: 'Large' }[size]
    btn.addEventListener('click', () => saveGalleryTitleSize(size))
    picker.appendChild(btn)
  })
  h1.insertAdjacentElement('afterend', picker)
}

// Initialize — auth must resolve first so userIsAdmin is set before cards render
createFormEl.addEventListener('submit', handleCreateAlbum)
checkAuth().then(() => {
  loadAlbums()
  loadGalleryTitleSize()
  if (userIsAdmin) renderGalleryTitleSizePicker()
})
