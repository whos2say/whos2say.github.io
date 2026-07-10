import { getAlbumById } from '/js/photo-album/services/albumService.js'
import { getCoverPhoto, getLatestAlbumPhoto } from '/js/photo-album/services/photoService.js'
import { getPublicUrl } from '/js/photo-album/services/storageService.js'
import { supabase } from '/js/supabase.js'

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchMap() {
  const res = await fetch('/content/djr/section-gallery-map.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to load section-gallery-map.json (${res.status})`)
  return res.json()
}

async function fetchCmsAlbum(albumId) {
  const res = await fetch(`/content/djr-albums/${encodeURIComponent(albumId)}.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to load CMS album ${albumId} (${res.status})`)
  return res.json()
}

function getCmsAlbumImages(album) {
  return (album?.images || []).filter(image => image?.image)
}

async function resolveAlbumCover(album) {
  try {
    if (album.cover_photo_id) {
      const { data } = await getCoverPhoto(album.cover_photo_id)
      if (data?.file_path && !VIDEO_RE.test(data.file_path)) {
        return { url: getPublicUrl(data.file_path), focalPoint: data.focal_point }
      }
    }
    const { data: latest } = await getLatestAlbumPhoto(album.id)
    const photo = latest && latest[0]
    if (photo?.file_path && !VIDEO_RE.test(photo.file_path)) {
      return { url: getPublicUrl(photo.file_path), focalPoint: photo.focal_point }
    }
  } catch (err) {
    console.warn('[DJR section gallery] Cover lookup failed:', err)
  }
  return { url: '', focalPoint: '' }
}

async function fetchPhotoCount(albumId) {
  try {
    const { count } = await supabase.from('photos').select('id', { count: 'exact', head: true }).eq('album_id', albumId)
    return count || 0
  } catch {
    return 0
  }
}

async function buildCmsAlbumCard(mapping) {
  if (!mapping.album_id) {
    return {
      href: '',
      title: mapping.title || 'CMS album not mapped yet',
      description: mapping.description || 'Choose a DJR Gallery Album in the admin mapper.',
      coverImage: mapping.coverImage || '',
      focalPoint: '',
      meta: 'Needs album ID',
      disabled: true,
      buttonLabel: 'Map Album in Admin',
    }
  }

  try {
    const album = await fetchCmsAlbum(mapping.album_id)
    const images = getCmsAlbumImages(album)

    if (!images.length) {
      return {
        href: '',
        title: mapping.title || album.title || 'CMS album is empty',
        description: mapping.description || album.description || 'Add images to this DJR Gallery Album in the CMS.',
        coverImage: mapping.coverImage || album.cover_image || '',
        focalPoint: '',
        meta: 'Album has no images',
        disabled: true,
        buttonLabel: 'Check CMS Album',
      }
    }

    return {
      href: '',
      title: mapping.title || album.title,
      description: mapping.description || album.description || 'CMS-managed DJR gallery album.',
      coverImage: mapping.coverImage || album.cover_image || images[0].image,
      focalPoint: '',
      images: images.slice(0, 4),
      meta: `CMS album - ${images.length} image${images.length === 1 ? '' : 's'}`,
      disabled: false,
      buttonLabel: mapping.buttonLabel || 'CMS Gallery',
    }
  } catch (err) {
    console.warn('[DJR section gallery] CMS album lookup failed:', err)
    return {
      href: '',
      title: mapping.title || 'CMS album unavailable',
      description: mapping.description || 'This DJR Gallery Album could not be loaded.',
      coverImage: mapping.coverImage || '',
      focalPoint: '',
      meta: 'Check album ID',
      disabled: true,
      buttonLabel: 'Check CMS Album',
    }
  }
}

async function buildPhotoGalleryCard(mapping) {
  if (!mapping.photoGalleryAlbumId) {
    return {
      href: '',
      title: mapping.title || 'Photo Gallery App album not mapped yet',
      description: mapping.description || 'Add a Photo Gallery App album ID in the admin mapper.',
      coverImage: mapping.coverImage || '',
      focalPoint: '',
      meta: 'Needs album ID',
      disabled: true,
      buttonLabel: 'Map Album in Admin',
    }
  }

  const { data: album, error } = await getAlbumById(mapping.photoGalleryAlbumId, 'id, name, cover_photo_id, is_private')
  if (error || !album || album.is_private) {
    return {
      href: '',
      title: mapping.title || 'Album unavailable',
      description: mapping.description || 'This Photo Gallery App album is missing, private, or not visible.',
      coverImage: mapping.coverImage || '',
      focalPoint: '',
      meta: 'Check album ID',
      disabled: true,
      buttonLabel: 'Check Mapping',
    }
  }

  const [cover, count] = await Promise.all([resolveAlbumCover(album), fetchPhotoCount(album.id)])
  return {
    href: `/album.html?album=${encodeURIComponent(album.id)}`,
    title: mapping.title || album.name,
    description: mapping.description || 'Open the full Photo Gallery App album.',
    coverImage: mapping.coverImage || cover.url,
    focalPoint: mapping.coverImage ? '' : cover.focalPoint,
    meta: `Photo Gallery App${count ? ` · ${count} photo${count === 1 ? '' : 's'}` : ''}`,
    disabled: false,
    buttonLabel: mapping.buttonLabel || 'Open Album',
  }
}

function buildGooglePhotosCard(mapping) {
  const hasUrl = Boolean(mapping.googlePhotosAlbumUrl)
  return {
    href: mapping.googlePhotosAlbumUrl || '',
    title: mapping.title || 'Google Photos album',
    description: mapping.description || 'Open the shared Google Photos album.',
    coverImage: mapping.coverImage || '',
    focalPoint: '',
    meta: hasUrl ? 'Google Photos shared album' : 'Needs shared album URL',
    disabled: !hasUrl,
    buttonLabel: mapping.buttonLabel || 'Open Google Photos',
  }
}

function cardHtml(card) {
  const tag = card.disabled || !card.href ? 'div' : 'a'
  const attrs = card.disabled
    ? ' aria-disabled="true"'
    : !card.href
      ? ''
    : ` href="${esc(card.href)}"${card.href.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}`
  const media = card.images?.length
    ? `<div class="djr-section-gallery-media-grid">${card.images.map(image => `<img src="${esc(image.image)}" alt="${esc(image.alt || image.caption || card.title)}" loading="lazy" decoding="async"/>`).join('')}</div>`
    : card.coverImage
    ? `<img src="${esc(card.coverImage)}" alt="${esc(card.title)}" loading="lazy" decoding="async"${card.focalPoint ? ` style="object-position:${esc(card.focalPoint)}"` : ''}/>`
    : '<div class="djr-placeholder" aria-hidden="true">Photo</div>'

  return `<${tag} class="djr-section-gallery-card${card.disabled ? ' is-disabled' : ''}"${attrs}><div class="djr-section-gallery-media">${media}</div><div class="djr-section-gallery-copy"><span class="djr-section-gallery-meta">${esc(card.meta)}</span><h3>${esc(card.title)}</h3><p>${esc(card.description)}</p><span class="djr-section-gallery-button">${esc(card.buttonLabel)}</span></div></${tag}>`
}

function insertCard(section, card, mapping) {
  const container = document.createElement('div')
  container.className = 'djr-section-gallery-wrap'
  container.setAttribute('data-djr-gallery-mapping', mapping.sectionId)
  container.innerHTML = cardHtml(card)
  const inner = section.querySelector('.djr-container') || section
  inner.appendChild(container)
}

async function renderMapping(mapping) {
  if (!mapping.enabled || !mapping.sectionId) return
  const section = document.querySelector(`[data-djr-section="${CSS.escape(mapping.sectionId)}"]`)
  if (!section) return
  const card = mapping.sourceType === 'cmsAlbum' || mapping.album_id
    ? await buildCmsAlbumCard(mapping)
    : mapping.sourceType === 'googlePhotos'
    ? buildGooglePhotosCard(mapping)
    : await buildPhotoGalleryCard(mapping)
  insertCard(section, card, mapping)
}

async function init() {
  if (!document.body.matches('[data-djr-page="home"]')) return
  try {
    const map = await fetchMap()
    await Promise.all((map.sections || []).map(renderMapping))
  } catch (err) {
    console.warn('[DJR section gallery] Mapping skipped:', err.message)
  }
}

init()
