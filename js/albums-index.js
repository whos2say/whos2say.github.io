import { supabase } from './supabase.js'

const albumsGridEl = document.getElementById('albums-grid')
const emptyStateEl = document.getElementById('albums-empty')
const createSectionEl = document.getElementById('create-album-section')
const createFormEl = document.getElementById('create-album-form')
const albumNameInputEl = document.getElementById('album-name-input')
const createMessageEl = document.getElementById('create-message')

async function loadAlbums() {
  try {
    const { data: albums, error } = await supabase
      .from('albums')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!albums || albums.length === 0) {
      emptyStateEl.textContent = 'No albums yet. Create one to get started!'
      emptyStateEl.style.display = 'block'
      albumsGridEl.innerHTML = '<div id="albums-empty" class="albums-empty" style="grid-column: 1 / -1;"></div>'
      emptyStateEl = albumsGridEl.querySelector('#albums-empty')
      emptyStateEl.textContent = 'No albums yet. Create one to get started!'
      return
    }

    emptyStateEl.style.display = 'none'
    albumsGridEl.innerHTML = ''

    // Fetch cover photo for each album
    for (const album of albums) {
      const { data: photos, error: photoError } = await supabase
        .from('photos')
        .select('id, file_path')
        .eq('album_id', album.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const card = document.createElement('div')
      card.className = 'album-card'
      card.style.animationDelay = `${albums.indexOf(album) * 0.05}s`

      const createdDate = new Date(album.created_at).toLocaleDateString()
      let coverHtml = ''

      if (photos && photos.length > 0) {
        const publicUrl = supabase.storage
          .from('photos')
          .getPublicUrl(photos[0].file_path).data.publicUrl
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
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      createSectionEl.style.display = 'block'
    } else {
      createSectionEl.style.display = 'none'
    }
  } catch (err) {
    console.error('Auth check error:', err)
    createSectionEl.style.display = 'none'
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

// Initialize
createFormEl.addEventListener('submit', handleCreateAlbum)
checkAuth()
loadAlbums()
