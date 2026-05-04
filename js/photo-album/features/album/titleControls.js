const TITLE_SIZES = { sm: '1.2rem', md: '1.8rem', lg: '2.5rem' }

export function createTitleControlsController({
  elements,
  getCurrentAlbumId,
  getIsAdmin,
  updateAlbum,
  showToast,
}) {
  const {
    albumName,
    albumNameEdit,
    editTitleBtn,
    saveTitleBtn,
    cancelTitleBtn,
    titleEditBtns,
    titleSizeButtons,
  } = elements

  function applyTitleSize(size) {
    if (size && TITLE_SIZES[size]) {
      albumName.style.fontSize = TITLE_SIZES[size]
      albumName.dataset.sizeOverride = size
    } else {
      delete albumName.dataset.sizeOverride
      albumName.style.fontSize = ''
      window.fitAlbumTitle?.()
    }
    titleSizeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size)
    })
  }

  async function saveTitleSize(size) {
    const currentAlbumId = getCurrentAlbumId()
    if (!getIsAdmin() || !currentAlbumId) return
    try {
      const { error } = await updateAlbum(currentAlbumId, { title_size: size })
      if (error) throw error
      applyTitleSize(size)
      showToast(`Title size: ${size.toUpperCase()}`)
    } catch (err) {
      showToast('Failed to save size: ' + err.message, true)
    }
  }

  function startTitleEdit() {
    albumNameEdit.value = albumName.textContent
    albumName.style.display = 'none'
    editTitleBtn.style.display = 'none'
    albumNameEdit.style.display = ''
    titleEditBtns.style.display = 'flex'
    albumNameEdit.focus()
    albumNameEdit.select()
  }

  async function saveTitleEdit() {
    const name = albumNameEdit.value.trim()
    if (!name) return
    try {
      const { data, error } = await updateAlbum(getCurrentAlbumId(), { name }).select('name')
      if (error) throw error
      if (!data || !data.length) throw new Error('Update blocked — check Supabase RLS UPDATE policy for albums')
      albumName.textContent = name
      showToast('✓ Album name updated')
    } catch (err) {
      showToast(err.message, true)
    }
    cancelTitleEdit()
  }

  function cancelTitleEdit() {
    albumName.style.display = ''
    editTitleBtn.style.display = ''   // let CSS (.admin-bar-btn) control display
    albumNameEdit.style.display = 'none'
    titleEditBtns.style.display = 'none'
  }

  function bindTitleEditEvents() {
    editTitleBtn.addEventListener('click', startTitleEdit)
    saveTitleBtn.addEventListener('click', saveTitleEdit)
    cancelTitleBtn.addEventListener('click', cancelTitleEdit)
    albumNameEdit.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveTitleEdit()
      if (e.key === 'Escape') cancelTitleEdit()
    })
  }

  function bindTitleSizeEvents() {
    titleSizeButtons.forEach(btn => {
      btn.addEventListener('click', () => saveTitleSize(btn.dataset.size))
    })
  }

  return {
    bindTitleEditEvents,
    bindTitleSizeEvents,
    applyTitleSize,
    saveTitleSize,
    startTitleEdit,
    saveTitleEdit,
    cancelTitleEdit,
  }
}
