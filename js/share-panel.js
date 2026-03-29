/**
 * js/share-panel.js — Reusable share panel module
 *
 * Features:
 *  • 7-platform Quick Share row (FB, X, LinkedIn, Instagram, TikTok, Copy, Email)
 *  • Hashtag intelligence: sports-aware, WDSD-aware, per-platform sets
 *  • Platform-specific post text with Social / Instagram / TikTok tabs
 *  • Inline tools section for Instagram, TikTok & Snapchat:
 *      - Canvas-generated 1080×1080 Share Graphic download
 *      - QR Code display + download (qrcode-generator CDN)
 *      - Instagram & TikTok caption copy with preview
 *  • Admin-only Campaign Link Creator
 */

import { supabase } from './supabase.js'
import { trackEvent, trackShareModalOpen } from './analytics.js'

// ── Hashtag configuration ─────────────────────────────────────────────────────

const _SPORTS_KEYWORDS = [
  'baseball', 'softball', 'basketball', 'soccer', 'lacrosse', 'sports',
  'game', 'tournament', 'challenger', 'unified', 'athletic', 'buddy ball',
  'field day', 'track', 'swim', 'tennis', 'bowling', 'flag football',
]

const _WDSD_KEYWORDS = [
  'wdsd', 'world down syndrome', 'down syndrome day', '3/21', '321',
  'march 21', 'lots of socks',
]

const _TAGS = {
  GENERAL_SHORT:
    '#WhosToSay #DownSyndromeAwareness #InclusionMatters #MoreAlikeThanDifferent',
  SPORTS_SHORT:
    '#WhosToSay #AdaptiveSports #InclusiveSports #ChooseToInclude #MoreAlikeThanDifferent',

  GENERAL_INSTAGRAM: [
    '#WhosToSay', '#DownSyndromeAwareness', '#DownSyndromeCommunity', '#T21',
    '#InclusionMatters', '#InclusionRevolution', '#DisabilityAwareness',
    '#DisabilityInclusion', '#MoreAlikeThanDifferent', '#DownSyndromeIsBeautiful',
    '#DownSyndromeLove', '#ChooseToInclude', '#DisabilityAdvocate',
    '#DisabilityPride', '#Inclusion', '#Accessibility', '#Awareness',
  ].join(' '),

  SPORTS_INSTAGRAM: [
    '#WhosToSay', '#AdaptiveSports', '#InclusiveSports', '#ChallengerBaseball',
    '#ChallengerDivision', '#PlayUnified', '#ChooseToInclude', '#SpecialOlympics',
    '#InclusionRevolution', '#InclusionMatters', '#T21', '#DownSyndromeAwareness',
    '#DownSyndromeCommunity', '#AdaptiveAthletes', '#EveryoneCanPlay',
    '#DisabilityInclusion', '#MoreAlikeThanDifferent', '#BuddyBall',
  ].join(' '),

  GENERAL_TIKTOK:
    '#WhosToSay #DownSyndromeAwareness #InclusionMatters #MoreAlikeThanDifferent #T21 #DownSyndromeCommunity #fyp #foryoupage',
  SPORTS_TIKTOK:
    '#WhosToSay #AdaptiveSports #InclusiveSports #ChallengerBaseball #ChooseToInclude #MoreAlikeThanDifferent #T21 #fyp #foryoupage',

  WDSD_APPEND: '#WorldDownSyndromeDay #WDSD2026 #LotsOfSocks',
}

// ── Module-level state ────────────────────────────────────────────────────────

let _config      = {}
let _shortUrl    = null
let _initialized = false

// ── Hashtag helpers ───────────────────────────────────────────────────────────

function _isSports() {
  const lower = (_config.title || '').toLowerCase()
  return _SPORTS_KEYWORDS.some(kw => lower.includes(kw))
}

function _isWdsd() {
  const lower = (_config.title || '').toLowerCase()
  return _WDSD_KEYWORDS.some(kw => lower.includes(kw))
}

function _getHashtags(platform) {
  const sports = _isSports()
  const wdsd   = _isWdsd()

  let tags
  if (platform === 'instagram') {
    tags = sports ? _TAGS.SPORTS_INSTAGRAM : _TAGS.GENERAL_INSTAGRAM
  } else if (platform === 'tiktok') {
    tags = sports ? _TAGS.SPORTS_TIKTOK : _TAGS.GENERAL_TIKTOK
  } else {
    tags = sports ? _TAGS.SPORTS_SHORT : _TAGS.GENERAL_SHORT
  }

  return wdsd ? `${tags} ${_TAGS.WDSD_APPEND}` : tags
}

// ── Post text builders ────────────────────────────────────────────────────────

function _buildPostText(platform) {
  const name        = _config.title || 'this'
  const contentType = _config.contentLabel === 'album' ? 'album' : 'slideshow'
  const tags        = _getHashtags(platform)

  if (platform === 'instagram') {
    return (
      `${name} — celebrating our amazing community! 📸✨\n\n` +
      `See the full ${contentType} at the link in our bio 👆\n\n` +
      tags
    )
  }
  if (platform === 'tiktok') {
    return (
      `${name} from Who's 2 Say Foundation 📸✨ ` +
      `Link in bio to see the full ${contentType}! ${tags}`
    )
  }
  return (
    `Check out the ${name} photo ${contentType} from Who's 2 Say Foundation — ` +
    `celebrating our amazing community! 📸✨ ${tags}`
  )
}

// ── Share URL helpers ─────────────────────────────────────────────────────────

function _getShareBaseUrl() {
  return _shortUrl || _config.shareUrl || window.location.href
}

function _buildFbUrl() {
  let sharePageUrl = _shortUrl || _config.shareUrl || window.location.href

  if (!_shortUrl && _config.shareUrl && !_config.shareUrl.includes('/share/')) {
    const urlObj   = new URL(sharePageUrl, window.location.origin)
    const campaign = document.getElementById('share-admin-campaign')?.value.trim() ||
      (_config.title
        ? _config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : 'whos2say')
    urlObj.searchParams.set('utm_source',   'facebook')
    urlObj.searchParams.set('utm_medium',   'social')
    urlObj.searchParams.set('utm_campaign', campaign)
    sharePageUrl = urlObj.toString()
  }

  const contentType = _config.contentLabel === 'album' ? 'album' : 'slideshow'
  const quote = `Check out the ${_config.title || 'photo'} ${contentType} from Who's 2 Say Foundation! 📸`
  return {
    fbUrl:    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}&quote=${encodeURIComponent(quote)}`,
    shareUrl: sharePageUrl,
  }
}

// ── Canvas: share graphic generation ─────────────────────────────────────────

function _wrapCanvasText(ctx, text, maxWidth) {
  const words   = text.split(' ')
  const lines   = []
  let   current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

async function _generateShareGraphic() {
  const canvas  = document.createElement('canvas')
  canvas.width  = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not available')

  // Wait for web fonts so we can reference them on canvas
  if (document.fonts) {
    try { await document.fonts.ready } catch { /* ignore */ }
  }

  const root        = document.documentElement
  const headingFont = getComputedStyle(root).getPropertyValue('--font-heading').trim() || 'Georgia, serif'
  const bodyFont    = getComputedStyle(root).getPropertyValue('--font-body').trim()    || 'system-ui, sans-serif'

  // ── 1. Background ────────────────────────────────────────────
  let imgLoaded = false
  if (_config.coverUrl) {
    await new Promise(resolve => {
      const img    = new Image()
      img.crossOrigin = 'anonymous'
      img.onload  = () => {
        // Center-crop to fill 1080×1080
        const scale = Math.max(1080 / img.naturalWidth, 1080 / img.naturalHeight)
        const dw    = img.naturalWidth  * scale
        const dh    = img.naturalHeight * scale
        ctx.drawImage(img, (1080 - dw) / 2, (1080 - dh) / 2, dw, dh)
        imgLoaded = true
        resolve()
      }
      img.onerror = () => resolve()
      img.src     = _config.coverUrl
    })
  }
  if (!imgLoaded) {
    // Fallback gradient background
    const bg = ctx.createLinearGradient(0, 0, 1080, 1080)
    bg.addColorStop(0, '#0d1117')
    bg.addColorStop(1, '#1a2744')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 1080, 1080)
    // Dot texture
    ctx.fillStyle = 'rgba(116,192,252,0.04)'
    for (let x = 0; x < 1080; x += 40) {
      for (let y = 0; y < 1080; y += 40) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  // ── 2. Gradient overlays ─────────────────────────────────────
  // Bottom (text backdrop)
  const bot = ctx.createLinearGradient(0, 540, 0, 1080)
  bot.addColorStop(0,    'rgba(0,0,0,0)')
  bot.addColorStop(0.35, 'rgba(0,0,0,0.65)')
  bot.addColorStop(1,    'rgba(0,0,0,0.92)')
  ctx.fillStyle = bot; ctx.fillRect(0, 0, 1080, 1080)
  // Top vignette (logo contrast)
  const top = ctx.createLinearGradient(0, 0, 0, 180)
  top.addColorStop(0, 'rgba(0,0,0,0.45)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top; ctx.fillRect(0, 0, 1080, 180)

  // ── 3. Logo (top-left) ───────────────────────────────────────
  await new Promise(resolve => {
    const logo   = new Image()
    logo.onload  = () => {
      const lw = 100
      const lh = (logo.naturalHeight / logo.naturalWidth) * lw
      ctx.globalAlpha = 0.85
      ctx.drawImage(logo, 50, 44, lw, lh)
      ctx.globalAlpha = 1
      resolve()
    }
    logo.onerror = () => resolve()
    logo.src     = '/assets/images/logo-white-dark.png'
  })

  // ── 4. Camera accent (top-right) ─────────────────────────────
  ctx.font         = '56px serif'
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = 'rgba(255,255,255,0.62)'
  try { ctx.fillText('📸', 1036, 44) } catch { /* emoji unsupported — skip */ }

  // ── 5. Album name (bottom, bold, max 2 lines) ─────────────────
  const name     = _config.title || ''
  const fontSize = name.length > 30 ? 58 : 70
  ctx.font         = `bold ${fontSize}px ${headingFont}`
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle    = '#ffffff'

  const nameLines = _wrapCanvasText(ctx, name, 960)
  const lineH     = fontSize * 1.22
  const nameStartY = 820 - (Math.min(nameLines.length, 2) - 1) * lineH
  nameLines.slice(0, 2).forEach((line, i) => {
    let l = line
    if (i === 1 && nameLines.length > 2) {
      while (l.length > 0 && ctx.measureText(l + '…').width > 960) {
        l = l.slice(0, -1).trimEnd()
      }
      l += '…'
    }
    ctx.fillText(l, 60, nameStartY + i * lineH)
  })

  // ── 6. Org name (accent color) ───────────────────────────────
  ctx.font      = `500 40px ${bodyFont}`
  ctx.fillStyle = '#74c0fc'
  ctx.fillText("Who's 2 Say Foundation", 60, 908)

  // ── 7. Share URL ─────────────────────────────────────────────
  const displayUrl = _shortUrl
    ? _shortUrl.replace(/^https?:\/\//, '')
    : 'whostosay.org'
  ctx.font      = `400 30px ${bodyFont}`
  ctx.fillStyle = 'rgba(255,255,255,0.80)'
  ctx.fillText(displayUrl, 60, 960)

  return canvas
}

async function _downloadShareGraphic() {
  const btn      = document.getElementById('share-download-graphic-btn')
  const fallback = document.getElementById('share-graphic-fallback')

  if (btn) { btn.disabled = true; btn.textContent = 'Generating…' }
  if (fallback) fallback.style.display = 'none'

  try {
    const canvas = await _generateShareGraphic()

    await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob failed')); return }
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = `${(_config.title || 'share')
          .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-share.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    })

    _trackShare('instagram_graphic', _getShareBaseUrl())
  } catch (err) {
    console.warn('[share-panel] Graphic generation failed:', err)
    if (fallback) fallback.style.display = ''
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Download Share Image' }
  }
}

// ── QR Code ───────────────────────────────────────────────────────────────────

function _generateQr() {
  const container = document.getElementById('share-qr-container')
  if (!container) return null

  if (typeof window.qrcode !== 'function') {
    container.innerHTML = '<span class="share-qr-unavail">QR unavailable — reload page</span>'
    return null
  }

  const url = _getShareBaseUrl()
  try {
    const qr = window.qrcode(0, 'M')
    qr.addData(url)
    qr.make()
    const dataUrl = qr.createDataURL(5, 4)
    container.innerHTML =
      `<img src="${dataUrl}" alt="QR Code for ${url}" />`
    return dataUrl
  } catch (err) {
    console.warn('[share-panel] QR generation failed:', err)
    container.innerHTML = '<span class="share-qr-unavail">QR unavailable</span>'
    return null
  }
}

function _downloadQr() {
  if (typeof window.qrcode !== 'function') return

  const url = _getShareBaseUrl()
  try {
    const qr = window.qrcode(0, 'M')
    qr.addData(url)
    qr.make()
    const dataUrl = qr.createDataURL(10, 4)   // larger for download quality
    const a       = document.createElement('a')
    a.href        = dataUrl
    a.download    = `${(_config.title || 'share')
      .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-qr.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    _trackShare('qr_code', url)
  } catch (err) {
    console.warn('[share-panel] QR download failed:', err)
  }
}

// ── Inline tools section ──────────────────────────────────────────────────────

function _expandSocialTools() {
  const body   = document.getElementById('share-tools-body')
  const toggle = document.getElementById('share-tools-toggle-btn')
  if (body && body.style.display === 'none') {
    body.style.display = ''
    if (toggle) toggle.setAttribute('aria-expanded', 'true')
  }
}

function _scrollToSocialTools() {
  _expandSocialTools()
  const section = document.getElementById('share-social-tools')
  const modal   = document.getElementById('share-modal')
  if (section && modal) {
    modal.scrollTo({ top: Math.max(0, section.offsetTop - 60), behavior: 'smooth' })
  }
  // Brief highlight pulse
  section?.classList.add('share-tools-highlight')
  setTimeout(() => section?.classList.remove('share-tools-highlight'), 700)
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _openPopup(url) {
  window.open(url, '_blank', 'noopener,width=600,height=400')
}

function _copyText(text, btn, label = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent
    btn.textContent = label
    btn.classList.add('copied')
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied') }, 2000)
  })
}

function _copyPlatformBtn(text, btn) {
  const textSpan = btn.querySelector('span:last-child')
  navigator.clipboard.writeText(text).then(() => {
    const orig = textSpan.textContent
    textSpan.textContent = 'Copied!'
    btn.classList.add('copied')
    setTimeout(() => { textSpan.textContent = orig; btn.classList.remove('copied') }, 2000)
  })
}

function _switchTab(tabName) {
  ;['social', 'instagram', 'tiktok'].forEach(t => {
    const panel = document.getElementById(`share-tab-${t}`)
    const btn   = document.getElementById(`share-tab-btn-${t}`)
    if (panel) panel.style.display = t === tabName ? '' : 'none'
    if (btn)   btn.classList.toggle('active', t === tabName)
  })
}

function _trackShare(method, url) {
  const eventName = _config.targetType === 'album' ? 'album_share' : 'slideshow_share'
  trackEvent(eventName, {
    album_id:  _config.albumId,
    method,
    short_url: url,
  })
}

// ── Panel open / close ────────────────────────────────────────────────────────

async function _open() {
  const shareModalEl = document.getElementById('share-modal')
  if (!shareModalEl) return

  // Modal heading
  const titleEl = document.getElementById('share-modal-title')
  if (titleEl) {
    titleEl.textContent = `🔗 Share ${_config.contentLabel === 'album' ? 'Album' : 'Slideshow'}`
  }

  // Post text tabs
  const socialEl = document.getElementById('share-post-social')
  const igEl     = document.getElementById('share-post-instagram')
  const ttEl     = document.getElementById('share-post-tiktok')
  if (socialEl) socialEl.value = _buildPostText('social')
  if (igEl)     igEl.value     = _buildPostText('instagram')
  if (ttEl)     ttEl.value     = _buildPostText('tiktok')
  _switchTab('social')

  // Caption previews in inline tools section
  const igPreview = document.getElementById('share-ig-caption-preview')
  const ttPreview = document.getElementById('share-tt-caption-preview')
  if (igPreview) igPreview.textContent = _buildPostText('instagram')
  if (ttPreview) ttPreview.textContent = _buildPostText('tiktok')

  // Collapse inline tools section on every open
  const toolsBody   = document.getElementById('share-tools-body')
  const toolsToggle = document.getElementById('share-tools-toggle-btn')
  if (toolsBody)   toolsBody.style.display = 'none'
  if (toolsToggle) toolsToggle.setAttribute('aria-expanded', 'false')

  // Generate QR code (renders while hidden — ready when expanded)
  _generateQr()

  // Reset admin form
  const shareErrorEl         = document.getElementById('share-error')
  const shareAdminSectionEl  = document.getElementById('share-admin-section')
  const shareAdminSlugEl     = document.getElementById('share-admin-slug')
  const shareAdminCampaignEl = document.getElementById('share-admin-campaign')
  const shareAdminOgTitleEl  = document.getElementById('share-admin-og-title')
  const shareAdminOgDescEl   = document.getElementById('share-admin-og-desc')
  const shareGenerateBtnEl   = document.getElementById('share-generate-btn')
  const shareShortResultEl   = document.getElementById('share-short-result')
  const shareShortUrlEl      = document.getElementById('share-short-url')

  if (shareErrorEl)         shareErrorEl.style.display = 'none'
  if (shareAdminSlugEl)     shareAdminSlugEl.value     = ''
  if (shareAdminCampaignEl) shareAdminCampaignEl.value = ''
  if (shareAdminOgTitleEl)  shareAdminOgTitleEl.value  = ''
  if (shareAdminOgDescEl)   shareAdminOgDescEl.value   = ''

  if (_shortUrl) {
    if (shareShortUrlEl)    shareShortUrlEl.value             = _shortUrl
    if (shareShortResultEl) shareShortResultEl.style.display  = ''
    if (shareGenerateBtnEl) {
      shareGenerateBtnEl.disabled    = true
      shareGenerateBtnEl.textContent = '✓ Generated'
    }
  } else {
    if (shareShortResultEl) shareShortResultEl.style.display = 'none'
    if (shareGenerateBtnEl) {
      shareGenerateBtnEl.disabled    = false
      shareGenerateBtnEl.textContent = 'Generate Short Link'
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (shareAdminSectionEl) {
      shareAdminSectionEl.style.display =
        session?.user?.email === 'joe@whostosay.org' ? '' : 'none'
    }
  } catch {
    if (shareAdminSectionEl) shareAdminSectionEl.style.display = 'none'
  }

  shareModalEl.classList.add('show')
  trackShareModalOpen(_config.albumId)
}

function _close() {
  document.getElementById('share-modal')?.classList.remove('show')
}

// ── Campaign link generation ──────────────────────────────────────────────────

async function _generateCampaignLink() {
  const shareAdminSlugEl     = document.getElementById('share-admin-slug')
  const shareAdminCampaignEl = document.getElementById('share-admin-campaign')
  const shareGenerateBtnEl   = document.getElementById('share-generate-btn')
  const shareErrorEl         = document.getElementById('share-error')
  const shareShortResultEl   = document.getElementById('share-short-result')
  const shareShortUrlEl      = document.getElementById('share-short-url')

  if (shareErrorEl)       shareErrorEl.style.display  = 'none'
  if (shareGenerateBtnEl) {
    shareGenerateBtnEl.disabled    = true
    shareGenerateBtnEl.textContent = 'Generating…'
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      if (shareErrorEl) {
        shareErrorEl.textContent   = 'You must be logged in to create a short link.'
        shareErrorEl.style.display = ''
      }
      if (shareGenerateBtnEl) {
        shareGenerateBtnEl.disabled    = false
        shareGenerateBtnEl.textContent = 'Generate Short Link'
      }
      return
    }

    const slug         = shareAdminSlugEl?.value.trim()     || undefined
    const utm_campaign = shareAdminCampaignEl?.value.trim() || undefined

    const body = {
      target_type: _config.targetType,
      target_id:   _config.targetId,
      ...(slug         && { slug }),
      ...(utm_campaign && { utm_campaign }),
    }

    const res  = await fetch('/api/create-short-link', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify(body),
    })
    const json = await res.json()

    if (!res.ok) {
      if (shareErrorEl) {
        shareErrorEl.textContent   = json.error || 'Failed to create short link.'
        shareErrorEl.style.display = ''
      }
      if (shareGenerateBtnEl) {
        shareGenerateBtnEl.disabled    = false
        shareGenerateBtnEl.textContent = 'Generate Short Link'
      }
      return
    }

    _shortUrl = json.short_url
    // Refresh QR with the new short URL
    _generateQr()

    if (shareShortUrlEl)    shareShortUrlEl.value              = json.short_url
    if (shareShortResultEl) shareShortResultEl.style.display   = ''
    if (shareGenerateBtnEl) shareGenerateBtnEl.textContent     = '✓ Generated'

    _trackShare('short_link', json.short_url)
  } catch {
    if (shareErrorEl) {
      shareErrorEl.textContent   = 'Network error — please try again.'
      shareErrorEl.style.display = ''
    }
    if (shareGenerateBtnEl) {
      shareGenerateBtnEl.disabled    = false
      shareGenerateBtnEl.textContent = 'Generate Short Link'
    }
  }
}

// ── Wire listeners (once) ─────────────────────────────────────────────────────

function _wireListeners() {
  if (_initialized) return
  _initialized = true

  const shareModalEl = document.getElementById('share-modal')

  // ── Close ──
  document.getElementById('share-close-btn')
    ?.addEventListener('click', _close)
  shareModalEl?.addEventListener('click', (e) => {
    if (e.target === shareModalEl) _close()
  })

  // ── Inline tools section toggle ──
  document.getElementById('share-tools-toggle-btn')
    ?.addEventListener('click', () => {
      const body   = document.getElementById('share-tools-body')
      const toggle = document.getElementById('share-tools-toggle-btn')
      if (!body) return
      const isOpen = body.style.display !== 'none'
      body.style.display = isOpen ? 'none' : ''
      toggle?.setAttribute('aria-expanded', String(!isOpen))
    })

  // ── Inline tools: download graphic ──
  document.getElementById('share-download-graphic-btn')
    ?.addEventListener('click', _downloadShareGraphic)

  // ── Inline tools: download QR ──
  document.getElementById('share-download-qr-btn')
    ?.addEventListener('click', _downloadQr)

  // ── Inline tools: copy captions ──
  document.getElementById('share-copy-ig-caption-btn')
    ?.addEventListener('click', () => {
      const text = document.getElementById('share-post-instagram')?.value
                || _buildPostText('instagram')
      const btn  = document.getElementById('share-copy-ig-caption-btn')
      if (btn) _copyText(text, btn)
      _trackShare('instagram_caption', _getShareBaseUrl())
    })

  document.getElementById('share-copy-tt-caption-btn')
    ?.addEventListener('click', () => {
      const text = document.getElementById('share-post-tiktok')?.value
                || _buildPostText('tiktok')
      const btn  = document.getElementById('share-copy-tt-caption-btn')
      if (btn) _copyText(text, btn)
      _trackShare('tiktok_caption', _getShareBaseUrl())
    })

  // ── Campaign link ──
  document.getElementById('share-generate-btn')
    ?.addEventListener('click', _generateCampaignLink)
  document.getElementById('share-copy-short-btn')
    ?.addEventListener('click', () => {
      const urlInput = document.getElementById('share-short-url')
      const btn      = document.getElementById('share-copy-short-btn')
      if (urlInput && btn) _copyText(urlInput.value, btn)
    })

  // ── Post text tabs ──
  ;['social', 'instagram', 'tiktok'].forEach(tab => {
    document.getElementById(`share-tab-btn-${tab}`)
      ?.addEventListener('click', () => _switchTab(tab))
    document.getElementById(`share-copy-${tab}-btn`)
      ?.addEventListener('click', () => {
        const textarea = document.getElementById(`share-post-${tab}`)
        const btn      = document.getElementById(`share-copy-${tab}-btn`)
        if (textarea && btn) _copyText(textarea.value, btn)
      })
  })

  // ── Platform buttons ──

  document.getElementById('share-fb-btn')
    ?.addEventListener('click', () => {
      const { fbUrl, shareUrl } = _buildFbUrl()
      _openPopup(fbUrl)
      _trackShare('facebook', shareUrl)
    })

  document.getElementById('share-tw-btn')
    ?.addEventListener('click', () => {
      const shareUrl = _getShareBaseUrl()
      const text     = _buildPostText('social')
      _openPopup(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`)
      _trackShare('twitter', shareUrl)
    })

  document.getElementById('share-li-btn')
    ?.addEventListener('click', () => {
      const shareUrl = _getShareBaseUrl()
      _openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)
      _trackShare('linkedin', shareUrl)
    })

  // Instagram & TikTok: scroll to / expand the inline tools section
  document.getElementById('share-ig-btn')
    ?.addEventListener('click', () => {
      _scrollToSocialTools()
      _trackShare('instagram', _getShareBaseUrl())
    })

  document.getElementById('share-tt-btn')
    ?.addEventListener('click', () => {
      _scrollToSocialTools()
      _trackShare('tiktok', _getShareBaseUrl())
    })

  document.getElementById('share-copy-link-btn')
    ?.addEventListener('click', () => {
      const shareUrl = _getShareBaseUrl()
      const btn      = document.getElementById('share-copy-link-btn')
      if (btn) _copyPlatformBtn(shareUrl, btn)
      _trackShare('copy_link', shareUrl)
    })

  document.getElementById('share-email-btn')
    ?.addEventListener('click', () => {
      const shareUrl    = _getShareBaseUrl()
      const contentType = _config.contentLabel === 'album' ? 'album' : 'slideshow'
      const label       = contentType === 'album' ? 'Album' : 'Slideshow'
      const subject     = `${_config.title || 'Photo'} ${label} — Who's 2 Say Foundation`
      const body        = `Check out this ${contentType}: ${shareUrl}`
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      _trackShare('email', shareUrl)
    })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize or reconfigure the share panel.
 * Safe to call multiple times — listeners are wired on the first call only.
 *
 * @param {object} config
 * @param {string}  config.shareUrl      Canonical share URL
 * @param {string}  config.title         Album / slideshow display name
 * @param {string}  config.contentLabel  'album' | 'slideshow'
 * @param {string}  config.albumId       UUID for analytics
 * @param {string}  config.targetType    'album' | 'slideshow' | 'multi-slideshow'
 * @param {string}  config.targetId      Album ID for the short-link API
 * @param {string=} config.coverUrl      Public URL of the cover photo for share graphic
 * @returns {{ open: Function, close: Function }}
 */
export function initSharePanel(config) {
  _config = { ..._config, ...config }
  _wireListeners()
  return { open: _open, close: _close }
}
