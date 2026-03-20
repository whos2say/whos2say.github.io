import { supabase } from './supabase.js'

const albumsGridEl = document.getElementById('albums-grid')
const emptyStateEl = document.getElementById('albums-empty')
const createSectionEl = document.getElementById('create-album-section')
const createFormEl = document.getElementById('create-album-form')
const albumNameInputEl = document.getElementById('album-name-input')
const createMessageEl = document.getElementById('create-message')

let userIsAdmin = false
let userIsLoggedIn = false

async function loadAlbums() {
  try {
    const { data: albums, error } = await supabase
      .from('albums')
      .select('id, name, created_at, cover_photo_id')
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

      if (album.cover_photo_id) {
        // Use the designated cover photo
        const { data: coverPhoto } = await supabase
          .from('photos')
          .select('file_path')
          .eq('id', album.cover_photo_id)
          .single()
        coverFilePath = coverPhoto?.file_path || null
      }

      if (!coverFilePath) {
        // Fall back to most recent photo
        const { data: photos } = await supabase
          .from('photos')
          .select('file_path')
          .eq('album_id', album.id)
          .order('created_at', { ascending: false })
          .limit(1)
        coverFilePath = photos?.[0]?.file_path || null
      }

      const card = document.createElement('div')
      card.className = 'album-card'
      card.style.animationDelay = `${albums.indexOf(album) * 0.05}s`

      const createdDate = new Date(album.created_at).toLocaleDateString()
      let coverHtml = ''

      if (coverFilePath) {
        const publicUrl = supabase.storage.from('photos').getPublicUrl(coverFilePath).data.publicUrl
        coverHtml = `<div class="album-cover"><img src="${publicUrl}" alt="Album cover" loading="lazy" width="280" height="160" /></div>`
      } else {
        coverHtml = `<div class="album-cover"><div class="album-cover-placeholder">📷</div></div>`
      }

      card.innerHTML = `
        ${coverHtml}
        <div class="album-info">
          <h3>${escapeHtml(album.name)}</h3>
          <p>Created ${createdDate}</p>
          <a href="/album.html?album=${encodeURIComponent(album.id)}">View Album</a>
        </div>
      `

      if (userIsAdmin) {
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

// Initialize — auth must resolve first so userIsAdmin is set before cards render
createFormEl.addEventListener('submit', handleCreateAlbum)
checkAuth().then(() => loadAlbums())
