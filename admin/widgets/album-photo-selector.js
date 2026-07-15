import { getAlbumById } from '/js/photo-album/services/albumService.js'
import { getOrderedAlbumPhotos } from '/js/photo-album/services/photoService.js'
import { getPublicUrl } from '/js/photo-album/services/storageService.js'
import { isVideoPath } from '/js/photo-album/utils/media.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STYLE_PATH = '/admin/widgets/album-photo-selector.css?v=album-photo-selector-1'

function ensureStyle() {
  if (document.querySelector(`link[href="${STYLE_PATH}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = STYLE_PATH
  document.head.appendChild(link)
}

function toJS(value) {
  if (!value) return null
  if (typeof value.toJS === 'function') return value.toJS()
  return value
}

function normalizeIds(value) {
  const data = toJS(value)
  if (!Array.isArray(data)) return []
  return data.map((item) => String(item == null ? '' : item).trim()).filter(Boolean)
}

function getEntryData(entry) {
  return toJS(entry && entry.getIn ? entry.getIn(['data']) : {}) || {}
}

function getDefaultAlbumId(entry) {
  const data = getEntryData(entry)
  return typeof data.defaultAlbumId === 'string' ? data.defaultAlbumId : ''
}

function photoMatchesId(photo, selectedId, albumId) {
  if (!photo || !selectedId) return false
  if (photo.id === selectedId) return true
  if (photo.file_path === selectedId) return true
  const fileName = String(photo.file_path || '').split('/').filter(Boolean).pop() || ''
  return selectedId === `${albumId}/${fileName}`
}

function photoLabel(photo) {
  return photo.caption || photo.title || photo.description || String(photo.file_path || '').split('/').pop() || photo.id
}

function AlbumPhotoSelectorControl(props) {
  const React = window.React
  const h = React.createElement
  const value = normalizeIds(props.value)
  const [albumId, setAlbumId] = React.useState(getDefaultAlbumId(props.entry))
  const [photos, setPhotos] = React.useState([])
  const [status, setStatus] = React.useState('Paste an Album UUID or use the page default, then load photos.')
  const [isLoading, setIsLoading] = React.useState(false)

  function changeSelection(nextIds) {
    props.onChange(nextIds)
  }

  async function loadPhotos() {
    const normalizedAlbumId = String(albumId || '').trim()
    if (!normalizedAlbumId) {
      setStatus('Paste an Album UUID to load selectable photos.')
      setPhotos([])
      return
    }
    if (!UUID_RE.test(normalizedAlbumId)) {
      setStatus('Album UUID must be a Supabase UUID.')
      setPhotos([])
      return
    }

    setIsLoading(true)
    setStatus('Loading album photos...')
    try {
      const { data: album, error: albumError } = await getAlbumById(normalizedAlbumId, 'id, name, is_private')
      if (albumError || !album) {
        setPhotos([])
        setStatus('Album not found or unavailable.')
        return
      }
      if (album.is_private) {
        setPhotos([])
        setStatus('Private albums cannot be selected for public Participant Pages.')
        return
      }

      const { data, error } = await getOrderedAlbumPhotos(normalizedAlbumId)
      if (error || !Array.isArray(data) || !data.length) {
        setPhotos([])
        setStatus('No public photos were found in this album.')
        return
      }

      setPhotos(data.filter((photo) => photo && photo.file_path))
      setStatus(`Loaded ${data.length} photos from ${album.name || 'album'}.`)
    } catch (err) {
      setPhotos([])
      setStatus(`Could not load album photos: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  function isSelected(photo) {
    return value.some((selectedId) => photoMatchesId(photo, selectedId, albumId))
  }

  function selectedIndex(photo) {
    return value.findIndex((selectedId) => photoMatchesId(photo, selectedId, albumId))
  }

  function togglePhoto(photo) {
    const index = selectedIndex(photo)
    if (index >= 0) {
      changeSelection(value.filter((_, itemIndex) => itemIndex !== index))
      return
    }
    changeSelection(value.concat(photo.id))
  }

  function moveSelected(index, delta) {
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= value.length) return
    const next = value.slice()
    const item = next[index]
    next[index] = next[nextIndex]
    next[nextIndex] = item
    changeSelection(next)
  }

  function removeSelected(index) {
    changeSelection(value.filter((_, itemIndex) => itemIndex !== index))
  }

  function renderPhoto(photo) {
    const selected = isSelected(photo)
    const index = selectedIndex(photo)
    const isVideo = isVideoPath(photo.file_path)
    return h('button', {
      key: photo.id,
      type: 'button',
      className: `album-photo-selector__photo${selected ? ' is-selected' : ''}`,
      onClick: () => togglePhoto(photo),
    }, [
      selected ? h('span', { className: 'album-photo-selector__badge' }, String(index + 1)) : null,
      isVideo
        ? h('span', { className: 'album-photo-selector__video' }, 'Video')
        : h('img', { src: getPublicUrl(photo.file_path), alt: photoLabel(photo), loading: 'lazy' }),
      h('span', { className: 'album-photo-selector__caption' }, photoLabel(photo)),
    ])
  }

  function renderSelectedChip(selectedId, index) {
    const photo = photos.find((item) => photoMatchesId(item, selectedId, albumId))
    const label = photo ? photoLabel(photo) : selectedId
    return h('span', { key: `${selectedId}-${index}`, className: 'album-photo-selector__chip' }, [
      `${index + 1}. ${label}`,
      h('button', { type: 'button', onClick: () => moveSelected(index, -1), disabled: index === 0, title: 'Move earlier' }, '↑'),
      h('button', { type: 'button', onClick: () => moveSelected(index, 1), disabled: index === value.length - 1, title: 'Move later' }, '↓'),
      h('button', { type: 'button', onClick: () => removeSelected(index), title: 'Remove' }, '×'),
    ])
  }

  React.useEffect(() => {
    ensureStyle()
  }, [])

  return h('div', { className: 'album-photo-selector' }, [
    h('p', { className: 'album-photo-selector__help' }, 'Images come from /albums.html. Add/manage photos there, then select them here. The Photo ID must come from the Album UUID above.'),
    h('div', { className: 'album-photo-selector__controls' }, [
      h('input', {
        className: 'album-photo-selector__input',
        type: 'text',
        value: albumId,
        placeholder: 'Paste Album UUID to load photos',
        onChange: (event) => setAlbumId(event.target.value),
      }),
      h('button', {
        className: 'album-photo-selector__button',
        type: 'button',
        disabled: isLoading,
        onClick: loadPhotos,
      }, isLoading ? 'Loading' : 'Load Photos'),
    ]),
    h('p', { className: 'album-photo-selector__status' }, status),
    h('p', { className: 'album-photo-selector__meta' }, `${value.length} selected. Drag-free order controls are shown on selected chips.`),
    value.length ? h('div', { className: 'album-photo-selector__selected' }, value.map(renderSelectedChip)) : null,
    photos.length ? h('div', { className: 'album-photo-selector__grid' }, photos.map(renderPhoto)) : null,
    h('details', { className: 'album-photo-selector__details' }, [
      h('summary', null, 'Advanced / manual Photo IDs'),
      h('p', null, value.length ? value.join(', ') : 'No selected Photo IDs.'),
      h('button', {
        className: 'album-photo-selector__button album-photo-selector__button--secondary',
        type: 'button',
        onClick: () => changeSelection([]),
      }, 'Clear Selection'),
    ]),
  ])
}

function registerAlbumPhotoSelector() {
  if (!window.CMS || !window.React) {
    window.setTimeout(registerAlbumPhotoSelector, 100)
    return
  }

  window.CMS.registerWidget('album-photo-selector', AlbumPhotoSelectorControl)
  window.__albumPhotoSelectorRegistered = true
  console.info('[Album Photo Selector] registered')
}

registerAlbumPhotoSelector()
