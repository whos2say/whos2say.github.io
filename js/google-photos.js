/**
 * Google Photos Picker API — Foundation
 * =====================================
 * SETUP REQUIRED (one-time, 5 minutes):
 *
 * 1. Go to https://console.cloud.google.com
 * 2. Create a project (or select existing)
 * 3. Enable "Photos Picker API" (search in API Library)
 * 4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
 * 5. Application type: Web application
 * 6. Add Authorized JavaScript origins: https://whostosay.org (and http://localhost:PORT for dev)
 * 7. Copy the Client ID and paste it below as GOOGLE_CLIENT_ID
 * 8. Go to OAuth consent screen → add test users (your email) while in testing mode
 *
 * Once configured, the "Google Photos" button on the upload page will work.
 */

const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'
// ↑ Replace with your actual client ID from Google Cloud Console

const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const PICKER_API   = 'https://photospicker.googleapis.com/v1'

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Open the Google Photos picker and return selected photos as Blobs.
 * @param {function({blob: Blob, name: string}[]): void} onPhotosSelected
 */
export async function openGooglePhotosPicker(onPhotosSelected) {
  if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
    throw new Error('Google Photos not configured — set GOOGLE_CLIENT_ID in js/google-photos.js')
  }

  await ensureGisLoaded()

  const accessToken = await requestAccessToken()
  const session     = await createPickerSession(accessToken)

  // Open picker in a popup window
  const popup = window.open(
    session.pickerUri,
    'googlePhotosPicker',
    'width=620,height=700,resizable=yes,scrollbars=yes,status=yes'
  )

  if (!popup) {
    throw new Error('Popup blocked — please allow popups for this site and try again')
  }

  // Poll until user finishes selecting or closes popup
  const mediaItems = await pollSession(session.id, accessToken, popup)

  if (!mediaItems.length) return onPhotosSelected([])

  // Download each selected photo and return as Blob
  const blobs = await downloadMediaItems(mediaItems, accessToken)
  onPhotosSelected(blobs)
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function ensureGisLoaded() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      // Script tag exists but not yet loaded — wait for it
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
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
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Failed to create picker session: ${err?.error?.message || res.statusText}`)
  }
  return res.json()
}

function pollSession(sessionId, accessToken, popup, maxWaitMs = 300000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(async () => {
      try {
        // Stop if popup was closed without selecting
        if (popup?.closed && Date.now() - start > 3000) {
          clearInterval(interval)
          resolve([])
          return
        }

        if (Date.now() - start > maxWaitMs) {
          clearInterval(interval)
          reject(new Error('Google Photos picker timed out'))
          return
        }

        const res = await fetch(`${PICKER_API}/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        const data = await res.json()

        if (data.mediaItemsSet) {
          clearInterval(interval)
          // Fetch the selected media items
          const itemsRes = await fetch(`${PICKER_API}/mediaItems?sessionId=${sessionId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          const itemsData = await itemsRes.json()
          resolve(itemsData.mediaItems || [])
        }
      } catch (err) {
        clearInterval(interval)
        reject(err)
      }
    }, 2500)
  })
}

async function downloadMediaItems(mediaItems, accessToken) {
  const blobs = []
  for (const item of mediaItems) {
    try {
      // baseUrl + '=d' downloads the full-resolution photo
      const baseUrl = item.mediaFile?.baseUrl || item.baseUrl
      if (!baseUrl) continue

      const res = await fetch(`${baseUrl}=d`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (!res.ok) continue

      const blob = await res.blob()
      const name = (item.filename || item.id || `photo_${Date.now()}`) + '.jpg'
      blobs.push({ blob, name })
    } catch (err) {
      console.warn('Failed to download media item:', item.id, err)
    }
  }
  return blobs
}
