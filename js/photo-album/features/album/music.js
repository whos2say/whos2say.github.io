import {
  getAlbumMusicUrl,
  setAlbumMusicUrl,
  clearAlbumMusicUrl,
  getMusicTracks,
  getMusicPublicUrl,
  uploadMusicFile as uploadMusicStorage,
  createMusicTrack,
  deleteMusicFile,
  deleteMusicTrack as deleteMusicTrackRow,
} from '../../services/musicService.js'

function escapeHtmlMusic(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function createMusicController({
  state,
  elements,
  showToast,
}) {
  const {
    musicBtn,
    musicModal,
    musicUrlInput,
    musicSaveBtn,
    musicClearBtn,
    musicCloseBtn,
    musicFileInput,
    musicUploadZone,
    musicUploadProgress,
    musicProgressFill,
    musicProgressLabel,
    musicRemoveBtn,
    musicTabs,
    musicLibraryList,
    musicCurrent,
    musicCurrentLabel,
    musicBadge,
  } = elements

  async function loadMusicUrl() {
    try {
      const { data: albumData, error } = await getAlbumMusicUrl(state.getCurrentAlbumId())

      if (error && error.code !== 'PGRST116') throw error

      const savedUrl = albumData?.music_url || ''
      if (musicUrlInput) musicUrlInput.value = savedUrl
      updateCurrentMusicStrip(savedUrl)
    } catch (err) {
      console.error('Load music URL error:', err)
    }
  }

  function updateCurrentMusicStrip(url) {
    if (!musicCurrent || !musicCurrentLabel) return
    if (url) {
      let displayName = url
      try {
        const seg = new URL(url).pathname.split('/').pop()
        if (seg) displayName = decodeURIComponent(seg).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      } catch (_) { /* url may not be absolute */ }
      musicCurrentLabel.textContent = `♪ Now set: ${displayName}`
      musicCurrent.style.display = 'flex'
    } else {
      musicCurrent.style.display = 'none'
    }
  }

  async function saveMusicUrl() {
    if (!state.getIsAlbumOwner()) {
      showToast('You must be the album owner to change music', true)
      return
    }

    const musicUrl = musicUrlInput ? musicUrlInput.value.trim() : ''

    try {
      const { data, error } = await setAlbumMusicUrl(state.getCurrentAlbumId(), musicUrl || null)

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error('Update blocked — check Supabase RLS policy for albums table (need UPDATE policy for authenticated users)')
      }

      showToast(musicUrl ? '✓ Music URL saved!' : '✓ Music removed.')
      updateMusicBadge(!!musicUrl, musicUrl)
      musicModal.classList.remove('show')
    } catch (err) {
      console.error('Save music error:', err)
      showToast(`Failed to save music: ${err.message}`, true)
    }
  }

  async function removeMusicFromAlbum() {
    if (!state.getIsAlbumOwner()) return
    try {
      const { data, error } = await clearAlbumMusicUrl(state.getCurrentAlbumId())
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Update blocked — check RLS policy')
      showToast('✓ Music removed.')
      updateMusicBadge(false, null)
      updateCurrentMusicStrip('')
      if (musicUrlInput) musicUrlInput.value = ''
    } catch (err) {
      showToast(`Failed to remove music: ${err.message}`, true)
    }
  }

  async function selectMusicTrack(url, title) {
    if (!state.getIsAlbumOwner()) {
      showToast('You must be the album owner to change music', true)
      return
    }
    try {
      const { data, error } = await setAlbumMusicUrl(state.getCurrentAlbumId(), url)
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Update blocked — check RLS policy')
      showToast(`✓ Music set: ${title}`)
      updateMusicBadge(true, url)
      musicModal.classList.remove('show')
    } catch (err) {
      console.error('Select music track error:', err)
      showToast(`Failed to set music: ${err.message}`, true)
    }
  }

  async function loadMusicLibrary() {
    if (!musicLibraryList) return
    musicLibraryList.innerHTML = '<p class="music-library-loading">Loading library…</p>'

    try {
      const [tracksResult, albumResult] = await Promise.all([
        getMusicTracks(),
        getAlbumMusicUrl(state.getCurrentAlbumId()),
      ])

      if (tracksResult.error) throw tracksResult.error

      const tracks = tracksResult.data || []
      const currentUrl = albumResult.data?.music_url || ''

      if (tracks.length === 0) {
        musicLibraryList.innerHTML = '<p class="music-library-empty">No tracks yet — upload one using the ⬆ Upload tab.</p>'
        return
      }

      musicLibraryList.innerHTML = ''
      tracks.forEach(track => {
        const publicUrl = getMusicPublicUrl(track.file_path)
        const isActive = currentUrl === publicUrl
        const currentUser = state.getCurrentUser()
        const canDelete = currentUser?.id === track.uploaded_by || state.getIsAdmin()

        const item = document.createElement('div')
        item.className = 'music-track-item' + (isActive ? ' active' : '')

        const selectBtn = document.createElement('button')
        selectBtn.className = 'music-track-select'
        selectBtn.title = isActive ? 'Currently selected' : 'Use this track'
        selectBtn.innerHTML = `<span class="music-track-icon">${isActive ? '▶' : '♪'}</span><span class="music-track-title">${escapeHtmlMusic(track.title)}</span>`
        selectBtn.addEventListener('click', () => selectMusicTrack(publicUrl, track.title))
        item.appendChild(selectBtn)

        if (canDelete) {
          const delBtn = document.createElement('button')
          delBtn.className = 'music-track-delete'
          delBtn.title = 'Delete from library'
          delBtn.textContent = '✕'
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            deleteMusicTrack(track.id, track.file_path, item)
          })
          item.appendChild(delBtn)
        }

        musicLibraryList.appendChild(item)
      })
    } catch (err) {
      console.error('Load music library error:', err)
      musicLibraryList.innerHTML = '<p class="music-library-error">Failed to load library.</p>'
    }
  }

  async function uploadMusicFile(file) {
    const currentUser = state.getCurrentUser()
    if (!currentUser) {
      showToast('You must be logged in to upload music', true)
      return
    }

    const allowedExts = /\.(mp3|m4a|wav|ogg)$/i
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/vorbis']
    if (!allowedExts.test(file.name) && !allowedTypes.includes(file.type)) {
      showToast('Only audio files are allowed (MP3, M4A, WAV, OGG)', true)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('File too large — maximum 20 MB', true)
      return
    }

    const sanitized = file.name
      .replace(/[^a-zA-Z0-9.\-_]/g, '-')
      .replace(/-{2,}/g, '-')
      .toLowerCase()
    const filePath = `${currentUser.id}/${Date.now()}-${sanitized}`
    const title = file.name.replace(/\.[^.]+$/, '')

    if (musicUploadZone) musicUploadZone.style.display = 'none'
    if (musicUploadProgress) musicUploadProgress.style.display = 'flex'
    if (musicProgressFill) musicProgressFill.style.width = '20%'
    if (musicProgressLabel) musicProgressLabel.textContent = 'Uploading…'

    try {
      const { error: uploadError } = await uploadMusicStorage(filePath, file, {
        contentType: file.type,
        upsert: false,
      })
      if (uploadError) throw uploadError

      if (musicProgressFill) musicProgressFill.style.width = '65%'
      if (musicProgressLabel) musicProgressLabel.textContent = 'Saving to library…'

      const { error: dbError } = await createMusicTrack({
        file_path: filePath,
        title,
        uploaded_by: currentUser.id,
      })
      if (dbError) throw dbError

      if (musicProgressFill) musicProgressFill.style.width = '100%'
      if (musicProgressLabel) musicProgressLabel.textContent = 'Done!'

      const publicUrl = getMusicPublicUrl(filePath)

      setTimeout(async () => {
        if (musicUploadProgress) musicUploadProgress.style.display = 'none'
        if (musicUploadZone) musicUploadZone.style.display = 'flex'
        if (musicProgressFill) musicProgressFill.style.width = '0%'
        if (musicFileInput) musicFileInput.value = ''
        await selectMusicTrack(publicUrl, title)
        showToast(`✓ "${title}" uploaded and set as album music!`)
      }, 700)
    } catch (err) {
      console.error('Music upload error:', err)
      showToast(`Upload failed: ${err.message}`, true)
      if (musicUploadProgress) musicUploadProgress.style.display = 'none'
      if (musicUploadZone) musicUploadZone.style.display = 'flex'
      if (musicProgressFill) musicProgressFill.style.width = '0%'
    }
  }

  async function deleteMusicTrack(trackId, filePath, itemEl) {
    if (!confirm('Delete this track from the library? This cannot be undone.')) return
    try {
      await deleteMusicFile(filePath)
      const { error } = await deleteMusicTrackRow(trackId)
      if (error) throw error
      itemEl.remove()
      showToast('Track deleted from library.')
    } catch (err) {
      console.error('Delete track error:', err)
      showToast(`Failed to delete: ${err.message}`, true)
    }
  }

  function switchMusicTab(tabName) {
    musicTabs.forEach(btn => {
      const active = btn.dataset.tab === tabName
      btn.classList.toggle('active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })
    document.querySelectorAll('.music-tab-panel').forEach(panel => {
      panel.classList.remove('active')
    })
    const activePanel = document.getElementById(`music-tab-${tabName}`)
    if (activePanel) activePanel.classList.add('active')
  }

  function clearMusicUrl() {
    if (musicUrlInput) musicUrlInput.value = ''
  }

  function closeMusicModal() {
    musicModal.classList.remove('show')
  }

  function updateMusicBadge(hasMusic, url) {
    if (musicBadge) {
      musicBadge.style.display = hasMusic ? 'inline-block' : 'none'
    }
    if (musicBtn) {
      musicBtn.title = hasMusic && url
        ? `Music: ${url}`
        : 'Add or edit slideshow music'
    }
  }

  function bindEvents() {
    if (musicBtn) {
      musicBtn.addEventListener('click', () => {
        if (!state.getIsAlbumOwner()) {
          showToast('Only album owners can manage music', true)
          return
        }
        loadMusicUrl()
        switchMusicTab('library')
        loadMusicLibrary()
        musicModal.classList.add('show')
      })
    }

    if (musicSaveBtn) musicSaveBtn.addEventListener('click', saveMusicUrl)
    if (musicClearBtn) musicClearBtn.addEventListener('click', clearMusicUrl)
    if (musicCloseBtn) musicCloseBtn.addEventListener('click', closeMusicModal)

    musicRemoveBtn?.addEventListener('click', removeMusicFromAlbum)

    musicTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab
        switchMusicTab(tab)
        if (tab === 'library') loadMusicLibrary()
      })
    })

    if (musicUploadZone) {
      musicUploadZone.addEventListener('click', () => musicFileInput?.click())
      musicUploadZone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); musicFileInput?.click() }
      })
      musicUploadZone.addEventListener('dragover', e => {
        e.preventDefault()
        musicUploadZone.classList.add('drag-over')
      })
      musicUploadZone.addEventListener('dragleave', () => musicUploadZone.classList.remove('drag-over'))
      musicUploadZone.addEventListener('drop', e => {
        e.preventDefault()
        musicUploadZone.classList.remove('drag-over')
        const file = e.dataTransfer?.files?.[0]
        if (file) uploadMusicFile(file)
      })
    }

    if (musicFileInput) {
      musicFileInput.addEventListener('change', () => {
        const file = musicFileInput.files?.[0]
        if (file) uploadMusicFile(file)
      })
    }

    if (musicModal) {
      musicModal.addEventListener('click', (e) => {
        if (e.target === musicModal) closeMusicModal()
      })
    }
  }

  return {
    bindEvents,
    loadMusicUrl,
    updateMusicBadge,
    loadMusicLibrary,
    closeMusicModal,
  }
}
