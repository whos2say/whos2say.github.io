/**
 * DJR Photography — filterable galleries powered by the Photo Gallery App.
 *
 * Galleries are regular Photo Gallery App albums (albums.html / album.html,
 * Supabase `albums` + `photos`). Which albums appear here — and which
 * category each belongs to — is curated in /content/djr/galleries.json
 * (editable in Decap CMS → DJR Photography → Galleries).
 *
 * If no albums are curated yet, all public albums are listed under "All"
 * so the page works out of the box. Cards open the album in the full
 * Photo Gallery App viewer (/album.html?album=<id>).
 */
import {
  buildAlbumListQuery,
  getAlbumById,
} from '/js/photo-album/services/albumService.js'
import {
  getCoverPhoto,
  getLatestAlbumPhoto,
} from '/js/photo-album/services/photoService.js'
import { getPublicUrl } from '/js/photo-album/services/storageService.js'
import { supabase } from '/js/supabase.js'

const esc = (window.DJRContent && window.DJRContent.esc) || ((v) => String(v ?? ''))

const filtersEl = document.getElementById('djr-filters')
const gridEl = document.getElementById('djr-gallery-grid')
const statusEl = document.getElementById('djr-gallery-status')

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i

let allCards = [] // { albumId, title, category, description, coverUrl, focalPoint, count }
let config = null
let activeCategory = 'all'

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message || ''
    statusEl.style.display = message ? '' : 'none'
  }
}

async function fetchConfig() {
  const res = await fetch('/content/djr/galleries.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error('Failed to load galleries config')
  return res.json()
}

async function fetchPublicAlbums() {
  const { data, error } = await buildAlbumListQuery()
  if (error) throw error
  return (data || []).filter((album) => !album.is_private)
}

async function resolveCover(album) {
  try {
    if (album.cover_photo_id) {
      const { data } = await getCoverPhoto(album.cover_photo_id)
      if (data && data.file_path && !VIDEO_RE.test(data.file_path)) {
        return { url: getPublicUrl(data.file_path), focal: data.focal_point }
      }
    }
    const { data: latest } = await getLatestAlbumPhoto(album.id)
    const photo = latest && latest[0]
    if (photo && photo.file_path && !VIDEO_RE.test(photo.file_path)) {
      return { url: getPublicUrl(photo.file_path), focal: photo.focal_point }
    }
  } catch (err) {
    console.warn('[DJR] Cover lookup failed for album', album.id, err)
  }
  return { url: '', focal: '' }
}

async function fetchPhotoCount(albumId) {
  try {
    const { count } = await supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', albumId)
    return count || 0
  } catch {
    return 0
  }
}

function categoryLabel(categoryId) {
  const cat = (config.categories || []).find((c) => c.id === categoryId)
  return cat ? cat.label : ''
}

function renderFilters() {
  if (!filtersEl) return
  const usedIds = new Set(allCards.map((c) => c.category).filter(Boolean))
  const chips = [{ id: 'all', label: config.allLabel || 'All' }].concat(
    (config.categories || []).filter((c) => usedIds.has(c.id))
  )

  filtersEl.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="djr-filter-chip${c.id === activeCategory ? ' is-active' : ''}" data-cat="${esc(c.id)}">${esc(c.label)}</button>`
    )
    .join('')

  filtersEl.querySelectorAll('.djr-filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat
      const url = new URL(window.location.href)
      if (activeCategory === 'all') url.searchParams.delete('cat')
      else url.searchParams.set('cat', activeCategory)
      window.history.replaceState(null, '', url)
      renderFilters()
      renderGrid()
    })
  })
}

function renderGrid() {
  if (!gridEl) return
  const cards =
    activeCategory === 'all'
      ? allCards
      : allCards.filter((c) => c.category === activeCategory)

  if (!cards.length) {
    gridEl.innerHTML = ''
    setStatus(
      allCards.length
        ? config.noMatchMessage || 'No galleries in this category yet.'
        : config.emptyMessage || 'Galleries coming soon.'
    )
    return
  }

  setStatus('')
  gridEl.innerHTML = cards
    .map((card) => {
      const media = card.coverUrl
        ? `<img src="${esc(card.coverUrl)}" alt="${esc(card.title)}" loading="lazy" decoding="async"${card.focalPoint ? ` style="object-position:${esc(card.focalPoint)}"` : ''}/>`
        : '<div class="djr-placeholder" aria-hidden="true">📷</div>'
      const label = categoryLabel(card.category)
      const meta = card.count ? `${card.count} photo${card.count === 1 ? '' : 's'}` : ''
      return (
        `<a class="djr-gallery-card" href="/album.html?album=${encodeURIComponent(card.albumId)}" data-cat="${esc(card.category || '')}">` +
        media +
        '<div class="djr-gallery-overlay">' +
        (label ? `<span class="djr-gallery-cat">${esc(label)}</span>` : '') +
        `<h3 class="djr-gallery-name">${esc(card.title)}</h3>` +
        (meta ? `<p class="djr-gallery-meta">${esc(meta)}</p>` : '') +
        (card.description ? `<p class="djr-gallery-desc">${esc(card.description)}</p>` : '') +
        '</div></a>'
      )
    })
    .join('\n')
}

async function buildCuratedCards(publicAlbumsById) {
  const entries = config.galleries || []
  const cards = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.albumId) return null
      let album = publicAlbumsById.get(entry.albumId)
      if (!album) {
        // Album may exist but not be in the public list (e.g. listing query failed).
        const { data } = await getAlbumById(entry.albumId, 'id, name, cover_photo_id, is_private')
        if (!data || data.is_private) return null
        album = data
      }
      const [cover, count] = await Promise.all([resolveCover(album), fetchPhotoCount(album.id)])
      return {
        albumId: album.id,
        title: entry.title || album.name,
        category: entry.category || '',
        description: entry.description || '',
        coverUrl: entry.coverImage || cover.url,
        focalPoint: entry.coverImage ? '' : cover.focal,
        count,
      }
    })
  )
  return cards.filter(Boolean)
}

async function buildAutoCards(publicAlbums) {
  return Promise.all(
    publicAlbums.map(async (album) => {
      const [cover, count] = await Promise.all([resolveCover(album), fetchPhotoCount(album.id)])
      return {
        albumId: album.id,
        title: album.name,
        category: '',
        description: '',
        coverUrl: cover.url,
        focalPoint: cover.focal,
        count,
      }
    })
  )
}

async function init() {
  if (!gridEl) return
  setStatus('Loading galleries…')

  try {
    config = await fetchConfig()
  } catch (err) {
    console.error('[DJR] galleries config failed', err)
    setStatus('Galleries are unavailable right now.')
    return
  }

  const requested = new URLSearchParams(window.location.search).get('cat')
  if (requested) activeCategory = requested

  let publicAlbums = []
  try {
    publicAlbums = await fetchPublicAlbums()
  } catch (err) {
    console.error('[DJR] album list failed', err)
  }
  const publicAlbumsById = new Map(publicAlbums.map((a) => [a.id, a]))

  const curated = config.galleries && config.galleries.length
  allCards = curated
    ? await buildCuratedCards(publicAlbumsById)
    : await buildAutoCards(publicAlbums)

  // Deep-linked category with no matches falls back to All.
  if (activeCategory !== 'all' && !allCards.some((c) => c.category === activeCategory)) {
    activeCategory = 'all'
  }

  renderFilters()
  renderGrid()
}

init()
