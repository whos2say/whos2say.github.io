/**
 * Google Photos Picker API
 * ========================
 * SETUP REQUIRED (one-time):
 * 1. console.cloud.google.com → APIs & Services → Library → enable "Photos Picker API"
 * 2. Credentials → Create OAuth 2.0 Client ID (Web application)
 * 3. Authorized JavaScript origins: https://www.whostosay.org, https://whostosay.org, https://whos2say.github.io
 * 4. OAuth consent screen → add your email as a test user
 * 5. Paste the Client ID below
 */

const GOOGLE_CLIENT_ID = '620985968525-665ve2r1oedvvqf9br24ql3g91746poj.apps.googleusercontent.com'
const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const PICKER_API   = 'https://photospicker.googleapis.com/v1'

/**
 * Open the Google Photos picker.
 * @param {function} onPhotosSelected  Called with [{blob, name, mimeType}]
 * @param {function} onStatus          Optional — called with status strings during the flow
 */
export async function openGooglePhotosPicker(onPhotosSelected, onStatus = () => {}) {
  await ensureGisLoaded()

  onStatus('Authenticating with Google…')
  const accessToken = await requestAccessToken()

  onStatus('Creating picker session…')
  const session = await createPickerSession(accessToken)

  const popup = window.open(
    session.pickerUri,
    'googlePhotosPicker',
    'width=620,height=700,resizable=yes,scrollbars=yes,status=yes'
  )
  if (!popup) throw new Error('Popup blocked — please allow popups for this site and try again')

  onStatus('Select photos in the Google Photos window, then click Done…')
  const mediaItems = await pollSession(session.id, accessToken, popup, onStatus)

  if (!mediaItems.length) {
    onStatus('')
    return onPhotosSelected([])
  }

  onStatus(`Downloading ${mediaItems.length} item(s)…`)
  const { blobs, failedVideos } = await downloadMediaItems(mediaItems, accessToken, onStatus)

  if (blobs.length === 0 && failedVideos.length === 0) {
    throw new Error('Items were selected but could not be downloaded. Check the browser console for details.')
  }

  onPhotosSelected(blobs, failedVideos)
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function ensureGisLoaded() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload  = resolve
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
}

function requestAccessToken() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: PICKER_SCOPE,
      callback: (response) => {
        if (response.error) return reject(new Error('Google auth error: ' + response.error))
        resolve(response.access_token)
      },
      error_callback: (err) => reject(new Error('Google auth failed: ' + JSON.stringify(err)))
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

async function createPickerSession(accessToken) {
  const res = await fetch(`${PICKER_API}/sessions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Failed to create picker session: ${err?.error?.message || res.statusText}`)
  }
  return res.json()
}

function pollSession(sessionId, accessToken, popup, onStatus, maxWaitMs = 300000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let popupClosedAt = null
    let dotCount = 0

    const interval = setInterval(async () => {
      try {
        if (Date.now() - start > maxWaitMs) {
          clearInterval(interval)
          reject(new Error('Google Photos picker timed out'))
          return
        }

        // Always check mediaItemsSet FIRST — Google marks this true and closes
        // the popup simultaneously, so checking popup.closed first would miss it
        const res = await fetch(`${PICKER_API}/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!res.ok) {
          console.warn('[google-photos] poll HTTP', res.status)
        } else {
          const data = await res.json()
          console.log('[google-photos] poll:', JSON.stringify(data).slice(0, 200))

          if (data.mediaItemsSet) {
            clearInterval(interval)
            onStatus('Selection received, fetching items…')
            const itemsRes = await fetch(`${PICKER_API}/mediaItems?sessionId=${sessionId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            const itemsData = await itemsRes.json()
            console.log('[google-photos] mediaItems response:', JSON.stringify(itemsData).slice(0, 400))
            resolve(itemsData.mediaItems || [])
            return
          }
        }

        // Popup closed — give 15s grace for slow API update
        if (popup?.closed) {
          if (!popupClosedAt) {
            popupClosedAt = Date.now()
            onStatus('Photo selection complete, waiting for confirmation…')
          }
          if (Date.now() - popupClosedAt > 15000) {
            clearInterval(interval)
            resolve([])
          }
        } else {
          // Still open — update dots to show activity
          dotCount = (dotCount + 1) % 4
          onStatus('Select photos in the Google Photos window, then click Done' + '.'.repeat(dotCount + 1))
        }
      } catch (err) {
        clearInterval(interval)
        reject(err)
      }
    }, 1500)
  })
}

async function downloadMediaItems(mediaItems, accessToken, onStatus) {
  const blobs = []
  const failedVideos = []

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i]
    const filename = item.mediaFile?.filename || item.filename || `photo_${Date.now()}.jpg`
    const mimeType = item.mediaFile?.mimeType || 'image/jpeg'
    const baseUrl = item.mediaFile?.baseUrl || item.baseUrl
    const isVideo = mimeType.startsWith('video/') || item.type === 'VIDEO'
    const suffix = isVideo ? '=dv' : '=d'

    onStatus(`Downloading ${isVideo ? 'video' : 'photo'} ${i + 1} of ${mediaItems.length}: ${filename}…`)

    if (!baseUrl) {
      console.warn('[google-photos] no baseUrl for item', item.id)
      continue
    }

    if (isVideo) {
      // Google video CDN blocks cross-origin fetch (CORS). Collect for manual download.
      console.warn('[google-photos] video CORS limitation — queuing for manual download:', filename)
      failedVideos.push({ filename, downloadUrl: `${baseUrl}${suffix}`, mimeType })
      continue
    }

    console.log('[google-photos] downloading', filename, 'from', baseUrl.slice(0, 80))

    try {
      // Attempt 1: fetch with Authorization header
      let blob = await fetch(`${baseUrl}${suffix}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      }).catch(err => {
        console.warn('[google-photos] fetch+auth failed:', err.message)
        return null
      })

      // Attempt 2: fetch without auth
      if (!blob) {
        blob = await fetch(`${baseUrl}${suffix}`).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.blob()
        }).catch(err => {
          console.warn('[google-photos] fetch no-auth failed:', err.message)
          return null
        })
      }

      // Attempt 3: img crossOrigin + canvas
      if (!blob) {
        blob = await imgToBlob(`${baseUrl}${suffix}`).catch(err => {
          console.warn('[google-photos] img+canvas failed:', err.message)
          return null
        })
      }

      if (blob) {
        blobs.push({ blob, name: filename, mimeType })
        console.log('[google-photos] downloaded', filename, blob.size, 'bytes')
      } else {
        console.error('[google-photos] all download attempts failed for', filename)
      }
    } catch (err) {
      console.error('[google-photos] item error:', err)
    }
  }

  return { blobs, failedVideos }
}

function imgToBlob(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      }, 'image/jpeg', 0.92)
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}
