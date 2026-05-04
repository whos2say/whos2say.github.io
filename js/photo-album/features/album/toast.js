export function showToast(message, isError = false) {
  const toast = document.createElement('div')
  toast.className = 'toast-notification' + (isError ? ' error' : '')
  toast.textContent = message

  document.body.appendChild(toast)

  // Trigger animation after insertion so the existing CSS transition runs.
  setTimeout(() => toast.classList.add('show'), 10)

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
