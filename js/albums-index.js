import { supabase } from './supabase.js'

const albumsGridEl = document.getElementById('albums-grid')
const emptyStateEl = document.getElementById('albums-empty')
const createSectionEl = document.getElementById('create-album-section')
const createFormEl = document.getElementById('create-album-form')
const albumNameInputEl = document.getElementById('album-name-input')
const createMessageEl = document.getElementById('create-message')

let userIsAdmin = false
let userIsLoggedIn = false
let currentUser = null

// --- Admin: album assignment & contributors ---
// SQL required:
//   CREATE TABLE IF NOT EXISTS album_contributors (
//     album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
//     user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//     added_at TIMESTAMPTZ DEFAULT NOW(),
//     PRIMARY KEY (album_id, user_id)
//   );
//   ALTER TABLE album_contributors ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "contrib_admin_all" ON album_contributors USING (auth.email() = 'joe@whostosay.org');
//   CREATE POLICY "contrib_self_read" ON album_contributors FOR SELECT USING (auth.uid() = user_id);
//
//   -- Look up user UUID by email (SECURITY DEFINER to access auth.users)
//   CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email TEXT)
//   RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
//   DECLARE uid UUID;
//   BEGIN SELECT id INTO uid FROM auth.users WHERE email = lookup_email; RETURN uid; END; $$;
//
//   -- Get owner emails for a set of album IDs
//   CREATE OR REPLACE FUNCTION get_album_owner_emails(album_ids UUID[])
//   RETURNS TABLE(album_id UUID, owner_email TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
//   BEGIN RETURN QUERY SELECT a.id, u.email::TEXT FROM albums a
//     LEFT JOIN auth.users u ON a.owner_id = u.id WHERE a.id = ANY(album_ids); END; $$;
//
//   -- Get contributors with emails for one album
//   CREATE OR REPLACE FUNCTION get_album_contributors(p_album_id UUID)
//   RETURNS TABLE(user_id UUID, user_email TEXT, added_at TIMESTAMPTZ) LANGUAGE plpgsql SECURITY DEFINER AS $$
//   BEGIN RETURN QUERY SELECT ac.user_id, u.email::TEXT, ac.added_at FROM album_contributors ac
//     JOIN auth.users u ON ac.user_id = u.id WHERE ac.album_id = p_album_id; END; $$;
//
//   -- Get all users who own at least one album (for admin users panel + dropdown)
//   CREATE OR REPLACE FUNCTION get_album_users()
//   RETURNS TABLE(user_id UUID, user_email TEXT, album_count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
//   BEGIN RETURN QUERY SELECT u.id, u.email::TEXT, COUNT(a.id)::BIGINT
//     FROM auth.users u JOIN albums a ON a.owner_id = u.id
//     GROUP BY u.id, u.email ORDER BY u.email; END; $$;

let ownerEmailMap = {}    // albumId → owner email
let contribCountMap = {}  // albumId → contributor count
let activeModalAlbumId = null
let knownUsers = []       // { user_id, user_email, album_count } — for dropdown + users panel
let adminPreviewMode = false // admin sees page as a regular authenticated user

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
    // SQL required: ALTER TABLE albums ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

    // Non-admin (or admin in preview mode): fetch album IDs where user is a contributor
    let contribIds = []
    if (userIsLoggedIn && (!userIsAdmin || adminPreviewMode) && currentUser) {
      try {
        const { data } = await supabase
          .from('album_contributors')
          .select('album_id')
          .eq('user_id', currentUser.id)
        contribIds = data?.map(r => r.album_id) || []
      } catch { /* table may not exist yet */ }
    }

    let query = supabase
      .from('albums')
      .select('id, name, created_at, cover_photo_id, is_private')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    // Non-admin users (or admin in preview mode) see filtered albums
    if (userIsLoggedIn && (!userIsAdmin || adminPreviewMode) && currentUser) {
      const orParts = [`owner_id.eq.${currentUser.id}`, `owner_id.is.null`]
      if (contribIds.length > 0) orParts.push(`id.in.(${contribIds.join(',')})`)
      query = query.or(orParts.join(','))
    }

    // Public (unauthenticated) visitors never see private albums
    if (!userIsLoggedIn) {
      query = query.eq('is_private', false)
    }

    const { data: albums, error } = await query

    if (error) throw error

    // Admin (not in preview): pre-fetch owner emails and contributor counts
    if (userIsAdmin && !adminPreviewMode && albums?.length > 0) {
      await fetchAdminAlbumData(albums.map(a => a.id))
    }

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

      const privateBadge = album.is_private
        ? `<div class="album-private-badge">🔒 Private</div>`
        : ''

      card.innerHTML = `
        ${coverHtml}
        <div class="album-info">
          ${privateBadge}
          <h3>${escapeHtml(album.name)}</h3>
          <p>Created ${createdDate}</p>
          <a href="/album.html?album=${encodeURIComponent(album.id)}">View Album</a>
        </div>
      `

      if (userIsAdmin && !adminPreviewMode) {
        card.draggable = true

        const handle = document.createElement('div')
        handle.className = 'album-drag-handle'
        handle.title = 'Drag to reorder'
        handle.textContent = '⠿'
        card.appendChild(handle)

        renderAdminAlbumControls(card, album.id, album.name, album.is_private)

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
    if (userIsAdmin && !adminPreviewMode) initAlbumDragAndDrop()

  } catch (err) {
    console.error('Error loading albums:', err)
    emptyStateEl.textContent = 'Error loading albums'
    emptyStateEl.style.display = 'block'
  }
}

// --- Admin: album assignment & contributors ---

async function fetchAdminAlbumData(albumIds) {
  try {
    const [ownerRes, contribRes] = await Promise.all([
      supabase.rpc('get_album_owner_emails', { album_ids: albumIds }),
      supabase.from('album_contributors').select('album_id').in('album_id', albumIds)
    ])
    ownerEmailMap = {}
    ownerRes.data?.forEach(r => { ownerEmailMap[r.album_id] = r.owner_email })
    contribCountMap = {}
    contribRes.data?.forEach(r => {
      contribCountMap[r.album_id] = (contribCountMap[r.album_id] || 0) + 1
    })
  } catch { /* RPC or table may not exist yet */ }
}

function renderAdminAlbumControls(card, albumId, albumName, isPrivate) {
  const ownerEmail = ownerEmailMap[albumId] || null
  const count = contribCountMap[albumId] || 0
  const section = document.createElement('div')
  section.className = 'admin-assignment'
  section.innerHTML = `
    <div class="owner-row">
      <span class="owner-label">Owner:</span>
      <span class="owner-email-display" id="owner-email-${albumId}">${
        ownerEmail ? escapeHtml(ownerEmail) : '<em style="opacity:.45">Unassigned</em>'
      }</span>
      <button class="assign-btn">Assign</button>
    </div>
    <div class="contrib-row">
      <span class="contrib-label">Contributors:</span>
      <span class="contrib-count-display" id="contrib-count-${albumId}">${count || 'None'}</span>
      <button class="contrib-btn">Manage</button>
    </div>
    <div class="owner-row">
      <span class="owner-label">Visibility:</span>
      <span class="owner-email-display" id="privacy-label-${albumId}" style="color:${isPrivate ? '#f59e0b' : 'var(--text-muted)'}">
        ${isPrivate ? '🔒 Private' : '🌐 Public'}
      </span>
      <button class="privacy-toggle-btn ${isPrivate ? 'is-private' : 'is-public'}" id="privacy-btn-${albumId}">
        ${isPrivate ? 'Make Public' : 'Make Private'}
      </button>
    </div>
  `
  section.querySelector('.assign-btn').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation()
    openAssignOwnerModal(albumId, albumName)
  })
  section.querySelector('.contrib-btn').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation()
    openContributorsModal(albumId, albumName)
  })
  section.querySelector(`#privacy-btn-${albumId}`).addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation()
    toggleAlbumPrivacy(albumId, isPrivate, card)
  })
  card.querySelector('.album-info').appendChild(section)
}

async function toggleAlbumPrivacy(albumId, currentlyPrivate, card) {
  const newPrivate = !currentlyPrivate
  const btn = document.getElementById(`privacy-btn-${albumId}`)
  const label = document.getElementById(`privacy-label-${albumId}`)
  if (btn) { btn.disabled = true; btn.textContent = '…' }

  const { error } = await supabase.from('albums').update({ is_private: newPrivate }).eq('id', albumId)

  if (error) {
    alert('Failed to update visibility: ' + error.message)
    if (btn) { btn.disabled = false; btn.textContent = currentlyPrivate ? 'Make Public' : 'Make Private' }
    return
  }

  // Update badge on card
  const badgeEl = card.querySelector('.album-private-badge')
  if (newPrivate) {
    if (!badgeEl) {
      const h3 = card.querySelector('h3')
      const badge = document.createElement('div')
      badge.className = 'album-private-badge'
      badge.textContent = '🔒 Private'
      h3.before(badge)
    }
  } else {
    badgeEl?.remove()
  }

  // Update label + button
  if (label) {
    label.style.color = newPrivate ? '#f59e0b' : 'var(--text-muted)'
    label.textContent = newPrivate ? '🔒 Private' : '🌐 Public'
  }
  if (btn) {
    btn.disabled = false
    btn.textContent = newPrivate ? 'Make Public' : 'Make Private'
    btn.className = `privacy-toggle-btn ${newPrivate ? 'is-private' : 'is-public'}`
    // Update the closure reference for next click
    btn.replaceWith(btn.cloneNode(true))
    const newBtn = document.getElementById(`privacy-btn-${albumId}`)
    newBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation()
      toggleAlbumPrivacy(albumId, newPrivate, card)
    })
  }
}

// -- Assign Owner Modal --

function openAssignOwnerModal(albumId, albumName) {
  activeModalAlbumId = albumId
  document.getElementById('ao-subtitle').textContent = albumName
  const email = ownerEmailMap[albumId] || null
  document.getElementById('ao-current').textContent = email || 'Unassigned'
  document.getElementById('ao-email').value = email || ''
  setModalMsg('ao-msg', '')
  document.getElementById('assign-owner-modal').classList.add('show')
  document.getElementById('ao-email').focus()
}

function closeAssignOwnerModal() {
  document.getElementById('assign-owner-modal').classList.remove('show')
  activeModalAlbumId = null
}

async function doAssignOwner() {
  const albumId = activeModalAlbumId
  const email = document.getElementById('ao-email').value.trim()
  if (!email) { setModalMsg('ao-msg', 'Enter an email address', true); return }
  setModalMsg('ao-msg', 'Looking up user…')
  try {
    const { data: uid, error: e1 } = await supabase.rpc('get_user_id_by_email', { lookup_email: email })
    if (e1) throw e1
    if (!uid) { setModalMsg('ao-msg', 'No account found for that email', true); return }
    const { error: e2 } = await supabase.from('albums').update({ owner_id: uid }).eq('id', albumId)
    if (e2) throw e2
    ownerEmailMap[albumId] = email
    updateOwnerDisplay(albumId, email)
    document.getElementById('ao-current').textContent = email
    setModalMsg('ao-msg', '✓ Owner assigned', false, '#51cf66')
  } catch (err) {
    setModalMsg('ao-msg', err.message || 'Failed', true)
  }
}

async function doRemoveOwner() {
  const albumId = activeModalAlbumId
  setModalMsg('ao-msg', 'Removing…')
  try {
    const { error } = await supabase.from('albums').update({ owner_id: null }).eq('id', albumId)
    if (error) throw error
    delete ownerEmailMap[albumId]
    updateOwnerDisplay(albumId, null)
    document.getElementById('ao-current').textContent = 'Unassigned'
    document.getElementById('ao-email').value = ''
    setModalMsg('ao-msg', '✓ Owner removed', false, '#51cf66')
  } catch (err) {
    setModalMsg('ao-msg', err.message || 'Failed', true)
  }
}

function updateOwnerDisplay(albumId, email) {
  const el = document.getElementById(`owner-email-${albumId}`)
  if (el) el.innerHTML = email ? escapeHtml(email) : '<em style="opacity:.45">Unassigned</em>'
}

// -- Contributors Modal --

async function openContributorsModal(albumId, albumName) {
  activeModalAlbumId = albumId
  document.getElementById('cm-subtitle').textContent = albumName
  document.getElementById('cm-email').value = ''
  setModalMsg('cm-msg', '')
  document.getElementById('contributors-modal').classList.add('show')
  await loadContributors(albumId)
}

function closeContributorsModal() {
  document.getElementById('contributors-modal').classList.remove('show')
  activeModalAlbumId = null
}

async function loadContributors(albumId) {
  const listEl = document.getElementById('cm-list')
  listEl.innerHTML = '<div class="cm-empty">Loading…</div>'
  try {
    const { data, error } = await supabase.rpc('get_album_contributors', { p_album_id: albumId })
    if (error) throw error
    if (!data?.length) {
      listEl.innerHTML = '<div class="cm-empty">No contributors yet</div>'
      return
    }
    listEl.innerHTML = ''
    data.forEach(c => {
      const item = document.createElement('div')
      item.className = 'cm-item'
      item.innerHTML = `<span class="cm-item-email">${escapeHtml(c.user_email)}</span><button class="cm-item-remove">Remove</button>`
      item.querySelector('.cm-item-remove').addEventListener('click', () => doRemoveContributor(albumId, c.user_id, item))
      listEl.appendChild(item)
    })
    contribCountMap[albumId] = data.length
    updateContribCount(albumId)
  } catch (err) {
    listEl.innerHTML = `<div class="cm-empty" style="color:#ff6b6b">${err.message}</div>`
  }
}

async function doAddContributor() {
  const albumId = activeModalAlbumId
  const email = document.getElementById('cm-email').value.trim()
  if (!email) { setModalMsg('cm-msg', 'Enter an email address', true); return }
  setModalMsg('cm-msg', 'Adding…')
  try {
    const { data: uid, error: e1 } = await supabase.rpc('get_user_id_by_email', { lookup_email: email })
    if (e1) throw e1
    if (!uid) { setModalMsg('cm-msg', 'No account found for that email', true); return }
    const { error: e2 } = await supabase.from('album_contributors').insert({ album_id: albumId, user_id: uid })
    if (e2) {
      if (e2.code === '23505') { setModalMsg('cm-msg', 'Already a contributor', true); return }
      throw e2
    }
    document.getElementById('cm-email').value = ''
    setModalMsg('cm-msg', '✓ Contributor added', false, '#51cf66')
    await loadContributors(albumId)
  } catch (err) {
    setModalMsg('cm-msg', err.message || 'Failed', true)
  }
}

async function doRemoveContributor(albumId, userId, itemEl) {
  try {
    const { error } = await supabase.from('album_contributors').delete()
      .eq('album_id', albumId).eq('user_id', userId)
    if (error) throw error
    itemEl.remove()
    contribCountMap[albumId] = Math.max(0, (contribCountMap[albumId] || 1) - 1)
    updateContribCount(albumId)
    const listEl = document.getElementById('cm-list')
    if (!listEl.querySelector('.cm-item')) listEl.innerHTML = '<div class="cm-empty">No contributors yet</div>'
    setModalMsg('cm-msg', '✓ Removed', false, '#51cf66')
  } catch (err) {
    setModalMsg('cm-msg', err.message || 'Failed', true)
  }
}

function updateContribCount(albumId) {
  const el = document.getElementById(`contrib-count-${albumId}`)
  if (el) el.textContent = contribCountMap[albumId] || 'None'
}

function setModalMsg(id, text, isError = false, color = null) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = text
  el.style.color = color || (isError ? '#ff6b6b' : 'var(--text-muted)')
}

// --- Admin: registered users panel & dropdown ---

async function loadAdminUsers() {
  const panel = document.getElementById('admin-users-panel')
  if (!panel) return
  panel.style.display = 'block'
  const listEl = document.getElementById('admin-users-list')
  try {
    const { data, error } = await supabase.rpc('get_album_users')
    if (error) throw error
    knownUsers = data || []
    populateUserDropdown()
    if (!knownUsers.length) {
      listEl.innerHTML = '<p class="users-empty">No users with albums yet.</p>'
      return
    }
    const table = document.createElement('table')
    table.className = 'users-table'
    table.innerHTML = `<thead><tr><th>Email</th><th>Albums</th></tr></thead>`
    const tbody = document.createElement('tbody')
    knownUsers.forEach(u => {
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${escapeHtml(u.user_email)}</td><td>${u.album_count}</td>`
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    listEl.innerHTML = ''
    listEl.appendChild(table)
  } catch (err) {
    listEl.innerHTML = `<p class="users-empty" style="color:#ff6b6b">${err.message}</p>`
  }
}

function populateUserDropdown() {
  const dl = document.getElementById('known-users-datalist')
  if (!dl) return
  dl.innerHTML = knownUsers.map(u => `<option value="${escapeHtml(u.user_email)}">`).join('')
}

function initAssignmentModals() {
  document.getElementById('ao-close').addEventListener('click', closeAssignOwnerModal)
  document.getElementById('ao-assign-btn').addEventListener('click', doAssignOwner)
  document.getElementById('ao-remove-btn').addEventListener('click', doRemoveOwner)
  document.getElementById('ao-email').addEventListener('keydown', e => { if (e.key === 'Enter') doAssignOwner() })
  document.getElementById('assign-owner-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAssignOwnerModal()
  })

  document.getElementById('cm-close').addEventListener('click', closeContributorsModal)
  document.getElementById('cm-add-btn').addEventListener('click', doAddContributor)
  document.getElementById('cm-email').addEventListener('keydown', e => { if (e.key === 'Enter') doAddContributor() })
  document.getElementById('contributors-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeContributorsModal()
  })
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
    currentUser = user || null
    userIsAdmin = user?.email === 'joe@whostosay.org'
    userIsLoggedIn = !!user
    createSectionEl.style.display = user ? 'block' : 'none'

    // Update gallery title
    const titleEl = document.getElementById('gallery-title')
    if (titleEl && user && !userIsAdmin) {
      titleEl.textContent = 'Your Gallery'
    }
    if (authEl) {
      if (user) {
        authEl.innerHTML = `
          <span style="font-family:var(--font-body);font-size:0.85rem;color:var(--text-muted);margin-right:var(--space-2)">${escapeHtml(user.email)}</span>
          ${userIsAdmin ? `<button id="preview-mode-btn" class="btn btn-primary" style="background:transparent;border-color:var(--color-primary);color:var(--color-primary);margin-right:var(--space-1)">View as User</button>` : ''}
          <button id="sign-out-btn" class="btn btn-primary" style="background:transparent;border-color:#ff6b6b;color:#ff6b6b">Sign Out</button>`
        if (userIsAdmin) document.getElementById('preview-mode-btn').addEventListener('click', toggleAdminPreview)
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

function toggleAdminPreview() {
  adminPreviewMode = !adminPreviewMode
  const btn = document.getElementById('preview-mode-btn')
  if (btn) {
    btn.textContent = adminPreviewMode ? '← Admin View' : 'View as User'
    btn.style.background = adminPreviewMode
      ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)'
      : 'transparent'
  }
  const titleEl = document.getElementById('gallery-title')
  if (titleEl) titleEl.textContent = adminPreviewMode ? 'Your Gallery' : 'Photo Albums'
  const usersPanel = document.getElementById('admin-users-panel')
  if (usersPanel) usersPanel.style.display = adminPreviewMode ? 'none' : 'block'
  const sizePicker = document.querySelector('.title-size-btns')
  if (sizePicker) sizePicker.style.display = adminPreviewMode ? 'none' : ''
  loadAlbums()
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

    const isPrivate = document.getElementById('album-private-checkbox')?.checked ?? false

    const { error } = await supabase
      .from('albums')
      .insert([{ name: albumName, owner_id: user.id, is_private: isPrivate }])

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
  if (userIsAdmin) {
    renderGalleryTitleSizePicker()
    initAssignmentModals()
    loadAdminUsers()
  }
})
