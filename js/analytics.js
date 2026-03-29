/**
 * js/analytics.js — GA4 custom event tracking for the photo gallery
 *
 * GA4 Measurement ID: G-46JBLZ3YPT
 *
 * NOTE: The photo app pages (album.html, albums.html, slideshow.html,
 * multi-slideshow.html) do not currently include the GA4 snippet. Add it
 * to each page's <head> for events to fire:
 *
 *   <!-- Google tag (gtag.js) -->
 *   <script async src="https://www.googletagmanager.com/gtag/js?id=G-46JBLZ3YPT"></script>
 *   <script>
 *     window.dataLayer = window.dataLayer || [];
 *     function gtag(){dataLayer.push(arguments);}
 *     gtag('js', new Date());
 *     gtag('config', 'G-46JBLZ3YPT');
 *   </script>
 *
 * All functions silently no-op when gtag is not loaded — safe to import
 * on any page regardless of whether the snippet is present.
 */

// ── Page-type detection (runs once at module load) ───────────────────────────
function _detectPageType() {
  const p = window.location.pathname
  if (/\/multi-slideshow\.html/.test(p)) return 'multi_slideshow'
  if (/\/slideshow\.html/.test(p))       return 'slideshow'
  if (/\/album\.html/.test(p))           return 'album'
  if (/\/albums\.html/.test(p))          return 'albums'
  return 'other'
}

// ── UTM params captured from URL on page load ────────────────────────────────
// When traffic arrives via a /s/:slug redirect the redirect URL carries
// utm_source, utm_medium, utm_campaign — these are collected here and
// attached to every event so GA4 reports attribute conversions correctly.
function _captureUtm() {
  const params = new URLSearchParams(window.location.search)
  const utm = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const val = params.get(key)
    if (val) utm[key] = val
  }
  return utm
}

const _PAGE_TYPE  = _detectPageType()
const _UTM_PARAMS = _captureUtm()

// ── Core wrapper ─────────────────────────────────────────────────────────────

/**
 * Send a GA4 custom event.
 * Silently does nothing if gtag is not available.
 *
 * @param {string} eventName
 * @param {Object} params
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', eventName, {
    content_group: 'photo_gallery',
    page_type:     _PAGE_TYPE,
    ..._UTM_PARAMS,  // utm_source / utm_medium / utm_campaign when present
    ...params,       // caller params take precedence
  })
}

// ── Specific event helpers ────────────────────────────────────────────────────

/**
 * Fired when an album page finishes loading its photo grid.
 * @param {string} albumId
 * @param {string} albumName
 */
export function trackAlbumView(albumId, albumName) {
  trackEvent('album_view', {
    album_id:   albumId,
    album_name: albumName,
  })
}

/**
 * Fired when the user presses ▶ Play in the slideshow.
 * @param {string} albumId
 * @param {string} albumName
 * @param {number} photoCount  total photos in the slideshow
 */
export function trackSlideshowStart(albumId, albumName, photoCount) {
  trackEvent('slideshow_start', {
    album_id:    albumId,
    album_name:  albumName,
    photo_count: photoCount,
  })
}

/**
 * Fired when the slideshow wraps back to the first slide (full loop).
 * @param {string} albumId
 * @param {string} albumName
 * @param {number} photosViewed    number of unique slides advanced through
 * @param {number} totalPhotos     total photos/slides in the show
 * @param {number} durationSeconds wall-clock seconds from play to completion
 */
export function trackSlideshowComplete(albumId, albumName, photosViewed, totalPhotos, durationSeconds) {
  trackEvent('slideshow_complete', {
    album_id:         albumId,
    album_name:       albumName,
    photos_viewed:    photosViewed,
    total_photos:     totalPhotos,
    duration_seconds: Math.round(durationSeconds),
  })
}

/**
 * Fired each time the visible slide changes (single photo or collage).
 * @param {string} albumId
 * @param {number} photoIndex  0-based slide index
 * @param {number} totalPhotos total slides
 */
export function trackPhotoView(albumId, photoIndex, totalPhotos) {
  trackEvent('photo_view', {
    album_id:     albumId,
    photo_index:  photoIndex,
    total_photos: totalPhotos,
  })
}

/**
 * Fired when the user switches view mode (mixed / full / collage).
 * @param {'mixed'|'full'|'collage'} mode
 */
export function trackSlideshowModeChange(mode) {
  trackEvent('slideshow_mode_change', {
    slideshow_mode: mode,
  })
}

/**
 * Fired when the user shares a slideshow link.
 * @param {string} albumId
 * @param {'copy_link'|'facebook'|'short_link'} method
 * @param {string} shortUrl  the URL that was shared
 */
export function trackSlideshowShare(albumId, method, shortUrl) {
  trackEvent('slideshow_share', {
    album_id:  albumId,
    method,
    short_url: shortUrl,
  })
}

/**
 * Fired by the /s/:slug redirect function (or client-side on arrival)
 * to record that a short link was followed.
 * @param {string} slug
 * @param {string} targetType  'album' | 'slideshow' | 'multi-slideshow'
 * @param {string} campaign    utm_campaign value from the short link row
 */
export function trackShortLinkClick(slug, targetType, campaign) {
  trackEvent('short_link_click', {
    link_slug:   slug,
    target_type: targetType,
    campaign,
  })
}

/**
 * Fired when the audio player starts playing for the first time in a
 * slideshow session.
 * @param {string} albumId
 * @param {string} trackName  display name of the music track
 */
export function trackMusicPlay(albumId, trackName) {
  trackEvent('music_play', {
    album_id:   albumId,
    track_name: trackName,
  })
}

/**
 * Fired when the share panel opens.
 * @param {string} albumId
 */
export function trackShareModalOpen(albumId) {
  trackEvent('share_modal_open', {
    album_id: albumId,
  })
}
