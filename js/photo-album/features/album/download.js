export async function downloadPhoto(url, filename, { showToast } = {}) {
  showToast?.('Downloading...')
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'photo'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch (err) {
    showToast?.('Download failed: ' + err.message, true)
  }
}
