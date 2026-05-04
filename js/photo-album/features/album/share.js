export function createAlbumShareController({
  getCurrentAlbumId,
  getAlbumName,
  getPhotos,
  getPublicUrl,
  initSharePanel,
  elements,
}) {
  let isBound = false
  let panel = null

  function configureAlbumShare(albumData = {}) {
    const currentAlbumId = getCurrentAlbumId()
    const title = albumData.name || getAlbumName?.()

    panel = initSharePanel({
      shareUrl: `${window.location.origin}/share/album?album=${encodeURIComponent(currentAlbumId)}`,
      title,
      contentLabel: 'album',
      albumId: currentAlbumId,
      targetType: 'album',
      targetId: currentAlbumId,
    })

    bindEvents()
  }

  function updateCoverUrl(photos = getPhotos?.() || []) {
    if (photos.length === 0) return

    const firstUrl = getPublicUrl(photos[0].file_path)
    initSharePanel({ coverUrl: firstUrl })
  }

  function bindEvents() {
    if (isBound) return

    isBound = true
    elements.shareBtn?.addEventListener('click', () => panel?.open())
  }

  return {
    configureAlbumShare,
    updateCoverUrl,
    bindEvents,
  }
}
