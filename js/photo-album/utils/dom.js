export function qs(selector, root = document) {
  return root.querySelector(selector)
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)]
}

export function getAlbumIdFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search)
  return params.get('album') || params.get('id')
}

export function setDisplay(el, value) {
  if (el) el.style.display = value
}
