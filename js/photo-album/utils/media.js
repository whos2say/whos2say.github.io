export function isVideoPath(path) {
  return /\.(mp4|mov|webm|m4v)$/i.test(path || '')
}

export function isVideoFile(file) {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)
}

export function isHeicFile(file) {
  const lowerName = file.name.toLowerCase()
  return file.type.includes('image/heic') ||
    file.type.includes('image/heif') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
}

export function normalizeFocalPoint(value, fallback = '50% 50%') {
  return /^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(value || '') ? value : fallback
}
