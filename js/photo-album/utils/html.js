export function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = value ?? ''
  return div.innerHTML
}

export function escapeHtmlString(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
